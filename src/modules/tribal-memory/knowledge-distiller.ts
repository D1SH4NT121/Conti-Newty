/**
 * Knowledge Distiller — Phase 3: Synthesis & Deduplication Pipeline
 *
 * Pattern:
 *   Raw IngestedItems (Slack messages, Drive docs, Jira tickets)
 *       ↓
 *   AI / Heuristic Distillation
 *       ↓
 *   Semantic Overlap & Contradiction Detection
 *       ↓
 *   Deduplication (merge source item references)
 *       ↓
 *   KnowledgeCandidate (TENTATIVE / CONFIRMED / REJECTED / SUPERSEDED)
 *       ↓
 *   Human Review / Auto-Promotion → TribalMemoryEntry (ACTIVE with supersedesId lineage)
 */

import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../../db/client';
import { AIClient } from '../brain/ai-client';
import { CredentialService } from '../auth/credential-service';
import { config } from '../../config';
import { isSimulationAllowed } from '../brain/providers/types';

// ── Schemas ───────────────────────────────────────────────────────────────────

export const SynthesizedFactSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  content: z.string().min(1),
  category: z.enum(['decision', 'architecture', 'guideline', 'lesson-learned', 'general']).default('decision'),
  tags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.85),
  suggestedAction: z.enum(['CREATE', 'UPDATE', 'SUPERSEDE']).default('CREATE'),
  targetEntryTitle: z.string().optional(),
});

export type SynthesizedFact = z.infer<typeof SynthesizedFactSchema>;

// ── Fingerprint & Deduplication ───────────────────────────────────────────────

/**
 * Deterministic fingerprint for a title and normalized content.
 */
export function computeDedupHash(title: string, summary: string): string {
  const normalized = `${title.trim().toLowerCase()}::${summary.trim().toLowerCase()}`;
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Jaccard token similarity (0.0 to 1.0) between two text blocks.
 */
export function calculateTokenSimilarity(textA: string, textB: string): number {
  const tokenize = (t: string) =>
    new Set(
      t
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2)
    );

  const setA = tokenize(textA);
  const setB = tokenize(textB);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ── Distillation ─────────────────────────────────────────────────────────────

export interface DistillOptions {
  workspaceId: string;
  userId?: string;
  sourceItemIds?: string[];
  limit?: number;
}

export interface DistillResult {
  workspaceId: string;
  itemsProcessed: number;
  candidatesCreated: number;
  candidatesMerged: number;
  candidates: Array<{
    id: string;
    title: string;
    status: string;
    suggestedAction: string;
    dedupHash: string | null;
  }>;
}

/**
 * Distill un-synthesized IngestedItems into structured KnowledgeCandidates.
 */
export async function distillIngestedItems(options: DistillOptions): Promise<DistillResult> {
  const { workspaceId, userId = 'system', sourceItemIds, limit = 20 } = options;

  // 1. Fetch target IngestedItem records
  const itemWhere: any = { workspaceId };
  if (sourceItemIds && sourceItemIds.length > 0) {
    itemWhere.id = { in: sourceItemIds };
  }

  const ingestedItems = await prisma.ingestedItem.findMany({
    where: itemWhere,
    orderBy: { ingestedAt: 'desc' },
    take: limit,
  });

  if (ingestedItems.length === 0) {
    return {
      workspaceId,
      itemsProcessed: 0,
      candidatesCreated: 0,
      candidatesMerged: 0,
      candidates: [],
    };
  }

  // 2. Fetch existing Active Tribal Memory and Candidates for overlap checks
  const [existingTribal, existingCandidates] = await Promise.all([
    prisma.tribalMemoryEntry.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      select: { id: true, title: true, content: true, tags: true },
    }),
    prisma.knowledgeCandidate.findMany({
      where: { workspaceId, status: { in: ['TENTATIVE', 'CONFIRMED'] } },
      select: { id: true, title: true, summary: true, dedupHash: true, sourceItemIds: true },
    }),
  ]);

  let candidatesCreated = 0;
  let candidatesMerged = 0;
  const processedCandidates: DistillResult['candidates'] = [];

  for (const item of ingestedItems) {
    const facts = await extractFactsFromItem(item, workspaceId, userId);

    for (const fact of facts) {
      const dedupHash = computeDedupHash(fact.title, fact.summary);

      // Check 1: Exact dedupHash match with existing candidate
      const exactCandidate = existingCandidates.find((c) => c.dedupHash === dedupHash);
      if (exactCandidate) {
        const currentSources = JSON.parse(exactCandidate.sourceItemIds || '[]');
        if (!currentSources.includes(item.id)) {
          currentSources.push(item.id);
          await prisma.knowledgeCandidate.update({
            where: { id: exactCandidate.id },
            data: { sourceItemIds: JSON.stringify(currentSources) },
          });
          candidatesMerged++;
          processedCandidates.push({
            id: exactCandidate.id,
            title: exactCandidate.title,
            status: 'MERGED',
            suggestedAction: 'MERGE',
            dedupHash,
          });
        }
        continue;
      }

      // Check 2: High token similarity with existing candidate (> 0.65)
      const similarCandidate = existingCandidates.find((c) => {
        const sim = calculateTokenSimilarity(`${fact.title} ${fact.summary}`, `${c.title} ${c.summary}`);
        return sim >= 0.65;
      });

      if (similarCandidate) {
        const currentSources = JSON.parse(similarCandidate.sourceItemIds || '[]');
        if (!currentSources.includes(item.id)) {
          currentSources.push(item.id);
          await prisma.knowledgeCandidate.update({
            where: { id: similarCandidate.id },
            data: { sourceItemIds: JSON.stringify(currentSources) },
          });
          candidatesMerged++;
          processedCandidates.push({
            id: similarCandidate.id,
            title: similarCandidate.title,
            status: 'MERGED',
            suggestedAction: 'MERGE',
            dedupHash,
          });
        }
        continue;
      }

      // Check 3: Contradiction / Supersede detection against existing Tribal Memory
      let suggestedAction: 'CREATE' | 'UPDATE' | 'SUPERSEDE' = fact.suggestedAction;
      let targetEntryId: string | null = null;

      for (const entry of existingTribal) {
        const sim = calculateTokenSimilarity(fact.title, entry.title);
        if (sim >= 0.60) {
          suggestedAction = 'SUPERSEDE';
          targetEntryId = entry.id;
          break;
        }
      }

      // Create new KnowledgeCandidate
      const candidate = await prisma.knowledgeCandidate.create({
        data: {
          workspaceId,
          title: fact.title,
          summary: fact.summary,
          content: fact.content,
          category: fact.category,
          tags: JSON.stringify(fact.tags),
          sourceItemIds: JSON.stringify([item.id]),
          sourceConnector: item.connector,
          confidence: fact.confidence,
          status: 'TENTATIVE',
          suggestedAction,
          targetEntryId,
          dedupHash,
        },
      });

      existingCandidates.push({
        id: candidate.id,
        title: candidate.title,
        summary: candidate.summary,
        dedupHash: candidate.dedupHash,
        sourceItemIds: candidate.sourceItemIds,
      });

      candidatesCreated++;
      processedCandidates.push({
        id: candidate.id,
        title: candidate.title,
        status: candidate.status,
        suggestedAction: candidate.suggestedAction,
        dedupHash: candidate.dedupHash,
      });
    }
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      action: 'KNOWLEDGE_DISTILLATION',
      userId,
      workspaceId,
      details: JSON.stringify({
        itemsProcessed: ingestedItems.length,
        candidatesCreated,
        candidatesMerged,
      }),
    },
  });

  return {
    workspaceId,
    itemsProcessed: ingestedItems.length,
    candidatesCreated,
    candidatesMerged,
    candidates: processedCandidates,
  };
}

// ── Fact Extraction Helper ───────────────────────────────────────────────────

async function extractFactsFromItem(
  item: { id: string; connector: string; externalId: string; brainPath: string },
  workspaceId: string,
  userId: string
): Promise<SynthesizedFact[]> {
  // If simulation mode or test environment
  if (isSimulationAllowed()) {
    return [
      {
        title: `Decision from ${item.connector.toUpperCase()}: ${item.brainPath.split('/').pop()?.replace('.md', '') || item.externalId}`,
        summary: `Synthesized organizational knowledge captured from connector ${item.connector} (${item.externalId})`,
        content: `### Context\nDerived automatically from \`${item.brainPath}\`.\n\n### Key Takeaway\nStandard operational policy derived from ingested conversation.`,
        category: 'decision',
        tags: [item.connector, 'auto-captured', 'decision'],
        confidence: 0.9,
        suggestedAction: 'CREATE',
      },
    ];
  }

  try {
    const apiKey = await CredentialService.resolveApiKey(config.aiProvider, userId, workspaceId);
    const client = new AIClient(config.aiProvider, apiKey);

    const prompt = `
Analyze the following connector item metadata and derive atomic company knowledge candidates (decisions, guidelines, architecture rules, or lessons learned).
Connector: ${item.connector}
External ID: ${item.externalId}
Brain Path: ${item.brainPath}

Respond ONLY with a JSON array of objects conforming to:
[
  {
    "title": "Clear concise decision or rule title",
    "summary": "1-2 sentence summary",
    "content": "Markdown formatted description and justification",
    "category": "decision" | "architecture" | "guideline" | "lesson-learned",
    "tags": ["tag1", "tag2"],
    "confidence": 0.85,
    "suggestedAction": "CREATE" | "SUPERSEDE"
  }
]
`;

    const response = await client.complete({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: 'You are an expert organizational knowledge engineer that distills unstructured connector items into high-confidence company brain entries. Return JSON only.',
    });

    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('LLM did not return a valid JSON array');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return z.array(SynthesizedFactSchema).parse(parsed);
  } catch {
    // Fallback heuristic extraction
    return [
      {
        title: `Knowledge from ${item.connector}: ${item.brainPath.split('/').pop()?.replace('.md', '') || item.externalId}`,
        summary: `Synthesized from connector ${item.connector} at ${item.brainPath}`,
        content: `### Knowledge Entry\nDerived from connector \`${item.connector}\` (${item.brainPath}).`,
        category: 'general',
        tags: [item.connector, 'auto-captured'],
        confidence: 0.8,
        suggestedAction: 'CREATE',
      },
    ];
  }
}
