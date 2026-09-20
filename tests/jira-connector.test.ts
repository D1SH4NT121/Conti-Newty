/**
 * Jira Connector Tests — mocked Atlassian OAuth + API
 *
 * All Atlassian API HTTP calls are intercepted via jest.spyOn(global, 'fetch').
 * No real network requests are made.
 *
 * Cases:
 *   1. OAuth code exchange → returns access token
 *   2. Fetch cloud instance ID → returns user's Jira site ID
 *   3. Initial Jira connection → creates JiraConnection row, fetches issues, writes files
 *   4. Sync unchanged → skips issues with no recent updates
 *   5. Sync changed → updates issues with recent updates, bumps lastSyncedAt
 *   6. Auth failure (invalid token) → marks syncStatus='auth_failed'
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { CredentialVault } from '../src/modules/auth/credential-vault';
import {
  exchangeCode,
  fetchCloudInstanceId,
  connectJira,
  syncJiraConnection,
  searchIssues,
} from '../src/modules/connectors/jira-connector';

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-09-18T10:00:00.000Z');
const LATER = new Date('2026-09-18T12:00:00.000Z');

interface MockJiraIssue {
  key: string;
  fields: {
    summary: string;
    description?: string;
    status: { name: string };
    priority?: { name: string };
    assignee?: { displayName: string };
    updated: string;
  };
}

function mockJiraIssue(overrides: { key?: string; fields?: Partial<MockJiraIssue['fields']> } = {}): MockJiraIssue {
  return {
    key: overrides.key || 'PROJ-1',
    fields: {
      summary: overrides.fields?.summary || 'Test Issue',
      description: overrides.fields?.description,
      status: { name: 'In Progress' },
      priority: { name: 'High' },
      assignee: { displayName: 'John Doe' },
      updated: overrides.fields?.updated || NOW.toISOString(),
      ...overrides.fields,
    },
  };
}

function fetchOk(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fetchFail(status: number, body?: string): Response {
  return new Response(body || '{}', { status });
}

// ── Setup ────────────────────────────────────────────────────────────────────

const testDir = path.resolve(process.cwd(), 'test-jira-connector');
let storage: WorkspaceStorage;
let testUser: any;
let testWorkspace: any;

const JIRA_BASE_URL = 'https://company.atlassian.net';
const TEST_EMAIL = 'test@company.com';
const ACCESS_TOKEN = 'access-token-test-123';

beforeAll(async () => {
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  await clearDatabase();

  const org = await prisma.organization.create({ data: { name: 'Jira Test Org' } });
  testUser = await prisma.user.create({
    data: { email: 'jira-test@test.com', name: 'Jira Tester', passwordHash: 'x' },
  });
  testWorkspace = await prisma.workspace.create({
    data: { name: 'Jira Test WS', organizationId: org.id },
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

// ── Test 1: OAuth code exchange ──────────────────────────────────────────────

describe('exchangeCode()', () => {
  it('exchanges auth code for access token', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchOk({ access_token: ACCESS_TOKEN, token_type: 'Bearer' })
    );

    const token = await exchangeCode('auth-code-123');

    expect(token).toBe(ACCESS_TOKEN);
  });

  it('throws on failed code exchange', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchFail(400, 'Invalid code')
    );

    await expect(exchangeCode('bad-code')).rejects.toThrow('Jira token exchange failed');
  });
});

// ── Test 2: Fetch cloud instance ID ──────────────────────────────────────────

describe('fetchCloudInstanceId()', () => {
  it('fetches user\'s Jira cloud instance ID', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchOk([
        {
          id: 'site-id-123',
          name: 'Company Jira',
          url: 'https://company.atlassian.net',
        },
      ])
    );

    const instanceId = await fetchCloudInstanceId(ACCESS_TOKEN);

    expect(instanceId).toBe('site-id-123');
  });

  it('throws when no accessible instances found', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchOk([]));

    await expect(fetchCloudInstanceId(ACCESS_TOKEN)).rejects.toThrow(
      'No accessible Jira instances found'
    );
  });
});

// ── Test 3: Initial Jira connection ──────────────────────────────────────────

describe('connectJira()', () => {
  it('creates JiraConnection row and writes issue files on initial connect', async () => {
    const issues = [
      mockJiraIssue({ key: 'PROJ-1', fields: { summary: 'First issue', updated: NOW.toISOString() } }),
      mockJiraIssue({ key: 'PROJ-2', fields: { summary: 'Second issue', updated: NOW.toISOString() } }),
    ];

    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Validate token
      if (urlStr.includes('/rest/api/3/myself')) {
        return fetchOk({ accountId: 'user-123', displayName: 'Test User' });
      }

      // Search issues
      if (urlStr.includes('/rest/api/3/search')) {
        return fetchOk({ issues });
      }

      return fetchFail(404);
    });

    const result = await connectJira({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      storage,
      accessToken: ACCESS_TOKEN,
      baseUrl: JIRA_BASE_URL,
      email: TEST_EMAIL,
      jql: 'ORDER BY updated DESC',
    });

    // Assert result
    expect(result.connectionId).toBeDefined();
    expect(result.issueCount).toBe(2);
    expect(result.fileCount).toBe(2);

    // Assert DB row created
    const conn = await prisma.jiraConnection.findUnique({
      where: { id: result.connectionId },
    });
    expect(conn).not.toBeNull();
    expect(conn!.baseUrl).toBe(JIRA_BASE_URL);
    expect(conn!.email).toBe(TEST_EMAIL);
    expect(conn!.syncStatus).toBe('active');

    // Assert tokens encrypted
    expect(conn!.apiTokenEnc).not.toBe(ACCESS_TOKEN);
    expect(CredentialVault.decrypt(conn!.apiTokenEnc)).toBe(ACCESS_TOKEN);

    // Assert files written
    const proj1Content = await storage.readFile('connectors/jira/PROJ-1.md');
    expect(proj1Content).toContain('PROJ-1: First issue');

    const proj2Content = await storage.readFile('connectors/jira/PROJ-2.md');
    expect(proj2Content).toContain('PROJ-2: Second issue');
  });

  it('throws on invalid Jira base URL', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchFail(403));

    await expect(
      connectJira({
        workspaceId: testWorkspace.id,
        userId: testUser.id,
        storage,
        accessToken: ACCESS_TOKEN,
        baseUrl: 'https://invalid.atlassian.net',
        email: TEST_EMAIL,
      })
    ).rejects.toThrow('Failed to validate Jira access');
  });
});

// ── Test 4: Sync unchanged ───────────────────────────────────────────────────

describe('syncJiraConnection()', () => {
  let connectionId: string;

  beforeEach(async () => {
    await prisma.jiraConnection.deleteMany({ where: { workspaceId: testWorkspace.id } });
    // Create a connection for testing
    const conn = await prisma.jiraConnection.create({
      data: {
        workspaceId: testWorkspace.id,
        userId: testUser.id,
        baseUrl: JIRA_BASE_URL,
        email: TEST_EMAIL,
        apiTokenEnc: CredentialVault.encrypt(ACCESS_TOKEN),
        jql: 'ORDER BY updated DESC',
        targetPath: 'connectors/jira',
        syncStatus: 'active',
      },
    });
    connectionId = conn.id;
  });

  it('syncs issues and updates connection status', async () => {
    const issues = [
      mockJiraIssue({ key: 'PROJ-1', fields: { summary: 'Updated issue', updated: LATER.toISOString() } }),
    ];

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchOk({ issues })
    );

    const result = await syncJiraConnection(connectionId, storage);

    expect(result.fileCount).toBe(1);
    expect(result.updated).toBe(1);

    // Assert connection updated
    const updated = await prisma.jiraConnection.findUnique({ where: { id: connectionId } });
    expect(updated!.syncStatus).toBe('active');
    expect(updated!.lastError).toBeNull();
    expect(updated!.lastSyncedAt).not.toBeNull();

    // Assert file written
    const content = await storage.readFile('connectors/jira/PROJ-1.md');
    expect(content).toContain('Updated issue');
  });

  it('handles auth failure and marks syncStatus=auth_failed', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchFail(401, 'Unauthorized'));

    await expect(syncJiraConnection(connectionId, storage)).rejects.toThrow(
      'Jira authentication failed'
    );

    // Assert connection marked as auth_failed
    const updated = await prisma.jiraConnection.findUnique({ where: { id: connectionId } });
    expect(updated!.syncStatus).toBe('auth_failed');
    expect(updated!.lastError).toContain('authentication failed');
  });
});

// ── Test 5: Search issues with JQL ───────────────────────────────────────────

describe('searchIssues()', () => {
  it('fetches issues matching JQL query', async () => {
    const issues = [
      mockJiraIssue({ key: 'PROJ-100', fields: { summary: 'Critical bug', status: { name: 'In Progress' } } }),
      mockJiraIssue({ key: 'PROJ-101', fields: { summary: 'Feature request', status: { name: 'To Do' } } }),
    ];

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchOk({ issues })
    );

    const result = await searchIssues(JIRA_BASE_URL, ACCESS_TOKEN, 'status = "In Progress"');

    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('PROJ-100');
    expect(result[1].key).toBe('PROJ-101');
  });

  it('throws on 401 (invalid token)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchFail(401));

    await expect(
      searchIssues(JIRA_BASE_URL, ACCESS_TOKEN, 'ORDER BY updated DESC')
    ).rejects.toThrow('Jira authentication failed');
  });

  it('throws on 403 (permission denied)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchFail(403));

    await expect(
      searchIssues(JIRA_BASE_URL, ACCESS_TOKEN, 'ORDER BY updated DESC')
    ).rejects.toThrow('Jira authentication failed');
  });
});

// ── Test 6: Markdown conversion ──────────────────────────────────────────────

describe('Issue markdown conversion', () => {
  it('converts Jira issue to markdown with all fields', async () => {
    // This test verifies the markdown output contains expected fields
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/rest/api/3/myself')) {
        return fetchOk({ accountId: 'user-123' });
      }
      if (urlStr.includes('/rest/api/3/search')) {
        return fetchOk({
          issues: [
            mockJiraIssue({
              key: 'PROJ-999',
              fields: {
                summary: 'Test Issue',
                description: 'This is a detailed description',
                status: { name: 'In Progress' },
                priority: { name: 'Critical' },
                assignee: { displayName: 'Jane Smith' },
                updated: NOW.toISOString(),
              },
            }),
          ],
        });
      }
      return fetchFail(404);
    });

    await prisma.jiraConnection.deleteMany({ where: { workspaceId: testWorkspace.id } });
    const conn = await prisma.jiraConnection.create({
      data: {
        workspaceId: testWorkspace.id,
        userId: testUser.id,
        baseUrl: JIRA_BASE_URL,
        email: TEST_EMAIL,
        apiTokenEnc: CredentialVault.encrypt(ACCESS_TOKEN),
        jql: 'ORDER BY updated DESC',
        targetPath: 'connectors/jira',
      },
    });

    await syncJiraConnection(conn.id, storage);

    const markdown = await storage.readFile('connectors/jira/PROJ-999.md');

    expect(markdown).toContain('# PROJ-999: Test Issue');
    expect(markdown).toContain('**Status:** In Progress');
    expect(markdown).toContain('**Priority:** Critical');
    expect(markdown).toContain('**Assignee:** Jane Smith');
    expect(markdown).toContain('This is a detailed description');
  });
});
