/**
 * Knowledge Candidate Service — Review Queue & Promotion Management
 *
 * Provides operations to list, confirm, reject, and supersede knowledge candidates
 * derived from passive connector ingestion.
 */

import { prisma } from '../../db/client';
import { createEntry, supersedeEntry, TribalMemoryEntryPublic } from './tribal-memory';

export interface KnowledgeCandidatePublic {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  content: string;
  category: string | null;
  tags: string[];
  sourceItemIds: string[];
  sourceConnector: string | null;
  confidence: number;
  status: 'TENTATIVE' | 'CONFIRMED' | 'REJECTED' | 'SUPERSEDED';
  suggestedAction: 'CREATE' | 'UPDATE' | 'SUPERSEDE';
  targetEntryId: string | null;
  targetEntryTitle?: string;
  dedupHash: string | null;
  reviewedById: string | null;
  reviewedByName?: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  promotedEntryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListCandidatesOptions {
  workspaceId: string;
  status?: 'TENTATIVE' | 'CONFIRMED' | 'REJECTED' | 'SUPERSEDED' | 'ALL';
  limit?: number;
  offset?: number;
}

/**
 * List knowledge candidates for a workspace.
 */
export async function listCandidates(options: ListCandidatesOptions): Promise<{
  candidates: KnowledgeCandidatePublic[];
  total: number;
}> {
  const { workspaceId, status = 'TENTATIVE', limit = 20, offset = 0 } = options;

  const where: any = { workspaceId };
  if (status && status !== 'ALL') {
    where.status = status;
  }

  const [items, total] = await Promise.all([
    prisma.knowledgeCandidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        reviewedBy: { select: { name: true } },
      },
    }),
    prisma.knowledgeCandidate.count({ where }),
  ]);

  // If there are targetEntryIds, fetch their titles
  const targetIds = items.map((i) => i.targetEntryId).filter(Boolean) as string[];
  let targetMap = new Map<string, string>();
  if (targetIds.length > 0) {
    const targets = await prisma.tribalMemoryEntry.findMany({
      where: { id: { in: targetIds } },
      select: { id: true, title: true },
    });
    targetMap = new Map(targets.map((t) => [t.id, t.title]));
  }

  return {
    candidates: items.map((i) => formatCandidate(i, targetMap.get(i.targetEntryId || ''))),
    total,
  };
}

/**
 * Get a single candidate by ID.
 */
export async function getCandidate(candidateId: string): Promise<KnowledgeCandidatePublic | null> {
  const candidate = await prisma.knowledgeCandidate.findUnique({
    where: { id: candidateId },
    include: {
      reviewedBy: { select: { name: true } },
    },
  });

  if (!candidate) return null;

  let targetTitle: string | undefined;
  if (candidate.targetEntryId) {
    const target = await prisma.tribalMemoryEntry.findUnique({
      where: { id: candidate.targetEntryId },
      select: { title: true },
    });
    targetTitle = target?.title;
  }

  return formatCandidate(candidate, targetTitle);
}

/**
 * Confirm a candidate and promote it to Tribal Memory.
 * If suggestedAction is SUPERSEDE and targetEntryId is set, supersedes the target entry.
 */
export async function confirmCandidate(
  workspaceId: string,
  candidateId: string,
  userId: string
): Promise<{
  candidate: KnowledgeCandidatePublic;
  entry: TribalMemoryEntryPublic;
}> {
  const candidate = await prisma.knowledgeCandidate.findUnique({
    where: { id: candidateId },
  });

  if (!candidate || candidate.workspaceId !== workspaceId) {
    throw new Error(`KnowledgeCandidate not found: ${candidateId}`);
  }

  const tags: string[] = JSON.parse(candidate.tags || '[]');
  if (!tags.includes('auto-captured')) {
    tags.push('auto-captured');
  }

  let createdOrPromotedEntry: TribalMemoryEntryPublic;

  if (candidate.suggestedAction === 'SUPERSEDE' && candidate.targetEntryId) {
    const { newEntry } = await supersedeEntry(candidate.targetEntryId, {
      workspaceId,
      userId,
      title: candidate.title,
      content: candidate.content,
      tags,
      source: 'auto_distilled',
      sourceCandidateId: candidate.id,
    });
    createdOrPromotedEntry = newEntry;
  } else {
    createdOrPromotedEntry = await createEntry({
      workspaceId,
      userId,
      title: candidate.title,
      content: candidate.content,
      tags,
      source: 'auto_distilled',
      sourceCandidateId: candidate.id,
    });
  }

  // Update candidate status
  const updatedCandidate = await prisma.knowledgeCandidate.update({
    where: { id: candidateId },
    data: {
      status: 'CONFIRMED',
      promotedEntryId: createdOrPromotedEntry.id,
      reviewedById: userId,
      reviewedAt: new Date(),
    },
    include: {
      reviewedBy: { select: { name: true } },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'KNOWLEDGE_CANDIDATE_CONFIRM',
      userId,
      workspaceId,
      details: JSON.stringify({
        candidateId,
        promotedEntryId: createdOrPromotedEntry.id,
        action: candidate.suggestedAction,
        supersededId: candidate.targetEntryId,
      }),
    },
  });

  return {
    candidate: formatCandidate(updatedCandidate),
    entry: createdOrPromotedEntry,
  };
}

/**
 * Reject a candidate.
 */
export async function rejectCandidate(
  workspaceId: string,
  candidateId: string,
  userId: string,
  reason?: string
): Promise<KnowledgeCandidatePublic> {
  const candidate = await prisma.knowledgeCandidate.findUnique({
    where: { id: candidateId },
  });

  if (!candidate || candidate.workspaceId !== workspaceId) {
    throw new Error(`KnowledgeCandidate not found: ${candidateId}`);
  }

  const updated = await prisma.knowledgeCandidate.update({
    where: { id: candidateId },
    data: {
      status: 'REJECTED',
      rejectionReason: reason || null,
      reviewedById: userId,
      reviewedAt: new Date(),
    },
    include: {
      reviewedBy: { select: { name: true } },
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'KNOWLEDGE_CANDIDATE_REJECT',
      userId,
      workspaceId,
      details: JSON.stringify({
        candidateId,
        reason,
      }),
    },
  });

  return formatCandidate(updated);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCandidate(candidate: any, targetTitle?: string): KnowledgeCandidatePublic {
  return {
    id: candidate.id,
    workspaceId: candidate.workspaceId,
    title: candidate.title,
    summary: candidate.summary,
    content: candidate.content,
    category: candidate.category ?? null,
    tags: typeof candidate.tags === 'string' ? JSON.parse(candidate.tags) : candidate.tags,
    sourceItemIds:
      typeof candidate.sourceItemIds === 'string'
        ? JSON.parse(candidate.sourceItemIds)
        : candidate.sourceItemIds,
    sourceConnector: candidate.sourceConnector ?? null,
    confidence: candidate.confidence,
    status: candidate.status,
    suggestedAction: candidate.suggestedAction,
    targetEntryId: candidate.targetEntryId ?? null,
    targetEntryTitle: targetTitle,
    dedupHash: candidate.dedupHash ?? null,
    reviewedById: candidate.reviewedById ?? null,
    reviewedByName: candidate.reviewedBy?.name || undefined,
    reviewedAt: candidate.reviewedAt ? candidate.reviewedAt.toISOString() : null,
    rejectionReason: candidate.rejectionReason ?? null,
    promotedEntryId: candidate.promotedEntryId ?? null,
    createdAt: candidate.createdAt.toISOString(),
    updatedAt: candidate.updatedAt.toISOString(),
  };
}
