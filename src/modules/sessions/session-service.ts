import { ParticipantRole, Prisma, SessionStatus } from '@prisma/client';
import { prisma } from '../../db/client';
import { AgentConfig } from '../brain/agent-runner';
import {
  appendSessionEvent,
  deserializeEventPayload,
  mapSessionEvent,
  SessionEventDto,
  SessionEventType
} from './session-events';

export interface LiveSessionDto {
  id: string;
  workspaceId: string;
  createdById: string;
  currentDriverId: string | null;
  title: string;
  goal: string;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  workspaceRole: string;
  participants: SessionParticipantDto[];
  events: SessionEventDto[];
}

export interface SessionParticipantDto {
  id: string;
  sessionId: string;
  userId: string;
  role: ParticipantRole;
  status: string;
  joinedAt: Date;
  lastSeenAt: Date;
}

export interface CreateSessionInput {
  workspaceId: string;
  userId: string;
  title: string;
  goal: string;
  agents?: AgentConfig[];
}

type DbClient = typeof prisma | Prisma.TransactionClient;

function roleWeight(role: string): number {
  return ({ viewer: 1, member: 2, admin: 3, owner: 4 } as Record<string, number>)[role.toLowerCase()] || 0;
}

async function requireWorkspaceMember(workspaceId: string, userId: string, client: DbClient = prisma) {
  const membership = await client.workspaceMember.findUnique({
    where: { userId_workspaceId: { workspaceId, userId } },
    select: { role: true }
  });
  if (!membership) {
    throw new Error('User is not a member of this workspace');
  }
  return membership;
}

async function requireSession(workspaceId: string, sessionId: string, client: DbClient = prisma) {
  const session = await client.liveSession.findFirst({ where: { id: sessionId, workspaceId } });
  if (!session) {
    throw new Error(`LiveSession not found: ${sessionId}`);
  }
  return session;
}

async function requireParticipant(sessionId: string, userId: string, client: DbClient = prisma) {
  const participant = await client.sessionParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId } }
  });
  if (!participant || participant.status !== 'CONNECTED') {
    throw new Error('User is not a connected participant in this session');
  }
  return participant;
}

async function requireSessionAccess(workspaceId: string, sessionId: string, userId: string, client: DbClient = prisma) {
  const membership = await requireWorkspaceMember(workspaceId, userId, client);
  const session = await requireSession(workspaceId, sessionId, client);
  await requireParticipant(sessionId, userId, client);
  return { membership, session };
}

async function loadSessionDto(workspaceId: string, sessionId: string, userId: string, client: DbClient = prisma): Promise<LiveSessionDto> {
  const { membership, session } = await requireSessionAccess(workspaceId, sessionId, userId, client);
  const [participants, events] = await Promise.all([
    client.sessionParticipant.findMany({ where: { sessionId }, orderBy: { joinedAt: 'asc' } }),
    client.sessionEvent.findMany({ where: { sessionId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
  ]);
  return {
    ...session,
    workspaceRole: membership.role,
    participants,
    events: events.map(mapSessionEvent)
  };
}

export async function createSession(input: CreateSessionInput): Promise<LiveSessionDto> {
  const membership = await requireWorkspaceMember(input.workspaceId, input.userId);
  return prisma.$transaction(async (tx) => {
    const session = await tx.liveSession.create({
      data: {
        workspaceId: input.workspaceId,
        createdById: input.userId,
        currentDriverId: input.userId,
        title: input.title,
        goal: input.goal,
        status: 'CREATED'
      }
    });
    await tx.sessionParticipant.create({
      data: { sessionId: session.id, userId: input.userId, role: ParticipantRole.DRIVER, status: 'CONNECTED' }
    });
    await appendSessionEvent({
      sessionId: session.id,
      type: SessionEventType.CREATED,
      actorId: input.userId,
      payload: { title: input.title, goal: input.goal, agents: input.agents || [] }
    }, tx);
    return loadSessionDto(input.workspaceId, session.id, input.userId, tx);
  }).then((session) => ({ ...session, workspaceRole: membership.role }));
}

export async function getSession(workspaceId: string, sessionId: string, userId: string): Promise<LiveSessionDto> {
  return loadSessionDto(workspaceId, sessionId, userId);
}

export async function joinSession(workspaceId: string, sessionId: string, userId: string): Promise<SessionParticipantDto> {
  await requireWorkspaceMember(workspaceId, userId);
  return prisma.$transaction(async (tx) => {
    await requireSession(workspaceId, sessionId, tx);
    const existing = await tx.sessionParticipant.findUnique({ where: { sessionId_userId: { sessionId, userId } } });
    const participant = existing
      ? await tx.sessionParticipant.update({ where: { id: existing.id }, data: { status: 'CONNECTED', lastSeenAt: new Date() } })
      : await tx.sessionParticipant.create({ data: { sessionId, userId, role: ParticipantRole.OBSERVER, status: 'CONNECTED' } });
    if (!existing || existing.status !== 'CONNECTED') {
      await appendSessionEvent({ sessionId, type: SessionEventType.PARTICIPANT_JOINED, actorId: userId, payload: { role: participant.role, reconnected: Boolean(existing) } }, tx);
    }
    return participant;
  });
}

export async function requestDriver(workspaceId: string, sessionId: string, userId: string): Promise<void> {
  await requireWorkspaceMember(workspaceId, userId);
  await prisma.$transaction(async (tx) => {
    const session = await requireSession(workspaceId, sessionId, tx);
    const participant = await requireParticipant(sessionId, userId, tx);
    if (participant.role !== ParticipantRole.OBSERVER) throw new Error('Only Observers may request Driver control');
    if (!session.currentDriverId) throw new Error('Session has no current Driver');
    await appendSessionEvent({ sessionId, type: SessionEventType.DRIVER_REQUESTED, actorId: userId, payload: { driverId: userId, currentDriverId: session.currentDriverId } }, tx);
  });
}

export async function approveDriverRequest(workspaceId: string, sessionId: string, driverId: string, requesterId: string): Promise<void> {
  await requireWorkspaceMember(workspaceId, requesterId);
  await prisma.$transaction(async (tx) => {
    const session = await requireSession(workspaceId, sessionId, tx);
    if (session.currentDriverId !== requesterId) throw new Error('Only the current Driver may approve control requests');
    await requireParticipant(sessionId, requesterId, tx);
    const requested = await requireParticipant(sessionId, driverId, tx);
    if (requested.role !== ParticipantRole.OBSERVER) throw new Error('Only an Observer request can be approved');
    const request = await tx.sessionEvent.findFirst({ where: { sessionId, type: SessionEventType.DRIVER_REQUESTED, payload: { contains: `"driverId":"${driverId}"` } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    if (!request) throw new Error('No pending Driver request found');
    await transferDriver(tx, sessionId, requesterId, driverId);
    await appendSessionEvent({ sessionId, type: SessionEventType.DRIVER_APPROVED, actorId: requesterId, payload: { driverId } }, tx);
  });
}

export async function handoffDriver(workspaceId: string, sessionId: string, driverId: string, nextDriverId: string): Promise<void> {
  await requireWorkspaceMember(workspaceId, driverId);
  await prisma.$transaction(async (tx) => {
    const session = await requireSession(workspaceId, sessionId, tx);
    if (session.currentDriverId !== driverId) throw new Error('Only the current Driver may hand off control');
    const next = await requireParticipant(sessionId, nextDriverId, tx);
    if (next.role !== ParticipantRole.OBSERVER) throw new Error('Control can only be handed off to an Observer');
    await transferDriver(tx, sessionId, driverId, nextDriverId);
    await appendSessionEvent({ sessionId, type: SessionEventType.DRIVER_HANDOFF, actorId: driverId, payload: { fromDriverId: driverId, toDriverId: nextDriverId } }, tx);
  });
}

async function transferDriver(tx: Prisma.TransactionClient, sessionId: string, driverId: string, nextDriverId: string): Promise<void> {
  const current = await requireParticipant(sessionId, driverId, tx);
  if (current.role !== ParticipantRole.DRIVER) throw new Error('Current Driver participant is invalid');
  await tx.sessionParticipant.update({ where: { id: current.id }, data: { role: ParticipantRole.OBSERVER } });
  await tx.sessionParticipant.update({ where: { sessionId_userId: { sessionId, userId: nextDriverId } }, data: { role: ParticipantRole.DRIVER } });
  const updated = await tx.liveSession.updateMany({ where: { id: sessionId, currentDriverId: driverId }, data: { currentDriverId: nextDriverId } });
  if (updated.count !== 1) throw new Error('Driver changed before handoff could complete');
}

export async function pauseForDisconnect(sessionId: string, driverId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const session = await tx.liveSession.findUnique({ where: { id: sessionId } });
    if (!session || session.currentDriverId !== driverId) return;
    const participant = await tx.sessionParticipant.findUnique({ where: { sessionId_userId: { sessionId, userId: driverId } } });
    if (!participant || participant.role !== ParticipantRole.DRIVER) return;
    await tx.sessionParticipant.update({ where: { id: participant.id }, data: { status: 'DISCONNECTED', lastSeenAt: new Date() } });
    await tx.liveSession.update({ where: { id: sessionId }, data: { status: 'PAUSED' } });
    await appendSessionEvent({ sessionId, type: SessionEventType.DRIVER_DISCONNECTED, actorId: driverId, payload: { driverId } }, tx);
    await appendSessionEvent({ sessionId, type: SessionEventType.SESSION_PAUSED, actorId: driverId, payload: { reason: 'DRIVER_DISCONNECTED' } }, tx);
  });
}

export function assertCanRedirect(session: LiveSessionDto, userId: string, force: boolean): void {
  if (session.currentDriverId === userId) return;
  if (force && roleWeight(session.workspaceRole) >= roleWeight('admin')) return;
  throw new Error(force ? 'Only a workspace Admin or Owner may force interrupt' : 'Only the current Driver may redirect');
}

export async function getSessionEvents(workspaceId: string, sessionId: string, userId: string): Promise<SessionEventDto[]> {
  const { session } = await requireSessionAccess(workspaceId, sessionId, userId);
  const events = await prisma.sessionEvent.findMany({ where: { sessionId: session.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  return events.map((event) => ({ ...mapSessionEvent(event), payload: deserializeEventPayload(event.payload) }));
}

export { appendSessionEvent };
