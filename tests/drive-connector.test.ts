/**
 * Drive Connector — mocked tests
 *
 * All Drive API HTTP calls are intercepted via jest.spyOn(global, 'fetch').
 * No real network requests are made.
 *
 * Cases:
 *   1. connectFiles() creates expected SourceConnection row + Brain file
 *   2. syncWorkspaceConnections() with unchanged modifiedTime → no write
 *   3. syncWorkspaceConnections() with changed modifiedTime → content updated, lastSyncedAt updated
 *   4. Expired/revoked token (401 + refresh fails) → status = 'reconnect_required', no crash
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { CredentialVault } from '../src/modules/auth/credential-vault';
import {
  connectFiles,
  syncWorkspaceConnections,
  DriveTokens,
  PickerFile,
} from '../src/modules/connectors/drive-connector';

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-09-18T10:00:00.000Z');
const LATER = new Date('2026-09-18T12:00:00.000Z');

function makeMeta(overrides: Partial<{ name: string; mimeType: string; modifiedTime: string }> = {}) {
  return {
    id: 'file-abc',
    name: overrides.name ?? 'report.md',
    mimeType: overrides.mimeType ?? 'text/plain',
    modifiedTime: overrides.modifiedTime ?? NOW.toISOString(),
  };
}

function fetchOk(body: any, status = 200): Response {
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      status,
      headers: { 'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json' },
    }
  );
}

function fetchFail(status: number): Response {
  return new Response('{}', { status });
}

// ── Setup ────────────────────────────────────────────────────────────────────

const testDir = path.resolve(process.cwd(), 'test-drive-connector');
let storage: WorkspaceStorage;
let testUser: any;
let testWorkspace: any;

const tokens: DriveTokens = {
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-456',
};

const pickerFiles: PickerFile[] = [
  { id: 'file-abc', name: 'report.md', mimeType: 'text/plain' },
];

beforeAll(async () => {
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  await clearDatabase();

  const org = await prisma.organization.create({ data: { name: 'Drive Test Org' } });
  testUser = await prisma.user.create({
    data: { email: 'drive@test.com', name: 'Drive Tester', passwordHash: 'x' },
  });
  testWorkspace = await prisma.workspace.create({
    data: { name: 'Drive Test WS', organizationId: org.id },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: testWorkspace.id, userId: testUser.id, role: 'member' },
  });

  storage = new WorkspaceStorage(testWorkspace.id, testDir);
});

afterAll(async () => {
  try {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  } catch { /* Windows lock */ }
  await clearDatabase();
  await prisma.$disconnect();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Test 1: initial connect ───────────────────────────────────────────────────

describe('connectFiles()', () => {
  it('creates expected SourceConnection row and writes Brain file on initial connect', async () => {
    const meta = makeMeta();
    const fileContent = '# Report\nContent here.';

    jest.spyOn(global, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('drive/v3/files/file-abc') && url.includes('fields=')) {
        return fetchOk(meta);
      }
      if (url.includes('alt=media') || url.includes('/export')) {
        return fetchOk(fileContent);
      }
      return fetchFail(404);
    });

    const result = await connectFiles({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      storage,
      tokens,
      pickerFiles,
    });

    // Correct result shape
    expect(result.connected).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
    expect(result.connected[0].brainPath).toMatch(/connectors\/drive\//);
    expect(result.connected[0].externalName).toBe('report.md');

    // SourceConnection row created in DB
    const conn = await prisma.sourceConnection.findFirst({
      where: { externalFileId: 'file-abc', workspaceId: testWorkspace.id },
    });
    expect(conn).not.toBeNull();
    expect(conn!.provider).toBe('drive');
    expect(conn!.status).toBe('active');
    expect(conn!.brainPath).toBe(result.connected[0].brainPath);
    expect(conn!.lastSyncedAt).not.toBeNull();

    // Tokens are encrypted, not stored in plaintext
    expect(conn!.accessTokenEnc).not.toBe(tokens.accessToken);
    expect(CredentialVault.decrypt(conn!.accessTokenEnc)).toBe(tokens.accessToken);

    // Brain file written to disk
    const written = await storage.readFile(result.connected[0].brainPath);
    expect(written).toBe(fileContent);
  });
});

// ── Test 2: sync with unchanged modifiedTime ──────────────────────────────────

describe('syncWorkspaceConnections()', () => {
  it('skips write when Drive modifiedTime is unchanged', async () => {
    // Ensure there is exactly one active connection with a known remoteModifiedAt
    await prisma.sourceConnection.updateMany({
      where: { workspaceId: testWorkspace.id, externalFileId: 'file-abc' },
      data: { remoteModifiedAt: NOW, status: 'active' },
    });

    const writeFileSpy = jest.spyOn(storage, 'writeFile');

    jest.spyOn(global, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('drive/v3/files/file-abc') && url.includes('fields=')) {
        // Same modifiedTime as stored
        return fetchOk(makeMeta({ modifiedTime: NOW.toISOString() }));
      }
      return fetchFail(404);
    });

    const result = await syncWorkspaceConnections(testWorkspace.id, storage);

    expect(result.skipped).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.details[0].outcome).toBe('skipped');
    expect(writeFileSpy).not.toHaveBeenCalled();
  });

  // ── Test 3: sync with changed modifiedTime ──────────────────────────────────

  it('updates content and lastSyncedAt when Drive modifiedTime has changed', async () => {
    const conn = await prisma.sourceConnection.findFirst({
      where: { workspaceId: testWorkspace.id, externalFileId: 'file-abc' },
    });
    expect(conn).not.toBeNull();

    // Store old modifiedAt so LATER is newer
    await prisma.sourceConnection.update({
      where: { id: conn!.id },
      data: { remoteModifiedAt: NOW, status: 'active' },
    });

    const updatedContent = '# Report\nUpdated content.';

    jest.spyOn(global, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('drive/v3/files/file-abc') && url.includes('fields=')) {
        // Newer modifiedTime
        return fetchOk(makeMeta({ modifiedTime: LATER.toISOString() }));
      }
      if (url.includes('alt=media') || url.includes('/export')) {
        return fetchOk(updatedContent);
      }
      return fetchFail(404);
    });

    const result = await syncWorkspaceConnections(testWorkspace.id, storage);

    expect(result.updated).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.details[0].outcome).toBe('updated');

    // Content written to Brain
    const written = await storage.readFile(conn!.brainPath);
    expect(written).toBe(updatedContent);

    // lastSyncedAt bumped
    const updated = await prisma.sourceConnection.findUnique({ where: { id: conn!.id } });
    expect(updated!.lastSyncedAt!.getTime()).toBeGreaterThanOrEqual(conn!.lastSyncedAt!.getTime());

    // remoteModifiedAt updated to LATER
    expect(updated!.remoteModifiedAt!.toISOString()).toBe(LATER.toISOString());
  });

  // ── Test 4: expired/revoked token ────────────────────────────────────────────

  it('marks connection reconnect_required when token is expired and refresh fails — no crash', async () => {
    const conn = await prisma.sourceConnection.findFirst({
      where: { workspaceId: testWorkspace.id, externalFileId: 'file-abc' },
    });
    expect(conn).not.toBeNull();

    // Reset to active with an old modifiedAt so sync tries to fetch
    await prisma.sourceConnection.update({
      where: { id: conn!.id },
      data: { remoteModifiedAt: NOW, status: 'active' },
    });

    jest.spyOn(global, 'fetch').mockImplementation(async (input: any) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('drive/v3/files/file-abc') && url.includes('fields=')) {
        // Return newer modifiedTime to trigger content fetch
        return new Response(JSON.stringify(makeMeta({ modifiedTime: new Date(Date.now() + 9999999).toISOString() })), {
          status: 401, // token expired on metadata call
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('oauth2.googleapis.com/token')) {
        // Refresh fails — revoked token
        return fetchFail(400);
      }
      return fetchFail(401);
    });

    // Must not throw
    const result = await syncWorkspaceConnections(testWorkspace.id, storage);

    expect(result.reconnectRequired).toBe(1);
    expect(result.updated).toBe(0);

    // DB status updated
    const refreshed = await prisma.sourceConnection.findUnique({ where: { id: conn!.id } });
    expect(refreshed!.status).toBe('reconnect_required');
  });
});
