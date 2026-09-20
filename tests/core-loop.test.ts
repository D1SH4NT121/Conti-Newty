import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { createSession, joinSession, getSession } from '../src/modules/sessions/session-service';
import { SessionRunner } from '../src/modules/sessions/session-runner';
import { distillRedirect, createCandidate, confirmSkill } from '../src/modules/skills/skill-service';

describe('End-to-End Core Loop: Correction to Reusable Skill', () => {
  let workspaceId: string;
  let userAId: string;
  let userBId: string;
  let storage: WorkspaceStorage;

  beforeEach(async () => {
    await clearDatabase();

    const org = await prisma.organization.create({ data: { name: 'CoreLoop Org' } });
    const users = await Promise.all([
      prisma.user.create({ data: { email: `user-a-${Date.now()}@example.com`, name: 'User A', organizationId: org.id } }),
      prisma.user.create({ data: { email: `user-b-${Date.now()}@example.com`, name: 'User B', organizationId: org.id } })
    ]);
    userAId = users[0].id;
    userBId = users[1].id;

    const workspace = await prisma.workspace.create({
      data: { name: 'CoreLoop Workspace', organizationId: org.id }
    });
    workspaceId = workspace.id;

    await Promise.all([
      prisma.workspaceMember.create({ data: { workspaceId, userId: userAId, role: 'MEMBER' } }),
      prisma.workspaceMember.create({ data: { workspaceId, userId: userBId, role: 'MEMBER' } })
    ]);

    storage = new WorkspaceStorage(workspaceId);
    await storage.writeFile('company/refund.md', '# Refund Policy\nAll refunds must be issued within 30 days.');
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('completes the full loop: session -> redirect -> skill confirmed -> reused in later session', async () => {
    // 1. User A creates session 1
    const session1 = await createSession({
      workspaceId,
      userId: userAId,
      title: 'Analyze Policy',
      goal: 'Analyze company refund policy'
    });

    // 2. User B joins as Observer
    const participantB = await joinSession(workspaceId, session1.id, userBId);
    expect(participantB.role).toBe('OBSERVER');

    // 3. Start session 1
    await SessionRunner.start(session1.id, workspaceId, userAId, storage);

    // 4. Submit redirect instruction
    const { redirectId } = await SessionRunner.submitRedirect(session1.id, {
      userId: userAId,
      instruction: 'Do not use mock data, read existing markdown files only',
      evidence: 'company/refund.md'
    });
    expect(redirectId).toBeDefined();

    await SessionRunner.waitForExecution(session1.id);

    // 5. Distill candidate skill
    const candidate = await distillRedirect(redirectId);
    expect(candidate.rule).toBeDefined();

    const skill = await createCandidate(
      workspaceId,
      { ...candidate, sourceSessionId: session1.id },
      userAId
    );
    expect(skill.status).toBe('TENTATIVE');

    // 6. Confirm skill
    const confirmedSkill = await confirmSkill(workspaceId, skill.id, userAId);
    expect(confirmedSkill.status).toBe('CONFIRMED');

    // 7. Start session 2 in the same workspace
    const session2 = await createSession({
      workspaceId,
      userId: userAId,
      title: 'Generate Policy Report',
      goal: 'Draft updated refund summary'
    });

    await SessionRunner.start(session2.id, workspaceId, userAId, storage);
    await SessionRunner.waitForExecution(session2.id);

    // 8. Verify events across both sessions
    const s1Dto = await getSession(workspaceId, session1.id, userAId);
    const s2Dto = await getSession(workspaceId, session2.id, userAId);

    const allEventTypes = [
      ...s1Dto.events.map((e) => e.type),
      ...s2Dto.events.map((e) => e.type)
    ];

    expect(allEventTypes).toEqual(
      expect.arrayContaining([
        'SESSION_STARTED',
        'REDIRECT_SUBMITTED',
        'SKILL_PROPOSED',
        'SKILL_CONFIRMED',
        'SKILLS_APPLIED'
      ])
    );
  }, 20000);
});
