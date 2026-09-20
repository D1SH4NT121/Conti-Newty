import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import {
  createCandidate,
  listSkills,
  getSkill,
  updateCandidate,
  confirmSkill,
  rejectSkill,
  supersedeSkill,
  retrieveConfirmedSkills,
  SkillStatus
} from '../src/modules/skills/skill-service';

describe('Skill Entry lifecycle and retrieval', () => {
  let workspaceId: string;
  let userId: string;

  beforeEach(async () => {
    await clearDatabase();
    const org = await prisma.organization.create({ data: { name: 'Skills Org' } });
    const user = await prisma.user.create({
      data: { email: `skill-user-${Date.now()}@test.internal`, name: 'Skill Author', organizationId: org.id }
    });
    userId = user.id;
    const workspace = await prisma.workspace.create({
      data: { name: 'Skills Workspace', organizationId: org.id }
    });
    workspaceId = workspace.id;
    await prisma.workspaceMember.create({
      data: { workspaceId, userId, role: 'MEMBER' }
    });
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates tentative candidate skill with generated stableId', async () => {
    const candidate = await createCandidate(
      workspaceId,
      {
        title: 'Always Check Dependencies',
        category: 'Development',
        rule: 'Check dependencies before building',
        rationale: 'Avoid build failures',
        trigger: 'Build or compile task',
        example: 'npm list --depth=0',
        confidence: 0.9
      },
      userId
    );

    expect(candidate.id).toBeDefined();
    expect(candidate.stableId).toMatch(/^skill-/);
    expect(candidate.status).toBe(SkillStatus.TENTATIVE);
    expect(candidate.title).toBe('Always Check Dependencies');
  });

  it('allows editing tentative candidate but rejects editing confirmed skill', async () => {
    const candidate = await createCandidate(
      workspaceId,
      {
        title: 'Initial Title',
        rule: 'Initial Rule',
        rationale: 'Reason',
        trigger: 'Trigger',
        example: 'Example'
      },
      userId
    );

    const updated = await updateCandidate(workspaceId, candidate.id, { title: 'Updated Title' }, userId);
    expect(updated.title).toBe('Updated Title');

    await confirmSkill(workspaceId, candidate.id, userId);

    await expect(
      updateCandidate(workspaceId, candidate.id, { title: 'Should Fail' }, userId)
    ).rejects.toThrow('Confirmed skills are immutable');
  });

  it('confirms and rejects skills and creates review records', async () => {
    const cand1 = await createCandidate(workspaceId, { title: 'C1', rule: 'R1', rationale: 'Ra1', trigger: 'T1', example: 'E1' }, userId);
    const cand2 = await createCandidate(workspaceId, { title: 'C2', rule: 'R2', rationale: 'Ra2', trigger: 'T2', example: 'E2' }, userId);

    const confirmed = await confirmSkill(workspaceId, cand1.id, userId);
    expect(confirmed.status).toBe(SkillStatus.CONFIRMED);

    const rejected = await rejectSkill(workspaceId, cand2.id, userId);
    expect(rejected.status).toBe(SkillStatus.REJECTED);

    const reviews = await prisma.skillReview.findMany({});
    expect(reviews.length).toBe(2);
  });

  it('supports superseding confirmed skills with new version and links supersedesId', async () => {
    const original = await createCandidate(workspaceId, { title: 'V1 Title', rule: 'V1 Rule', rationale: 'Ra', trigger: 'Tr', example: 'Ex' }, userId);
    await confirmSkill(workspaceId, original.id, userId);

    const superseded = await supersedeSkill(
      workspaceId,
      original.id,
      { title: 'V2 Title', rule: 'V2 Updated Rule' },
      userId
    );

    expect(superseded.status).toBe(SkillStatus.CONFIRMED);
    expect(superseded.supersedesId).toBe(original.id);
    expect(superseded.stableId).toBe(original.stableId);

    const oldSkill = await getSkill(workspaceId, original.id);
    expect(oldSkill.status).toBe(SkillStatus.SUPERSEDED);
  });

  it('retrieves only confirmed skills and excludes tentative/rejected/superseded', async () => {
    const s1 = await createCandidate(workspaceId, { title: 'Tentative Skill', rule: 'Rule 1', rationale: 'R', trigger: 'T', example: 'E' }, userId);
    const s2 = await createCandidate(workspaceId, { title: 'Confirmed Skill', rule: 'Rule 2', rationale: 'R', trigger: 'T', example: 'E' }, userId);
    const s3 = await createCandidate(workspaceId, { title: 'Rejected Skill', rule: 'Rule 3', rationale: 'R', trigger: 'T', example: 'E' }, userId);

    await confirmSkill(workspaceId, s2.id, userId);
    await rejectSkill(workspaceId, s3.id, userId);

    const retrieved = await retrieveConfirmedSkills(workspaceId, 'Rule');
    expect(retrieved.length).toBe(1);
    expect(retrieved[0].id).toBe(s2.id);
  });
});
