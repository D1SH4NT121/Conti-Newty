import { prisma } from '../../db/client';
import { Prisma } from '@prisma/client';

export const SessionEventType = {
  CREATED: 'SESSION_CREATED',
  PARTICIPANT_JOINED: 'PARTICIPANT_JOINED',
  DRIVER_REQUESTED: 'DRIVER_REQUESTED',
  DRIVER_APPROVED: 'DRIVER_APPROVED',
  DRIVER_HANDOFF: 'DRIVER_HANDOFF',
  DRIVER_DISCONNECTED: 'DRIVER_DISCONNECTED',
  SESSION_PAUSED: 'SESSION_PAUSED',
  SESSION_STARTED: 'SESSION_STARTED',
  SESSION_RESUMED: 'SESSION_RESUMED',
  SESSION_COMPLETED: 'SESSION_COMPLETED',
  SESSION_FAILED: 'SESSION_FAILED',
  SESSION_CANCELLED: 'SESSION_CANCELLED',
  AGENT_STEP_STARTED: 'AGENT_STEP_STARTED',
  AGENT_STEP_COMPLETED: 'AGENT_STEP_COMPLETED',
  AGENT_STEP_INTERRUPTED: 'AGENT_STEP_INTERRUPTED',
  REDIRECT_SUBMITTED: 'REDIRECT_SUBMITTED',
  CORRECTION_CAPTURED: 'CORRECTION_CAPTURED',
  SKILL_PROPOSED: 'SKILL_PROPOSED',
  SKILL_CONFIRMED: 'SKILL_CONFIRMED',
  SKILL_REJECTED: 'SKILL_REJECTED',
  SKILLS_APPLIED: 'SKILLS_APPLIED'
} as const;

export type SessionEventType = (typeof SessionEventType)[keyof typeof SessionEventType];

export interface SessionEventDto {
  id: string;
  sessionId: string;
  actorId: string | null;
  type: SessionEventType | string;
  payload: unknown;
  createdAt: Date;
}

export interface AppendSessionEventInput {
  sessionId: string;
  type: SessionEventType;
  actorId?: string;
  payload: unknown;
}

export function serializeEventPayload(payload: unknown): string {
  const serialized = JSON.stringify(payload);
  return serialized === undefined ? 'null' : serialized;
}

export function deserializeEventPayload(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    throw new Error('Stored session event payload is invalid JSON');
  }
}

function toEventDto(event: { id: string; sessionId: string; actorId: string | null; type: string; payload: string; createdAt: Date }): SessionEventDto {
  return {
    id: event.id,
    sessionId: event.sessionId,
    actorId: event.actorId,
    type: event.type,
    payload: deserializeEventPayload(event.payload),
    createdAt: event.createdAt
  };
}

export async function appendSessionEvent(
  input: AppendSessionEventInput,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<SessionEventDto> {
  const session = await client.liveSession.findUnique({ where: { id: input.sessionId }, select: { id: true } });
  if (!session) {
    throw new Error(`LiveSession not found: ${input.sessionId}`);
  }

  const event = await client.sessionEvent.create({
    data: {
      sessionId: input.sessionId,
      actorId: input.actorId || null,
      type: input.type,
      payload: serializeEventPayload(input.payload)
    }
  });
  return toEventDto(event);
}

export function mapSessionEvent(event: {
  id: string;
  sessionId: string;
  actorId: string | null;
  type: string;
  payload: string;
  createdAt: Date;
}): SessionEventDto {
  return toEventDto(event);
}
