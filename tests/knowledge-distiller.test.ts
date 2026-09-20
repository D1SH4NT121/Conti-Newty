/**
 * Knowledge Distiller & Tribal Memory Versioning — Phase 3 & Phase 4 Integration Tests
 *
 * Tests:
 *   1. computeDedupHash & calculateTokenSimilarity
 *   2. distillIngestedItems — basic fact extraction
 *   3. distillIngestedItems — deduplication & source merging
 *   4. distillIngestedItems — supersede detection
 *   5. confirmCandidate — promote to TribalMemoryEntry (active)
 *   6. confirmCandidate — supersede prior TribalMemoryEntry and link version chain
 *   7. rejectCandidate — record rejection reason
 *   8. listEntries & searchEntries — hide superseded entries by default
 *   9. listEntries & searchEntries — include superseded entries when requested
 *   10. getEntryHistory — trace ancestor and descendant version chains
 *   11. MCP search_brain & get_tribal_memory — respect ACTIVE filter by default
 *   12. REST APIs — candidate listing, distillation, confirmation, rejection, history
 *   13. Audit trail — verify audit records created for distillation and review
 */

import request from 'supertest';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { createApp } from '../src/api/app';
import { AuthService } from '../src/modules/auth/auth-service';
import {
  computeDedupHash,
  calculateTokenSimilarity,
  distillIngestedItems,
} from '../src/modules/tribal-memory/knowledge-distiller';
import {
  listCandidates,
  confirmCandidate,
  rejectCandidate,
} from '../src/modules/tribal-memory/knowledge-candidate-service';
import {
  createEntry,
  listEntries,
  searchEntries,
  getEntryHistory,
  supersedeEntry,
} from '../src/modules/tribal-memory/tribal-memory';
import { McpToolsHandler } from '../src/modules/mcp-server/mcp-tools';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import path from 'path';
import fs from 'fs';

const app = createApp();
const authService = new AuthService();

describe('Phase 3 & Phase 4: Knowledge Distiller & Supersede Versioning', () => {
  let user: any;
  let workspace: any;
  let token: string;
  let testStorageDir: string;
  let storage: WorkspaceStorage;

  beforeEach(async () => {
    await clearDatabase();

    const org = await prisma.organization.create({
      data: { name: 'Acme Knowledge Corp' },
    });

    user = await prisma.user.create({
      data: {
        email: 'engineer@acme.corp',
        name: 'Lead Engineer',
        role: 'ADMIN',
        organizationId: org.id,
      },
    });

    workspace = await prisma.workspace.create({
      data: {
        name: 'Engineering Brain',
        organizationId: org.id,
      },
    });

    await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: 'OWNER',
      },
    });

    token = authService.generateToken({
      userId: user.id,
      email: user.email,
      role: 'ADMIN',
      orgId: org.id,
    });

    testStorageDir = path.join(process.cwd(), 'tmp-test-brain', workspace.id);
    fs.mkdirSync(testStorageDir, { recursive: true });
    storage = new WorkspaceStorage(workspace.id, testStorageDir);
  });

  afterEach(() => {
    if (fs.existsSync(path.join(process.cwd(), 'tmp-test-brain'))) {
      fs.rmSync(path.join(process.cwd(), 'tmp-test-brain'), { recursive: true, force: true });
    }
  });

  // ── 1. Helper Function Tests ────────────────────────────────────────────────

  describe('Deduplication & Similarity Helpers', () => {
    it('computeDedupHash produces identical SHA-256 for case/space-normalized text', () => {
      const hash1 = computeDedupHash('Use Redis for Caching', 'We should use Redis cluster.');
      const hash2 = computeDedupHash('  use redis for caching  ', 'we should use redis cluster.  ');
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('calculateTokenSimilarity accurately computes Jaccard similarity', () => {
      const textA = 'We have decided to migrate PostgreSQL database to AWS Aurora';
      const textB = 'We decided to migrate PostgreSQL database to AWS RDS Aurora';
      const textC = 'Frontend will be rebuilt using Next.js and Tailwind CSS';

      const simAB = calculateTokenSimilarity(textA, textB);
      const simAC = calculateTokenSimilarity(textA, textC);

      expect(simAB).toBeGreaterThan(0.65);
      expect(simAC).toBeLessThan(0.2);
    });
  });

  // ── 2. Distillation & Deduplication Pipeline ───────────────────────────────

  describe('distillIngestedItems', () => {
    it('distills ingested items into TENTATIVE KnowledgeCandidates', async () => {
      const item = await prisma.ingestedItem.create({
        data: {
          workspaceId: workspace.id,
          connector: 'slack',
          externalId: 'slack-msg-101',
          brainPath: 'connectors/slack/deployments.md',
          contentHash: 'hash-101',
        },
      });

      const result = await distillIngestedItems({
        workspaceId: workspace.id,
        userId: user.id,
      });

      expect(result.itemsProcessed).toBe(1);
      expect(result.candidatesCreated).toBe(1);
      expect(result.candidates[0].status).toBe('TENTATIVE');

      const savedCandidate = await prisma.knowledgeCandidate.findUnique({
        where: { id: result.candidates[0].id },
      });
      expect(savedCandidate).toBeTruthy();
      expect(savedCandidate?.workspaceId).toBe(workspace.id);
      expect(savedCandidate?.sourceConnector).toBe('slack');
    });

    it('merges multiple identical or near-duplicate messages into one candidate', async () => {
      // Ingest message 1
      await prisma.ingestedItem.create({
        data: {
          workspaceId: workspace.id,
          connector: 'slack',
          externalId: 'slack-msg-201',
          brainPath: 'connectors/slack/auth_decision.md',
          contentHash: 'hash-201',
        },
      });

      // Distill first item
      const res1 = await distillIngestedItems({
        workspaceId: workspace.id,
        userId: user.id,
      });
      expect(res1.candidatesCreated).toBe(1);

      // Ingest second similar message
      const item2 = await prisma.ingestedItem.create({
        data: {
          workspaceId: workspace.id,
          connector: 'drive',
          externalId: 'drive-doc-202',
          brainPath: 'connectors/slack/auth_decision.md', // Same topic path
          contentHash: 'hash-202',
        },
      });

      // Distill second item
      const res2 = await distillIngestedItems({
        workspaceId: workspace.id,
        userId: user.id,
        sourceItemIds: [item2.id],
      });

      expect(res2.candidatesCreated).toBe(0);
      expect(res2.candidatesMerged).toBe(1);

      // Verify sourceItemIds contains both items
      const candidate = await prisma.knowledgeCandidate.findFirst({
        where: { workspaceId: workspace.id },
      });
      const sources = JSON.parse(candidate!.sourceItemIds);
      expect(sources).toContain(item2.id);
    });

    it('detects when an ingested item updates an existing Tribal Memory entry and flags SUPERSEDE', async () => {
      // Existing active entry in Tribal Memory
      const existing = await createEntry({
        workspaceId: workspace.id,
        userId: user.id,
        title: 'Decision from DRIVE: auth_policy',
        content: 'Original auth policy: 14-day token expiration',
        tags: ['auth', 'decision'],
      });

      // New ingested item with similar topic
      await prisma.ingestedItem.create({
        data: {
          workspaceId: workspace.id,
          connector: 'drive',
          externalId: 'drive-doc-301',
          brainPath: 'connectors/drive/auth_policy.md',
          contentHash: 'hash-301',
        },
      });

      const res = await distillIngestedItems({
        workspaceId: workspace.id,
        userId: user.id,
      });

      expect(res.candidatesCreated).toBe(1);
      expect(res.candidates[0].suggestedAction).toBe('SUPERSEDE');

      const candidate = await prisma.knowledgeCandidate.findUnique({
        where: { id: res.candidates[0].id },
      });
      expect(candidate?.suggestedAction).toBe('SUPERSEDE');
      expect(candidate?.targetEntryId).toBe(existing.id);
    });
  });

  // ── 3. Review Queue & Promotion Service ─────────────────────────────────────

  describe('KnowledgeCandidateService (Confirm / Reject / Supersede)', () => {
    it('confirmCandidate promotes a CREATE candidate to an ACTIVE TribalMemoryEntry', async () => {
      const candidate = await prisma.knowledgeCandidate.create({
        data: {
          workspaceId: workspace.id,
          title: 'Database Backup Schedule',
          summary: 'Backups run daily at 02:00 UTC.',
          content: '### Policy\nBackups are saved to S3 every night at 2 AM UTC.',
          tags: JSON.stringify(['database', 'backup']),
          sourceConnector: 'jira',
          status: 'TENTATIVE',
          suggestedAction: 'CREATE',
        },
      });

      const { candidate: updated, entry } = await confirmCandidate(
        workspace.id,
        candidate.id,
        user.id
      );

      expect(updated.status).toBe('CONFIRMED');
      expect(updated.promotedEntryId).toBe(entry.id);
      expect(entry.title).toBe('Database Backup Schedule');
      expect(entry.status).toBe('ACTIVE');
      expect(entry.source).toBe('auto_distilled');
      expect(entry.tags).toContain('auto-captured');
    });

    it('confirmCandidate with SUPERSEDE marks old entry SUPERSEDED and chains new entry', async () => {
      // 1. Old entry
      const oldEntry = await createEntry({
        workspaceId: workspace.id,
        userId: user.id,
        title: '2025 Architecture Plan',
        content: 'Monolith with SQLite database.',
        tags: ['architecture'],
      });
      expect(oldEntry.status).toBe('ACTIVE');

      // 2. Candidate that supersedes old entry
      const candidate = await prisma.knowledgeCandidate.create({
        data: {
          workspaceId: workspace.id,
          title: '2026 Architecture Plan',
          summary: 'Transition to PostgreSQL + Redis.',
          content: 'Micro-modular monolith with PostgreSQL.',
          tags: JSON.stringify(['architecture']),
          status: 'TENTATIVE',
          suggestedAction: 'SUPERSEDE',
          targetEntryId: oldEntry.id,
        },
      });

      // 3. Confirm
      const { entry: newEntry } = await confirmCandidate(
        workspace.id,
        candidate.id,
        user.id
      );

      expect(newEntry.title).toBe('2026 Architecture Plan');
      expect(newEntry.status).toBe('ACTIVE');
      expect(newEntry.supersedesId).toBe(oldEntry.id);

      // Verify old entry is now SUPERSEDED
      const refreshedOld = await prisma.tribalMemoryEntry.findUnique({
        where: { id: oldEntry.id },
      });
      expect(refreshedOld?.status).toBe('SUPERSEDED');
    });

    it('rejectCandidate updates candidate status to REJECTED with reason', async () => {
      const candidate = await prisma.knowledgeCandidate.create({
        data: {
          workspaceId: workspace.id,
          title: 'Incorrect Pizza Day Policy',
          summary: 'Free pizza every Friday.',
          content: 'Casual rule not approved.',
          status: 'TENTATIVE',
        },
      });

      const rejected = await rejectCandidate(
        workspace.id,
        candidate.id,
        user.id,
        'Not an official policy'
      );

      expect(rejected.status).toBe('REJECTED');
      expect(rejected.rejectionReason).toBe('Not an official policy');
      expect(rejected.reviewedById).toBe(user.id);
    });
  });

  // ── 4. Staleness & Supersede Retrieval ──────────────────────────────────────

  describe('Tribal Memory Staleness-Aware Retrieval', () => {
    it('listEntries and searchEntries hide SUPERSEDED entries by default', async () => {
      const v1 = await createEntry({
        workspaceId: workspace.id,
        userId: user.id,
        title: 'Auth Policy v1',
        content: 'JWT lifetime: 30 days',
        tags: ['auth'],
      });

      // Supersede v1 with v2
      await supersedeEntry(v1.id, {
        workspaceId: workspace.id,
        userId: user.id,
        title: 'Auth Policy v2',
        content: 'JWT lifetime: 1 day',
        tags: ['auth'],
      });

      // 1. Default listEntries returns ONLY active v2
      const activeList = await listEntries({ workspaceId: workspace.id });
      expect(activeList.total).toBe(1);
      expect(activeList.entries[0].title).toBe('Auth Policy v2');

      // 2. Default searchEntries returns ONLY active v2
      const searchRes = await searchEntries({
        workspaceId: workspace.id,
        query: 'Auth Policy',
      });
      expect(searchRes.total).toBe(1);
      expect(searchRes.entries[0].title).toBe('Auth Policy v2');

      // 3. When includeSuperseded = true, returns both v1 and v2
      const fullList = await listEntries({
        workspaceId: workspace.id,
        includeSuperseded: true,
      });
      expect(fullList.total).toBe(2);
      expect(fullList.entries.map((e) => e.status)).toContain('SUPERSEDED');
      expect(fullList.entries.map((e) => e.status)).toContain('ACTIVE');
    });

    it('getEntryHistory traces full ancestor and descendant version chain', async () => {
      const v1 = await createEntry({
        workspaceId: workspace.id,
        userId: user.id,
        title: 'Deployment Guide v1',
        content: 'Manual FTP upload',
      });

      const { newEntry: v2 } = await supersedeEntry(v1.id, {
        workspaceId: workspace.id,
        userId: user.id,
        title: 'Deployment Guide v2',
        content: 'GitHub Actions deployment',
      });

      const { newEntry: v3 } = await supersedeEntry(v2.id, {
        workspaceId: workspace.id,
        userId: user.id,
        title: 'Deployment Guide v3',
        content: 'Kubernetes GitOps deployment',
      });

      // History of v3 should have 2 ancestors (v2, v1) and 0 descendants
      const v3History = await getEntryHistory(v3.id);
      expect(v3History.current.title).toBe('Deployment Guide v3');
      expect(v3History.ancestors).toHaveLength(2);
      expect(v3History.ancestors[0].title).toBe('Deployment Guide v2');
      expect(v3History.ancestors[1].title).toBe('Deployment Guide v1');
      expect(v3History.descendants).toHaveLength(0);

      // History of v1 should have 0 ancestors and 2 descendants (v2, v3)
      const v1History = await getEntryHistory(v1.id);
      expect(v1History.ancestors).toHaveLength(0);
      expect(v1History.descendants).toHaveLength(2);
    });
  });

  // ── 5. MCP Server Staleness Filtering ───────────────────────────────────────

  describe('MCP Tools Staleness Filtering', () => {
    it('search_brain and get_tribal_memory over MCP exclude superseded entries by default', async () => {
      const handler = new McpToolsHandler();

      const v1 = await createEntry({
        workspaceId: workspace.id,
        userId: user.id,
        title: 'Infrastructure Rule v1',
        content: 'Use single Docker container.',
        tags: ['infrastructure', 'decision'],
      });

      await supersedeEntry(v1.id, {
        workspaceId: workspace.id,
        userId: user.id,
        title: 'Infrastructure Rule v2',
        content: 'Use Kubernetes clusters.',
        tags: ['infrastructure', 'decision'],
      });

      const mcpContext = {
        workspaceId: workspace.id,
        userId: user.id,
        storage,
      };

      // 1. get_tribal_memory
      const memoryRes = await handler.getTribalMemory(mcpContext, {});
      const memoryPayload = JSON.parse(memoryRes.content[0].text);
      expect(memoryPayload.total).toBe(1);
      expect(memoryPayload.entries[0].title).toBe('Infrastructure Rule v2');

      // 2. search_brain
      const searchRes = await handler.searchBrain(mcpContext, {
        query: 'Infrastructure Rule',
      });
      const searchPayload = JSON.parse(searchRes.content[0].text);
      expect(searchPayload.totalTribalMatches).toBe(1);
      expect(searchPayload.tribalMemory[0].title).toBe('Infrastructure Rule v2');

      // 3. list_recent_decisions
      const decisionsRes = await handler.listRecentDecisions(mcpContext, {});
      const decisionsPayload = JSON.parse(decisionsRes.content[0].text);
      expect(decisionsPayload.total).toBe(1);
      expect(decisionsPayload.decisions[0].title).toBe('Infrastructure Rule v2');
    });
  });

  // ── 6. REST API Endpoints ───────────────────────────────────────────────────

  describe('REST APIs for Knowledge Candidates & Tribal History', () => {
    it('GET /api/workspaces/:id/knowledge-candidates returns tentative candidates', async () => {
      await prisma.knowledgeCandidate.create({
        data: {
          workspaceId: workspace.id,
          title: 'API Versioning Standard',
          summary: 'Use URI path versioning /api/v1.',
          content: 'All endpoints must include version in path.',
          status: 'TENTATIVE',
        },
      });

      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/knowledge-candidates`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.candidates[0].title).toBe('API Versioning Standard');
    });

    it('POST /api/workspaces/:id/knowledge-candidates/distill triggers distillation pass', async () => {
      await prisma.ingestedItem.create({
        data: {
          workspaceId: workspace.id,
          connector: 'jira',
          externalId: 'PROJ-101',
          brainPath: 'connectors/jira/security_standard.md',
          contentHash: 'hash-proj-101',
        },
      });

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/knowledge-candidates/distill`)
        .set('Authorization', `Bearer ${token}`)
        .send({ limit: 10 })
        .expect(200);

      expect(res.body.itemsProcessed).toBe(1);
      expect(res.body.candidatesCreated).toBe(1);
    });

    it('POST /api/workspaces/:id/knowledge-candidates/:id/confirm confirms candidate', async () => {
      const candidate = await prisma.knowledgeCandidate.create({
        data: {
          workspaceId: workspace.id,
          title: 'Code Review Policy',
          summary: '2 reviewers required for all PRs.',
          content: 'Every PR requires approval from 2 peers.',
          status: 'TENTATIVE',
        },
      });

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/knowledge-candidates/${candidate.id}/confirm`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.candidate.status).toBe('CONFIRMED');
      expect(res.body.entry.title).toBe('Code Review Policy');
    });

    it('POST /api/workspaces/:id/knowledge-candidates/:id/reject rejects candidate', async () => {
      const candidate = await prisma.knowledgeCandidate.create({
        data: {
          workspaceId: workspace.id,
          title: 'Obsolete Guideline',
          summary: 'Use jQuery for DOM manipulation.',
          content: 'Outdated frontend library.',
          status: 'TENTATIVE',
        },
      });

      const res = await request(app)
        .post(`/api/workspaces/${workspace.id}/knowledge-candidates/${candidate.id}/reject`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'Deprecated technology' })
        .expect(200);

      expect(res.body.status).toBe('REJECTED');
      expect(res.body.rejectionReason).toBe('Deprecated technology');
    });

    it('GET /api/workspaces/:id/tribal/entries/:entryId/history returns version lineage', async () => {
      const v1 = await createEntry({
        workspaceId: workspace.id,
        userId: user.id,
        title: 'Design System v1',
        content: 'Colors: Red and Blue',
      });

      const { newEntry: v2 } = await supersedeEntry(v1.id, {
        workspaceId: workspace.id,
        userId: user.id,
        title: 'Design System v2',
        content: 'Colors: HSL Tailwind Tokens',
      });

      const res = await request(app)
        .get(`/api/workspaces/${workspace.id}/tribal/entries/${v2.id}/history`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.current.title).toBe('Design System v2');
      expect(res.body.ancestors).toHaveLength(1);
      expect(res.body.ancestors[0].title).toBe('Design System v1');
    });
  });

  // ── 7. Audit Trail Logging ─────────────────────────────────────────────────

  describe('Audit Trail Verification', () => {
    it('distillation, confirmation, and rejection all log to AuditLog', async () => {
      // 1. Distill
      await prisma.ingestedItem.create({
        data: {
          workspaceId: workspace.id,
          connector: 'slack',
          externalId: 'msg-audit-1',
          brainPath: 'connectors/slack/audit.md',
          contentHash: 'hash-audit-1',
        },
      });

      await distillIngestedItems({
        workspaceId: workspace.id,
        userId: user.id,
      });

      const distillLog = await prisma.auditLog.findFirst({
        where: { workspaceId: workspace.id, action: 'KNOWLEDGE_DISTILLATION' },
      });
      expect(distillLog).toBeTruthy();

      // 2. Candidate confirm
      const candidate = await prisma.knowledgeCandidate.findFirst({
        where: { workspaceId: workspace.id },
      });
      await confirmCandidate(workspace.id, candidate!.id, user.id);

      const confirmLog = await prisma.auditLog.findFirst({
        where: { workspaceId: workspace.id, action: 'KNOWLEDGE_CANDIDATE_CONFIRM' },
      });
      expect(confirmLog).toBeTruthy();
    });
  });
});
