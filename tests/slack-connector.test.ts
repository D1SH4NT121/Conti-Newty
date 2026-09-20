/**
 * Slack Connector Tests — mocked Slack OAuth + API
 *
 * All Slack API HTTP calls are intercepted via jest.spyOn(global, 'fetch').
 * No real network requests are made.
 *
 * Cases:
 *   1. OAuth code exchange → returns access token
 *   2. Fetch workspace info → returns workspace ID and team name
 *   3. List channels → returns accessible channels
 *   4. Initial Slack connection → creates SlackConnection row, fetches messages, writes files
 *   5. Sync raw format → writes all messages chronologically
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
  fetchSlackWorkspaceInfo,
  listChannels,
  connectSlack,
  syncSlackConnection,
  searchMessages,
  channelToMarkdown,
} from '../src/modules/connectors/slack-connector';

// ── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-09-18T10:00:00.000Z');
const LATER = new Date('2026-09-18T12:00:00.000Z');

interface MockSlackMessage {
  type: string;
  user?: string;
  text: string;
  ts: string;
  thread_ts?: string;
}

function mockSlackMessage(overrides: Partial<MockSlackMessage> = {}): MockSlackMessage {
  return {
    type: 'message',
    user: overrides.user || 'U123456',
    text: overrides.text || 'Test message',
    ts: overrides.ts || (NOW.getTime() / 1000).toString(),
    ...overrides,
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

const testDir = path.resolve(process.cwd(), 'test-slack-connector');
let storage: WorkspaceStorage;
let testUser: any;
let testWorkspace: any;

const SLACK_WORKSPACE_ID = 'T0123456789';
const SLACK_TEAM_NAME = 'Test Company';
const ACCESS_TOKEN = 'xoxb-slack-token-123';
const CHANNEL_ID_1 = 'C0123456789';
const CHANNEL_ID_2 = 'C0234567890';
const USER_ID_1 = 'U0123456789';
const USER_ID_2 = 'U0234567890';

beforeAll(async () => {
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  await clearDatabase();

  const org = await prisma.organization.create({ data: { name: 'Slack Test Org' } });
  testUser = await prisma.user.create({
    data: { email: 'slack-test@test.com', name: 'Slack Tester', passwordHash: 'x' },
  });
  testWorkspace = await prisma.workspace.create({
    data: { name: 'Slack Test WS', organizationId: org.id },
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
      fetchOk({ ok: true, access_token: ACCESS_TOKEN })
    );

    const token = await exchangeCode('auth-code-123');

    expect(token).toBe(ACCESS_TOKEN);
  });

  it('throws on failed code exchange', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchFail(400, 'Invalid code')
    );

    await expect(exchangeCode('bad-code')).rejects.toThrow('Slack token exchange failed');
  });

  it('throws on API error response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchOk({ ok: false, error: 'invalid_code' })
    );

    await expect(exchangeCode('bad-code')).rejects.toThrow('Slack API error');
  });
});

// ── Test 2: Fetch workspace info ─────────────────────────────────────────────

describe('fetchSlackWorkspaceInfo()', () => {
  it('fetches workspace ID and team name', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchOk({
        ok: true,
        user_id: USER_ID_1,
        team_id: SLACK_WORKSPACE_ID,
        team_name: SLACK_TEAM_NAME,
      })
    );

    const info = await fetchSlackWorkspaceInfo(ACCESS_TOKEN);

    expect(info.workspaceId).toBe(SLACK_WORKSPACE_ID);
    expect(info.teamName).toBe(SLACK_TEAM_NAME);
  });

  it('throws on auth failure', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchFail(401));

    await expect(fetchSlackWorkspaceInfo(ACCESS_TOKEN)).rejects.toThrow(
      'Failed to fetch Slack workspace info'
    );
  });

  it('throws on API error response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchOk({ ok: false, error: 'invalid_auth' })
    );

    await expect(fetchSlackWorkspaceInfo(ACCESS_TOKEN)).rejects.toThrow(
      'Slack workspace fetch failed'
    );
  });
});

// ── Test 3: List channels ────────────────────────────────────────────────────

describe('listChannels()', () => {
  it('lists public and private channels', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      if (urlStr.includes('types=public_channel')) {
        return fetchOk({
          ok: true,
          channels: [
            { id: CHANNEL_ID_1, name: 'general', is_private: false, is_general: true, num_members: 50 },
            { id: 'C1111111111', name: 'random', is_private: false, is_general: false, num_members: 45 },
          ],
        });
      }

      if (urlStr.includes('types=private_channel')) {
        return fetchOk({
          ok: true,
          channels: [
            { id: CHANNEL_ID_2, name: 'secret', is_private: true, is_general: false, num_members: 10 },
          ],
        });
      }

      return fetchFail(404);
    });

    const channels = await listChannels(ACCESS_TOKEN);

    expect(channels).toHaveLength(3);
    expect(channels.some((ch) => ch.name === 'general')).toBe(true);
    expect(channels.some((ch) => ch.name === 'secret')).toBe(true);
  });
});

// ── Test 4: Initial Slack connection ─────────────────────────────────────────

describe('connectSlack()', () => {
  it('creates SlackConnection row and writes message files on initial connect', async () => {
    const messages = [
      mockSlackMessage({ user: USER_ID_1, text: 'First message', ts: (NOW.getTime() / 1000).toString() }),
      mockSlackMessage({ user: USER_ID_2, text: 'Second message', ts: (LATER.getTime() / 1000).toString() }),
    ];

    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Validate token
      if (urlStr.includes('/auth.test')) {
        return fetchOk({ ok: true, user_id: USER_ID_1, team_id: SLACK_WORKSPACE_ID, team_name: SLACK_TEAM_NAME });
      }

      // Fetch messages from channel
      if (urlStr.includes('/conversations.history')) {
        return fetchOk({ ok: true, messages });
      }

      // Get user info
      if (urlStr.includes('/users.info')) {
        return fetchOk({
          ok: true,
          user: { id: USER_ID_1, real_name: 'Alice', profile: { email: 'alice@test.com' } },
        });
      }

      return fetchFail(404);
    });

    const result = await connectSlack({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      storage,
      accessToken: ACCESS_TOKEN,
      slackWorkspaceId: SLACK_WORKSPACE_ID,
      slackTeamName: SLACK_TEAM_NAME,
      channels: [CHANNEL_ID_1],
      archiveFormat: 'raw',
    });

    // Assert result
    expect(result.connectionId).toBeDefined();
    expect(result.messageCount).toBe(2);
    expect(result.fileCount).toBe(1);

    // Assert DB row created
    const conn = await prisma.slackConnection.findUnique({
      where: { id: result.connectionId },
    });
    expect(conn).not.toBeNull();
    expect(conn!.slackWorkspaceId).toBe(SLACK_WORKSPACE_ID);
    expect(conn!.slackTeamName).toBe(SLACK_TEAM_NAME);
    expect(conn!.syncStatus).toBe('active');

    // Assert tokens encrypted
    expect(conn!.accessTokenEnc).not.toBe(ACCESS_TOKEN);
    expect(CredentialVault.decrypt(conn!.accessTokenEnc)).toBe(ACCESS_TOKEN);

    // Assert file written
    const markdown = await storage.readFile(`connectors/slack/channel-${CHANNEL_ID_1}.md`);
    expect(markdown).toContain(`#channel-${CHANNEL_ID_1}`);
    expect(markdown).toContain('First message');
    expect(markdown).toContain('Second message');
  });

  it('throws on invalid Slack workspace', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchFail(401));

    await expect(
      connectSlack({
        workspaceId: testWorkspace.id,
        userId: testUser.id,
        storage,
        accessToken: 'invalid-token',
        slackWorkspaceId: SLACK_WORKSPACE_ID,
        slackTeamName: SLACK_TEAM_NAME,
        channels: [CHANNEL_ID_1],
      })
    ).rejects.toThrow('Failed to validate Slack access');
  });
});

// ── Test 5: Sync with raw format ─────────────────────────────────────────────

describe('syncSlackConnection()', () => {
  let connectionId: string;

  beforeEach(async () => {
    await prisma.slackConnection.deleteMany({
      where: { workspaceId: testWorkspace.id },
    });
    // Create a connection for testing
    const conn = await prisma.slackConnection.create({
      data: {
        workspaceId: testWorkspace.id,
        userId: testUser.id,
        slackWorkspaceId: SLACK_WORKSPACE_ID,
        slackTeamName: SLACK_TEAM_NAME,
        accessTokenEnc: CredentialVault.encrypt(ACCESS_TOKEN),
        channels: JSON.stringify([CHANNEL_ID_1]),
        archiveFormat: 'raw',
        targetPath: 'connectors/slack',
        syncStatus: 'active',
      },
    });
    connectionId = conn.id;
  });

  it('syncs messages and updates connection status', async () => {
    const messages = [
      mockSlackMessage({ user: USER_ID_1, text: 'Message 1', ts: (NOW.getTime() / 1000).toString() }),
      mockSlackMessage({ user: USER_ID_2, text: 'Message 2', ts: (LATER.getTime() / 1000).toString() }),
    ];

    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      if (urlStr.includes('/conversations.history')) {
        return fetchOk({ ok: true, messages });
      }

      if (urlStr.includes('/users.info')) {
        if (urlStr.includes(USER_ID_1)) {
          return fetchOk({
            ok: true,
            user: { id: USER_ID_1, real_name: 'Alice', profile: { email: 'alice@test.com' } },
          });
        }
        if (urlStr.includes(USER_ID_2)) {
          return fetchOk({
            ok: true,
            user: { id: USER_ID_2, real_name: 'Bob', profile: { email: 'bob@test.com' } },
          });
        }
      }

      return fetchFail(404);
    });

    const result = await syncSlackConnection(connectionId, storage);

    expect(result.fileCount).toBe(1);
    expect(result.messageCount).toBe(2);

    // Assert connection updated
    const updated = await prisma.slackConnection.findUnique({ where: { id: connectionId } });
    expect(updated!.syncStatus).toBe('active');
    expect(updated!.lastError).toBeNull();
    expect(updated!.lastSyncedAt).not.toBeNull();

    // Assert file written
    const markdown = await storage.readFile(`connectors/slack/channel-${CHANNEL_ID_1}.md`);
    expect(markdown).toContain('Message 1');
    expect(markdown).toContain('Message 2');
  });

  it('handles auth failure and marks syncStatus=auth_failed', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchFail(401, 'Unauthorized'));

    await expect(syncSlackConnection(connectionId, storage)).rejects.toThrow(
      'Slack authentication failed'
    );

    // Assert connection marked as auth_failed
    const updated = await prisma.slackConnection.findUnique({ where: { id: connectionId } });
    expect(updated!.syncStatus).toBe('auth_failed');
    expect(updated!.lastError).toContain('authentication failed');
  });
});

// ── Test 6: Search messages ──────────────────────────────────────────────────

describe('searchMessages()', () => {
  it('fetches messages from a channel', async () => {
    const messages = [
      mockSlackMessage({ text: 'Hello world', ts: (NOW.getTime() / 1000).toString() }),
      mockSlackMessage({ text: 'How are you?', ts: (LATER.getTime() / 1000).toString() }),
    ];

    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchOk({ ok: true, messages })
    );

    const result = await searchMessages(ACCESS_TOKEN, CHANNEL_ID_1);

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('Hello world');
    expect(result[1].text).toBe('How are you?');
  });

  it('throws on 401 (invalid token)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchFail(401));

    await expect(searchMessages(ACCESS_TOKEN, CHANNEL_ID_1)).rejects.toThrow(
      'Slack authentication failed'
    );
  });

  it('throws on 403 (permission denied)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(fetchFail(403));

    await expect(searchMessages(ACCESS_TOKEN, CHANNEL_ID_1)).rejects.toThrow(
      'Slack authentication failed'
    );
  });

  it('throws on API error response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      fetchOk({ ok: false, error: 'channel_not_found' })
    );

    await expect(searchMessages(ACCESS_TOKEN, CHANNEL_ID_1)).rejects.toThrow(
      'Slack API error'
    );
  });
});

// ── Test 7: Message markdown conversion ──────────────────────────────────────

describe('channelToMarkdown()', () => {
  it('converts messages to markdown raw format with slack permalinks', () => {
    const userMap = new Map([
      [USER_ID_1, 'Alice'],
      [USER_ID_2, 'Bob'],
    ]);

    const messages = [
      mockSlackMessage({ user: USER_ID_1, text: 'First message' }),
      mockSlackMessage({ user: USER_ID_2, text: 'Second message' }),
    ];

    const markdown = channelToMarkdown('general', messages, userMap, 'raw', {
      channelId: CHANNEL_ID_1,
      slackWorkspaceId: SLACK_WORKSPACE_ID,
    });

    expect(markdown).toContain('#general');
    expect(markdown).toContain('**Alice**');
    expect(markdown).toContain('First message');
    expect(markdown).toContain('**Bob**');
    expect(markdown).toContain('Second message');
    // Verify Slack permalinks are present
    expect(markdown).toContain('view in Slack');
    expect(markdown).toContain(`slack.com/archives/${CHANNEL_ID_1}`);
  });

  it('converts messages to markdown threaded format with permalinks', () => {
    const userMap = new Map([
      [USER_ID_1, 'Alice'],
      [USER_ID_2, 'Bob'],
    ]);

    const rootTs = (NOW.getTime() / 1000).toString();
    const replyTs = (LATER.getTime() / 1000).toString();

    const messages = [
      mockSlackMessage({ user: USER_ID_1, text: 'Root message', ts: rootTs }),
      mockSlackMessage({ user: USER_ID_2, text: 'Reply in thread', ts: replyTs, thread_ts: rootTs }),
    ];

    const markdown = channelToMarkdown('general', messages, userMap, 'threaded', {
      channelId: CHANNEL_ID_1,
      slackWorkspaceId: SLACK_WORKSPACE_ID,
    });

    expect(markdown).toContain('#general');
    expect(markdown).toContain('Root message');
    expect(markdown).toContain('Thread:');
    expect(markdown).toContain('Reply in thread');
    // Verify permalinks in threaded format too
    expect(markdown).toContain('view in Slack');
  });
});
