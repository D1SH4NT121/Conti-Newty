/**
 * Connector Scheduler — Phase 2 Integration Tests
 *
 * Tests:
 *   1. hashContent()  — deterministic SHA-256
 *   2. upsertIngestedItem() — create, no-op, update on hash change
 *   3. getOptInStatus() — returns default state if no row exists
 *   4. setOptIn() — creates/toggles record and writes AuditLog
 *   5. getSyncHistory() — returns ConnectorSync rows for 'auto'
 *   6. syncWorkspace() — runs with no configured connections (smoke test)
 *   7. startScheduler() + stopScheduler() — timer lifecycle (no DB tick)
 *   8. Auto-sync HTTP routes via supertest
 */

import request from 'supertest';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import {
  hashContent,
  upsertIngestedItem,
  getOptInStatus,
  setOptIn,
  getSyncHistory,
  syncWorkspace,
  startScheduler,
  stopScheduler,
} from '../src/modules/connectors/connector-scheduler';
import { createApp } from '../src/api/app';
import { AuthService } from '../src/modules/auth/auth-service';
import { Express } from 'express';
import os from 'os';
import path from 'path';
import fs from 'fs';

// ── Fixtures ──────────────────────────────────────────────────────────────────

let app: Express;
let orgId: string;
let wsId: string;
let userId: string;
let authToken: string;
const authService = new AuthService();

beforeAll(async () => {
  app = createApp(os.tmpdir());
  await clearDatabase();

  // Seed minimal org -> workspace -> user
  const org = await prisma.organization.create({ data: { name: 'Sched-Org' } });
  orgId = org.id;

  const ws = await prisma.workspace.create({
    data: { name: 'Sched-WS', organizationId: orgId },
  });
  wsId = ws.id;

  const user = await prisma.user.create({
    data: {
      email: 'sched@test.dev',
      passwordHash: authService.hashPassword('pw'),
    },
  });
  userId = user.id;

  await prisma.workspaceMember.create({ data: { workspaceId: wsId, userId, role: 'admin' } });

  authToken = authService.generateToken({ userId, email: user.email });
});

afterAll(async () => {
  stopScheduler();
  await clearDatabase();
  await prisma.$disconnect();
});

// ── 1. hashContent ─────────────────────────────────────────────────────────────

describe('hashContent()', () => {
  it('produces a 64-char hex string', () => {
    const h = hashContent('hello world');
    expect(h).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(h)).toBe(true);
  });

  it('is deterministic', () => {
    expect(hashContent('abc')).toBe(hashContent('abc'));
  });

  it('changes when content changes', () => {
    expect(hashContent('abc')).not.toBe(hashContent('xyz'));
  });
});

// ── 2. upsertIngestedItem ─────────────────────────────────────────────────────

describe('upsertIngestedItem()', () => {
  const base = {
    workspaceId: '',
    connector: 'drive',
    externalId: 'file-unit-1',
    brainPath: 'connectors/drive/file-unit-1.md',
    content: 'First content',
  };

  beforeEach(() => { base.workspaceId = wsId; });

  it('creates a new IngestedItem row (isNew=true, hashChanged=true)', async () => {
    const r = await upsertIngestedItem(base);
    expect(r.isNew).toBe(true);
    expect(r.hashChanged).toBe(true);

    const row = await prisma.ingestedItem.findUnique({
      where: { workspaceId_connector_externalId: { workspaceId: wsId, connector: 'drive', externalId: 'file-unit-1' } },
    });
    expect(row).not.toBeNull();
    expect(row!.contentHash).toBe(hashContent('First content'));
  });

  it('returns isNew=false, hashChanged=false when content unchanged', async () => {
    const r = await upsertIngestedItem(base);
    expect(r.isNew).toBe(false);
    expect(r.hashChanged).toBe(false);
  });

  it('returns isNew=false, hashChanged=true when content changes', async () => {
    const r = await upsertIngestedItem({ ...base, content: 'Updated content' });
    expect(r.isNew).toBe(false);
    expect(r.hashChanged).toBe(true);

    const row = await prisma.ingestedItem.findUnique({
      where: { workspaceId_connector_externalId: { workspaceId: wsId, connector: 'drive', externalId: 'file-unit-1' } },
    });
    expect(row!.contentHash).toBe(hashContent('Updated content'));
  });
});

// ── 3. getOptInStatus ─────────────────────────────────────────────────────────

describe('getOptInStatus()', () => {
  it('returns default disabled state when no row exists', async () => {
    const s = await getOptInStatus('nonexistent-ws');
    expect(s.enabled).toBe(false);
    expect(s.intervalMin).toBe(60);
    expect(s.enabledBy).toBeNull();
  });
});

// ── 4. setOptIn ───────────────────────────────────────────────────────────────

describe('setOptIn()', () => {
  it('creates a ConnectorOptIn row when enabling', async () => {
    const s = await setOptIn(wsId, true, userId, 30);
    expect(s.enabled).toBe(true);
    expect(s.intervalMin).toBe(30);
    expect(s.enabledBy).toBe(userId);

    const row = await prisma.connectorOptIn.findUnique({ where: { workspaceId: wsId } });
    expect(row).not.toBeNull();
    expect(row!.enabled).toBe(true);
  });

  it('writes an AuditLog entry on enable', async () => {
    const logs = await prisma.auditLog.findMany({
      where: { workspaceId: wsId, action: 'CONNECTOR_AUTO_SYNC_ENABLED' },
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });

  it('can toggle back to disabled', async () => {
    const s = await setOptIn(wsId, false, userId);
    expect(s.enabled).toBe(false);

    const disableLogs = await prisma.auditLog.findMany({
      where: { workspaceId: wsId, action: 'CONNECTOR_AUTO_SYNC_DISABLED' },
    });
    expect(disableLogs.length).toBeGreaterThanOrEqual(1);
  });

  it('getOptInStatus reflects the toggled state', async () => {
    const s = await getOptInStatus(wsId);
    expect(s.enabled).toBe(false);
  });
});

// ── 5. getSyncHistory ─────────────────────────────────────────────────────────

describe('getSyncHistory()', () => {
  it('returns empty array when no auto syncs have run', async () => {
    const h = await getSyncHistory('nonexistent-ws');
    expect(h).toEqual([]);
  });

  it('returns only connector=auto rows', async () => {
    // Seed one manual drive row and two auto rows
    await prisma.connectorSync.create({
      data: { connector: 'drive', workspaceId: wsId, targetPath: '/manual', fileCount: 3, status: 'COMPLETED' },
    });
    await prisma.connectorSync.create({
      data: { connector: 'auto', workspaceId: wsId, targetPath: 'auto', fileCount: 7, status: 'COMPLETED', detail: 'drive=7 jira=0 slack=0' },
    });
    await prisma.connectorSync.create({
      data: { connector: 'auto', workspaceId: wsId, targetPath: 'auto', fileCount: 0, status: 'FAILED', detail: 'jira: token expired' },
    });

    const h = await getSyncHistory(wsId, 10);
    // All returned rows are from auto connector
    const manualRow = h.find((r: any) => r.detail === '/manual');
    expect(manualRow).toBeUndefined();
    // Count matches DB
    const raw = await prisma.connectorSync.findMany({ where: { workspaceId: wsId, connector: 'auto' } });
    expect(h).toHaveLength(raw.length);
  });
});

// ── 6. syncWorkspace smoke test ───────────────────────────────────────────────

describe('syncWorkspace()', () => {
  it('completes without throwing when no connectors are configured', async () => {
    const tmpDir = path.join(os.tmpdir(), `sched-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const result = await syncWorkspace(wsId, tmpDir);

    expect(result.workspaceId).toBe(wsId);
    expect(result.errors).toEqual([]);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    // ConnectorSync row should have been written
    const syncRow = await prisma.connectorSync.findFirst({
      where: { workspaceId: wsId, connector: 'auto' },
    });
    expect(syncRow).not.toBeNull();
    expect(syncRow!.status).toBe('COMPLETED');

    // AuditLog should have been written
    const auditRow = await prisma.auditLog.findFirst({
      where: { workspaceId: wsId, action: 'CONNECTOR_AUTO_SYNC' },
    });
    expect(auditRow).not.toBeNull();
  });
});

// ── 7. Scheduler lifecycle ────────────────────────────────────────────────────

describe('startScheduler() / stopScheduler()', () => {
  it('does not throw when called with a large poll interval', () => {
    expect(() => startScheduler({ pollIntervalMs: 999_999 })).not.toThrow();
  });

  it('is idempotent — calling startScheduler twice does not error', () => {
    expect(() => startScheduler({ pollIntervalMs: 999_999 })).not.toThrow();
  });

  it('stopScheduler does not throw', () => {
    expect(() => stopScheduler()).not.toThrow();
  });

  it('can restart after stop', () => {
    expect(() => startScheduler({ pollIntervalMs: 999_999 })).not.toThrow();
    stopScheduler(); // Clean up
  });
});

// ── 8. HTTP routes ────────────────────────────────────────────────────────────

describe('Auto-sync HTTP routes', () => {
  it('GET /connectors/auto-sync returns 200 with status for an admin', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${wsId}/connectors/auto-sync`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.enabled).toBe('boolean');
    expect(typeof res.body.intervalMin).toBe('number');
  });

  it('POST /connectors/auto-sync enables auto-sync', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${wsId}/connectors/auto-sync`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ enabled: true, intervalMin: 15 });

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.intervalMin).toBe(15);
  });

  it('POST /connectors/auto-sync returns 400 with invalid body', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${wsId}/connectors/auto-sync`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ enabled: 'notBoolean' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/enabled/i);
  });

  it('GET /connectors/auto-sync/history returns array', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${wsId}/connectors/auto-sync/history`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /connectors/auto-sync/run returns sync result object', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${wsId}/connectors/auto-sync/run`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.workspaceId).toBe(wsId);
    expect(typeof res.body.durationMs).toBe('number');
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${wsId}/connectors/auto-sync`);
    expect(res.status).toBe(401);
  });
});
