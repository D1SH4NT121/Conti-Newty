import { prisma } from '../../db/client';
import { SkillStatus } from '../sessions/session-types';
import { appendSessionEvent, SessionEventType } from '../sessions/session-events';
import { recordSessionAudit } from '../sessions/session-service';
import { SkillCandidate } from './skill-distiller';

export { SkillStatus } from '../sessions/session-types';
export { distillRedirect, SkillCandidate } from './skill-distiller';

export interface SkillEntryDto {
  id: string;
  workspaceId: string;
  sourceSessionId: string | null;
  createdById: string;
  supersedesId: string | null;
  stableId: string;
  title: string;
  category: string | null;
  rule: string;
  rationale: string;
  trigger: string;
  example: string;
  confidence: number | null;
  status: SkillStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillEditInput {
  title?: string;
  category?: string;
  rule?: string;
  rationale?: string;
  trigger?: string;
  example?: string;
  confidence?: number;
}

function mapSkill(skill: any): SkillEntryDto {
  return {
    ...skill,
    status: skill.status as SkillStatus
  };
}

export async function createCandidate(
  workspaceId: string,
  candidate: SkillCandidate & { sourceSessionId?: string },
  userId: string
): Promise<SkillEntryDto> {
  const stableId = candidate.stableId || `skill-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const skill = await prisma.skillEntry.create({
    data: {
      workspaceId,
      sourceSessionId: candidate.sourceSessionId || null,
      createdById: userId,
      stableId,
      title: candidate.title,
      category: candidate.category || 'General',
      rule: candidate.rule,
      rationale: candidate.rationale,
      trigger: candidate.trigger,
      example: candidate.example,
      confidence: candidate.confidence ?? 0.8,
      status: 'TENTATIVE'
    }
  });

  if (candidate.sourceSessionId) {
    await appendSessionEvent({
      sessionId: candidate.sourceSessionId,
      type: SessionEventType.SKILL_PROPOSED,
      actorId: userId,
      payload: { skillId: skill.id, stableId, title: skill.title }
    });
  }

  return mapSkill(skill);
}

export async function listSkills(workspaceId: string, status?: SkillStatus): Promise<SkillEntryDto[]> {
  const where: any = { workspaceId };
  if (status) {
    where.status = status;
  }
  const skills = await prisma.skillEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });
  return skills.map(mapSkill);
}

export async function getSkill(workspaceId: string, skillId: string): Promise<SkillEntryDto> {
  const skill = await prisma.skillEntry.findFirst({
    where: { id: skillId, workspaceId }
  });
  if (!skill) {
    throw new Error(`SkillEntry not found: ${skillId}`);
  }
  return mapSkill(skill);
}

export async function updateCandidate(
  workspaceId: string,
  skillId: string,
  input: SkillEditInput,
  _userId: string
): Promise<SkillEntryDto> {
  const skill = await prisma.skillEntry.findFirst({
    where: { id: skillId, workspaceId }
  });
  if (!skill) throw new Error(`SkillEntry not found: ${skillId}`);
  if (skill.status === 'CONFIRMED') {
    throw new Error('Confirmed skills are immutable. Use supersedeSkill to create a new version.');
  }

  const updated = await prisma.skillEntry.update({
    where: { id: skillId },
    data: {
      title: input.title ?? skill.title,
      category: input.category ?? skill.category,
      rule: input.rule ?? skill.rule,
      rationale: input.rationale ?? skill.rationale,
      trigger: input.trigger ?? skill.trigger,
      example: input.example ?? skill.example,
      confidence: input.confidence ?? skill.confidence
    }
  });
  return mapSkill(updated);
}

export async function confirmSkill(
  workspaceId: string,
  skillId: string,
  userId: string
): Promise<SkillEntryDto> {
  return prisma.$transaction(async (tx) => {
    const skill = await tx.skillEntry.findFirst({
      where: { id: skillId, workspaceId }
    });
    if (!skill) throw new Error(`SkillEntry not found: ${skillId}`);

    const updated = await tx.skillEntry.update({
      where: { id: skillId },
      data: { status: 'CONFIRMED' }
    });

    await tx.skillReview.create({
      data: {
        skillId,
        reviewerId: userId,
        decision: 'CONFIRMED'
      }
    });

    if (skill.sourceSessionId) {
      await appendSessionEvent({
        sessionId: skill.sourceSessionId,
        type: SessionEventType.SKILL_CONFIRMED,
        actorId: userId,
        payload: { skillId: skill.id, title: skill.title }
      }, tx);
    }

    await recordSessionAudit(workspaceId, userId, 'SKILL_CONFIRMED', { skillId: skill.id, stableId: skill.stableId, title: skill.title }, tx);

    return mapSkill(updated);
  });
}

export async function rejectSkill(
  workspaceId: string,
  skillId: string,
  userId: string
): Promise<SkillEntryDto> {
  return prisma.$transaction(async (tx) => {
    const skill = await tx.skillEntry.findFirst({
      where: { id: skillId, workspaceId }
    });
    if (!skill) throw new Error(`SkillEntry not found: ${skillId}`);

    const updated = await tx.skillEntry.update({
      where: { id: skillId },
      data: { status: 'REJECTED' }
    });

    await tx.skillReview.create({
      data: {
        skillId,
        reviewerId: userId,
        decision: 'REJECTED'
      }
    });

    if (skill.sourceSessionId) {
      await appendSessionEvent({
        sessionId: skill.sourceSessionId,
        type: SessionEventType.SKILL_REJECTED,
        actorId: userId,
        payload: { skillId: skill.id, title: skill.title }
      }, tx);
    }

    await recordSessionAudit(workspaceId, userId, 'SKILL_REJECTED', { skillId: skill.id, stableId: skill.stableId, title: skill.title }, tx);

    return mapSkill(updated);
  });
}

export async function supersedeSkill(
  workspaceId: string,
  skillId: string,
  input: SkillEditInput,
  userId: string
): Promise<SkillEntryDto> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.skillEntry.findFirst({
      where: { id: skillId, workspaceId }
    });
    if (!existing) throw new Error(`SkillEntry not found: ${skillId}`);

    // Mark previous as SUPERSEDED
    await tx.skillEntry.update({
      where: { id: skillId },
      data: { status: 'SUPERSEDED' }
    });

    // Create new version with same stableId
    const newVersion = await tx.skillEntry.create({
      data: {
        workspaceId,
        sourceSessionId: existing.sourceSessionId,
        createdById: userId,
        supersedesId: existing.id,
        stableId: existing.stableId,
        title: input.title ?? existing.title,
        category: input.category ?? existing.category,
        rule: input.rule ?? existing.rule,
        rationale: input.rationale ?? existing.rationale,
        trigger: input.trigger ?? existing.trigger,
        example: input.example ?? existing.example,
        confidence: input.confidence ?? existing.confidence,
        status: 'CONFIRMED'
      }
    });

    await tx.skillReview.create({
      data: {
        skillId: newVersion.id,
        reviewerId: userId,
        decision: 'CONFIRMED',
        context: `Superseded ${existing.id}`
      }
    });

    await recordSessionAudit(workspaceId, userId, 'SKILL_SUPERSEDED', { oldSkillId: skillId, newSkillId: newVersion.id, stableId: existing.stableId }, tx);

    return mapSkill(newVersion);
  });
}

export async function retrieveConfirmedSkills(
  workspaceId: string,
  _query: string,
  limit = 10
): Promise<SkillEntryDto[]> {
  const confirmed = await prisma.skillEntry.findMany({
    where: {
      workspaceId,
      status: 'CONFIRMED'
    },
    orderBy: { updatedAt: 'desc' },
    take: limit
  });
  return confirmed.map(mapSkill);
}
