import { ParticipantRole } from '../src/modules/sessions/session-types';
import { prisma } from '../src/db/client';
import {
  appendSessionEvent,
  assertCanRedirect,
  approveDriverRequest,
  createSession,
  getSession,
  getSessionEvents,
  handoffDriver,
  joinSession,
  pauseForDisconnect,
  requestDriver
} from '../src/modules/sessions/session-service';
import { clearDatabase } from './test-utils';

describe('session lifecycle service', () => {
  let workspaceId: string;
  let otherWorkspaceId: string;
  let creatorId: string;
  let observerId: string;
  let adminId: string;
  let outsiderId: string;

  beforeEach(async () => {
    await clearDatabase();
    const org = await prisma.organization.create({ data: { name: `Session Org ${Date.now()}` } });
    const otherOrg = await prisma.organization.create({ data: { name: `Other Org ${Date.now()}` } });
    const users = await Promise.all([
      prisma.user.create({ data: { email: `creator-${Date.now()}@test.internal`, name: 'Creator' } }),
      prisma.user.create({ data: { email: `observer-${Date.now()}@test.internal`, name: 'Observer' } }),
      prisma.user.create({ data: { email: `admin-${Date.now()}@test.internal`, name: 'Admin' } }),
      prisma.user.create({ data: { email: `outsider-${Date.now()}@test.internal`, name: 'Outsider' } })
    ]);
    creatorId = users[0].id;
    observerId = users[1].id;
    adminId = users[2].id;
    outsiderId = users[3].id;
    const workspace = await prisma.workspace.create({ data: { name: 'Session Workspace', organizationId: org.id } });
    const otherWorkspace = await prisma.workspace.create({ data: { name: 'Other Workspace', organizationId: otherOrg.id } });
    workspaceId = workspace.id;
    otherWorkspaceId = otherWorkspace.id;
    await Promise.all([
      prisma.workspaceMember.create({ data: { workspaceId, userId: creatorId, role: 'MEMBER' } }),
      prisma.workspaceMember.create({ data: { workspaceId, userId: observerId, role: 'MEMBER' } }),
      prisma.workspaceMember.create({ data: { workspaceId, userId: adminId, role: 'ADMIN' } }),
      prisma.workspaceMember.create({ data: { workspaceId: otherWorkspaceId, userId: outsiderId, role: 'MEMBER' } })
    ]);
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a Driver and lets a member join as an Observer', async () => {
    const session = await createSession({ workspaceId, userId: creatorId, title: 'Review', goal: 'Learn' });
    const participant = await joinSession(workspaceId, session.id, observerId);
    expect(session.currentDriverId).toBe(creatorId);
    expect(session.participants.find((item) => item.userId === creatorId)?.role).toBe(ParticipantRole.DRIVER);
    expect(participant.role).toBe(ParticipantRole.OBSERVER);
  });

  it('requires explicit approval before handing Driver control to an Observer', async () => {
    const session = await createSession({ workspaceId, userId: creatorId, title: 'Review', goal: 'Learn' });
    await joinSession(workspaceId, session.id, observerId);
    await requestDriver(workspaceId, session.id, observerId);
    await approveDriverRequest(workspaceId, session.id, observerId, creatorId);
    const updated = await getSession(workspaceId, session.id, observerId);
    expect(updated.currentDriverId).toBe(observerId);
    expect(updated.participants.find((item) => item.userId === observerId)?.role).toBe(ParticipantRole.DRIVER);
    expect(updated.events.map((event) => event.type)).toEqual(expect.arrayContaining(['DRIVER_REQUESTED', 'DRIVER_APPROVED']));
  });

  it('rejects Observer redirects and allows Admin force interrupts', async () => {
    const session = await createSession({ workspaceId, userId: creatorId, title: 'Review', goal: 'Learn' });
    await joinSession(workspaceId, session.id, observerId);
    const observerView = await getSession(workspaceId, session.id, observerId);
    expect(() => assertCanRedirect(observerView, observerId, false)).toThrow('current Driver');
    const adminView = await getSession(workspaceId, session.id, adminId);
    expect(() => assertCanRedirect(adminView, adminId, true)).not.toThrow();
  });

  it('pauses on Driver disconnect without promoting an Observer', async () => {
    const session = await createSession({ workspaceId, userId: creatorId, title: 'Review', goal: 'Learn' });
    await joinSession(workspaceId, session.id, observerId);
    await pauseForDisconnect(session.id, creatorId);
    const paused = await getSession(workspaceId, session.id, observerId);
    expect(paused.status).toBe('PAUSED');
    expect(paused.currentDriverId).toBe(creatorId);
    expect(paused.participants.find((item) => item.userId === observerId)?.role).toBe(ParticipantRole.OBSERVER);
    expect(paused.events.map((event) => event.type)).toEqual(expect.arrayContaining(['DRIVER_DISCONNECTED', 'SESSION_PAUSED']));
  });

  it('supports direct handoff and persists event payloads', async () => {
    const session = await createSession({ workspaceId, userId: creatorId, title: 'Review', goal: 'Learn', agents: [{ role: 'Researcher', provider: 'test' }] });
    await joinSession(workspaceId, session.id, observerId);
    await handoffDriver(workspaceId, session.id, creatorId, observerId);
    await appendSessionEvent({ sessionId: session.id, type: 'SESSION_PAUSED', actorId: observerId, payload: { reason: 'test' } });
    const events = await getSessionEvents(workspaceId, session.id, observerId);
    expect(events[0].payload).toMatchObject({ title: 'Review', agents: [{ role: 'Researcher' }] });
    expect(events.at(-1)?.payload).toEqual({ reason: 'test' });
  });

  it('enforces workspace isolation for reads and writes', async () => {
    const session = await createSession({ workspaceId, userId: creatorId, title: 'Private', goal: 'Learn' });
    await expect(getSession(otherWorkspaceId, session.id, outsiderId)).rejects.toThrow('LiveSession not found');
    await expect(joinSession(otherWorkspaceId, session.id, outsiderId)).rejects.toThrow('LiveSession not found');
  });
});
