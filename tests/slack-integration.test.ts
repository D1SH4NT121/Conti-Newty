/**
 * Slack Connector Integration Test
 *
 * Simulates end-to-end Slack OAuth flow + connection + sync workflow:
 *   1. User requests auth URL from backend
 *   2. User completes OAuth and receives code
 *   3. User selects channels and archive format
 *   4. Backend exchanges code for token, creates connection, syncs messages
 *   5. Messages written to Brain file tree
 *   6. User manually triggers sync again (should update with new messages)
 *   7. User can list connections and disconnect
 *
 * This test combines router, connector, and database operations.
 */

import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { Express } from 'express';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { CredentialVault } from '../src/modules/auth/credential-vault';
import { createConnectorRouter } from '../src/api/connectors/connector-router';
import { AuthService } from '../src/modules/auth/auth-service';
import { config } from '../src/config';

// ── Setup ────────────────────────────────────────────────────────────────────

const testDir = path.resolve(process.cwd(), 'test-slack-integration');
let app: Express;
let testUser: any;
let testWorkspace: any;
let testToken: string;

const SLACK_WORKSPACE_ID = 'T0123456789';
const SLACK_TEAM_NAME = 'Test Company';
const ACCESS_TOKEN = 'xoxb-slack-token-integration-123';
const AUTH_CODE = 'auth-code-integration-123';
const CHANNEL_ID_1 = 'C0123456789';
const CHANNEL_ID_2 = 'C0234567890';
const USER_ID_1 = 'U0123456789';
const USER_ID_2 = 'U0234567890';

beforeAll(async () => {
  config.slackClientId = 'test-slack-client-id';
  config.slackClientSecret = 'test-slack-client-secret';

  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  await clearDatabase();

  // Create test org, user, workspace
  const org = await prisma.organization.create({ data: { name: 'Slack Integration Org' } });
  testUser = await prisma.user.create({
    data: { email: 'slack-int@test.com', name: 'Slack Integrator', passwordHash: 'x' },
  });
  testWorkspace = await prisma.workspace.create({
    data: { name: 'Slack Integration WS', organizationId: org.id },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: testWorkspace.id, userId: testUser.id, role: 'member' },
  });

  // Create minimal Express app with router for testing
  const express = require('express');
  app = express();
  app.use(express.json());

  // Inject workspace ID into req before connector router
  app.use((req: any, res: any, next: any) => {
    req.workspaceId = testWorkspace.id;
    req.headers['x-workspace-id'] = testWorkspace.id;
    next();
  });

  // Create router with custom storage resolver
  const storageResolver = (workspaceId: string) => new WorkspaceStorage(workspaceId, testDir);
  app.use('/connectors', createConnectorRouter(storageResolver));

  // Generate valid JWT token for testing
  const authService = new AuthService();
  testToken = `Bearer ${authService.generateToken({ userId: testUser.id, email: testUser.email })}`;
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

// ── Integration Test ─────────────────────────────────────────────────────────

describe('Slack Connector - End-to-End Integration', () => {
  it('completes full OAuth → connect → sync workflow', async () => {
    // ── Step 1: Get auth URL ─────────────────────────────────────────────

    const authUrlRes = await request(app)
      .get('/connectors/slack/auth-url')
      .set('Authorization', testToken)
      .expect(200);

    expect(authUrlRes.body.url).toContain('slack.com/oauth/v2/authorize');
    expect(authUrlRes.body.url).toContain('client_id');
    expect(authUrlRes.body.url).toContain('scope');

    // ── Step 2: Mock OAuth code exchange ─────────────────────────────────

    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Token exchange
      if (urlStr.includes('slack.com/api/oauth.v2.access')) {
        return new Response(
          JSON.stringify({
            ok: true,
            access_token: ACCESS_TOKEN,
            team: { id: SLACK_WORKSPACE_ID, name: SLACK_TEAM_NAME },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Validate token (auth.test)
      if (urlStr.includes('/auth.test')) {
        return new Response(
          JSON.stringify({
            ok: true,
            user_id: USER_ID_1,
            team_id: SLACK_WORKSPACE_ID,
            team_name: SLACK_TEAM_NAME,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Fetch channel messages
      if (urlStr.includes('/conversations.history')) {
        return new Response(
          JSON.stringify({
            ok: true,
            messages: [
              {
                type: 'message',
                user: USER_ID_1,
                text: 'First message in channel',
                ts: (new Date('2026-09-18T10:00:00Z').getTime() / 1000).toString(),
              },
              {
                type: 'message',
                user: USER_ID_2,
                text: 'Second message in channel',
                ts: (new Date('2026-09-18T11:00:00Z').getTime() / 1000).toString(),
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Get user info
      if (urlStr.includes('/users.info')) {
        if (urlStr.includes(USER_ID_1)) {
          return new Response(
            JSON.stringify({
              ok: true,
              user: { id: USER_ID_1, real_name: 'Alice', profile: { email: 'alice@test.com' } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (urlStr.includes(USER_ID_2)) {
          return new Response(
            JSON.stringify({
              ok: true,
              user: { id: USER_ID_2, real_name: 'Bob', profile: { email: 'bob@test.com' } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response('{}', { status: 404 });
    });

    // ── Step 3: Connect Slack ────────────────────────────────────────────

    const connectRes = await request(app)
      .post('/connectors/slack/connect')
      .set('Authorization', testToken)
      .send({
        code: AUTH_CODE,
        slackWorkspaceId: SLACK_WORKSPACE_ID,
        slackTeamName: SLACK_TEAM_NAME,
        channels: [CHANNEL_ID_1],
        archiveFormat: 'raw',
      })
      .expect(200);

    expect(connectRes.body.connectionId).toBeDefined();
    expect(connectRes.body.messageCount).toBe(2);
    expect(connectRes.body.fileCount).toBe(1);

    const connectionId = connectRes.body.connectionId;

    // ── Step 4: Verify connection stored in DB ───────────────────────────

    const conn = await prisma.slackConnection.findUnique({
      where: { id: connectionId },
    });

    expect(conn).not.toBeNull();
    expect(conn!.slackWorkspaceId).toBe(SLACK_WORKSPACE_ID);
    expect(conn!.slackTeamName).toBe(SLACK_TEAM_NAME);
    expect(conn!.syncStatus).toBe('active');
    expect(conn!.lastError).toBeNull();
    expect(conn!.lastSyncedAt).not.toBeNull();

    // Token should be encrypted
    expect(conn!.accessTokenEnc).not.toBe(ACCESS_TOKEN);
    expect(CredentialVault.decrypt(conn!.accessTokenEnc)).toBe(ACCESS_TOKEN);

    // ── Step 5: Verify files written to Brain ────────────────────────────

    const storage = new WorkspaceStorage(testWorkspace.id, testDir);

    const channelFile = await storage.readFile(`connectors/slack/channel-${CHANNEL_ID_1}.md`);
    expect(channelFile).toContain(`#channel-${CHANNEL_ID_1}`);
    expect(channelFile).toContain('First message in channel');
    expect(channelFile).toContain('Second message in channel');
    expect(channelFile).toContain('Alice');
    expect(channelFile).toContain('Bob');
    // Verify Slack permalinks are present for citation verification
    expect(channelFile).toContain('view in Slack');
    expect(channelFile).toContain(`slack.com/archives/${CHANNEL_ID_1}`);

    // ── Step 6: List connections ─────────────────────────────────────────

    const listRes = await request(app)
      .get('/connectors/slack/connections')
      .set('Authorization', testToken)
      .expect(200);

    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(connectionId);
    expect(listRes.body[0].slackTeamName).toBe(SLACK_TEAM_NAME);
    expect(listRes.body[0].syncStatus).toBe('active');
    expect(listRes.body[0].archiveFormat).toBe('raw');

    // Tokens should NOT be returned
    expect(listRes.body[0].accessTokenEnc).toBeUndefined();

    // ── Step 7: Sync again ───────────────────────────────────────────────

    const sync1Res = await request(app)
      .post('/connectors/slack/sync')
      .set('Authorization', testToken)
      .send({ connectionId })
      .expect(200);

    expect(sync1Res.body.fileCount).toBe(1);

    // ── Step 8: Disconnect ───────────────────────────────────────────────

    const disconnectRes = await request(app)
      .delete(`/connectors/slack/connections/${connectionId}`)
      .set('Authorization', testToken)
      .expect(200);

    expect(disconnectRes.body.success).toBe(true);

    // ── Step 9: Verify connection deleted ────────────────────────────────

    const deletedConn = await prisma.slackConnection.findUnique({
      where: { id: connectionId },
    });

    expect(deletedConn).toBeNull();

    // ── Step 10: List connections should be empty ────────────────────────

    const listRes2 = await request(app)
      .get('/connectors/slack/connections')
      .set('Authorization', testToken)
      .expect(200);

    expect(listRes2.body).toHaveLength(0);
  });

  it('handles auth failure gracefully', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 })
    );

    const connectRes = await request(app)
      .post('/connectors/slack/connect')
      .set('Authorization', testToken)
      .send({
        code: 'bad-code',
        slackWorkspaceId: SLACK_WORKSPACE_ID,
        slackTeamName: SLACK_TEAM_NAME,
        channels: [CHANNEL_ID_1],
      })
      .expect(400);

    expect(connectRes.body.error).toContain('failed');
  });

  it('validates required fields', async () => {
    // Missing code
    const res1 = await request(app)
      .post('/connectors/slack/connect')
      .set('Authorization', testToken)
      .send({
        slackWorkspaceId: SLACK_WORKSPACE_ID,
        slackTeamName: SLACK_TEAM_NAME,
        channels: [CHANNEL_ID_1],
      })
      .expect(400);

    expect(res1.body.error).toContain('code');

    // Missing slackWorkspaceId
    const res2 = await request(app)
      .post('/connectors/slack/connect')
      .set('Authorization', testToken)
      .send({
        code: AUTH_CODE,
        slackTeamName: SLACK_TEAM_NAME,
        channels: [CHANNEL_ID_1],
      })
      .expect(400);

    expect(res2.body.error).toContain('slackWorkspaceId');

    // Missing channels
    const res3 = await request(app)
      .post('/connectors/slack/connect')
      .set('Authorization', testToken)
      .send({
        code: AUTH_CODE,
        slackWorkspaceId: SLACK_WORKSPACE_ID,
        slackTeamName: SLACK_TEAM_NAME,
      })
      .expect(400);

    expect(res3.body.error).toContain('channels');
  });

  it('prevents duplicate connections (upsert on reconnect)', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      if (urlStr.includes('slack.com/api/oauth.v2.access')) {
        return new Response(
          JSON.stringify({
            ok: true,
            access_token: ACCESS_TOKEN,
            team: { id: SLACK_WORKSPACE_ID, name: SLACK_TEAM_NAME },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/auth.test')) {
        return new Response(
          JSON.stringify({
            ok: true,
            user_id: USER_ID_1,
            team_id: SLACK_WORKSPACE_ID,
            team_name: SLACK_TEAM_NAME,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/conversations.history')) {
        return new Response(
          JSON.stringify({
            ok: true,
            messages: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('{}', { status: 404 });
    });

    // First connection
    const res1 = await request(app)
      .post('/connectors/slack/connect')
      .set('Authorization', testToken)
      .send({
        code: AUTH_CODE,
        slackWorkspaceId: SLACK_WORKSPACE_ID,
        slackTeamName: SLACK_TEAM_NAME,
        channels: [CHANNEL_ID_1],
      })
      .expect(200);

    const connectionId1 = res1.body.connectionId;

    // Reconnect with same workspace (should update, not create new)
    const res2 = await request(app)
      .post('/connectors/slack/connect')
      .set('Authorization', testToken)
      .send({
        code: AUTH_CODE,
        slackWorkspaceId: SLACK_WORKSPACE_ID,
        slackTeamName: SLACK_TEAM_NAME,
        channels: [CHANNEL_ID_1, CHANNEL_ID_2],
        archiveFormat: 'threaded',
      })
      .expect(200);

    const connectionId2 = res2.body.connectionId;

    // Should be same connection (upserted)
    expect(connectionId1).toBe(connectionId2);

    // Verify updated channels
    const conn = await prisma.slackConnection.findUnique({
      where: { id: connectionId2 },
    });

    expect(conn!.channels).toBe(JSON.stringify([CHANNEL_ID_1, CHANNEL_ID_2]));
    expect(conn!.archiveFormat).toBe('threaded');

    // Should only have 1 connection in DB
    const conns = await prisma.slackConnection.findMany({
      where: { workspaceId: testWorkspace.id, slackWorkspaceId: SLACK_WORKSPACE_ID },
    });

    expect(conns).toHaveLength(1);

    // Cleanup
    await prisma.slackConnection.delete({ where: { id: connectionId1 } });
  });

  it('supports threaded archive format', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      if (urlStr.includes('slack.com/api/oauth.v2.access')) {
        return new Response(
          JSON.stringify({
            ok: true,
            access_token: ACCESS_TOKEN,
            team: { id: SLACK_WORKSPACE_ID, name: SLACK_TEAM_NAME },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/auth.test')) {
        return new Response(
          JSON.stringify({
            ok: true,
            user_id: USER_ID_1,
            team_id: SLACK_WORKSPACE_ID,
            team_name: SLACK_TEAM_NAME,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/conversations.history')) {
        const rootTs = '1695038400'; // Root message timestamp
        return new Response(
          JSON.stringify({
            ok: true,
            messages: [
              {
                type: 'message',
                user: USER_ID_1,
                text: 'Root message',
                ts: rootTs,
              },
              {
                type: 'message',
                user: USER_ID_2,
                text: 'Reply in thread',
                ts: '1695041400',
                thread_ts: rootTs,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/users.info')) {
        if (urlStr.includes(USER_ID_1)) {
          return new Response(
            JSON.stringify({
              ok: true,
              user: { id: USER_ID_1, real_name: 'Alice', profile: { email: 'alice@test.com' } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (urlStr.includes(USER_ID_2)) {
          return new Response(
            JSON.stringify({
              ok: true,
              user: { id: USER_ID_2, real_name: 'Bob', profile: { email: 'bob@test.com' } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response('{}', { status: 404 });
    });

    const connectRes = await request(app)
      .post('/connectors/slack/connect')
      .set('Authorization', testToken)
      .send({
        code: AUTH_CODE,
        slackWorkspaceId: SLACK_WORKSPACE_ID,
        slackTeamName: SLACK_TEAM_NAME,
        channels: [CHANNEL_ID_1],
        archiveFormat: 'threaded',
      })
      .expect(200);

    const connectionId = connectRes.body.connectionId;

    // Verify connection has threaded format
    const conn = await prisma.slackConnection.findUnique({
      where: { id: connectionId },
    });

    expect(conn!.archiveFormat).toBe('threaded');

    // Verify file contains threaded structure
    const storage = new WorkspaceStorage(testWorkspace.id, testDir);
    const channelFile = await storage.readFile(`connectors/slack/channel-${CHANNEL_ID_1}.md`);

    expect(channelFile).toContain('Root message');
    expect(channelFile).toContain('Thread:');
    expect(channelFile).toContain('Reply in thread');

    // Cleanup
    await prisma.slackConnection.delete({ where: { id: connectionId } });
  });

  it('supports incremental sync fetching only new messages since last sync', async () => {
    let callCount = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      if (urlStr.includes('slack.com/api/oauth.v2.access')) {
        return new Response(
          JSON.stringify({
            ok: true,
            access_token: ACCESS_TOKEN,
            team: { id: SLACK_WORKSPACE_ID, name: SLACK_TEAM_NAME },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/auth.test')) {
        return new Response(
          JSON.stringify({
            ok: true,
            user_id: USER_ID_1,
            team_id: SLACK_WORKSPACE_ID,
            team_name: SLACK_TEAM_NAME,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (urlStr.includes('/conversations.history')) {
        callCount++;
        // First call (initial sync): return 2 messages
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              ok: true,
              messages: [
                {
                  type: 'message',
                  user: USER_ID_1,
                  text: 'First message',
                  ts: (new Date('2026-09-18T10:00:00Z').getTime() / 1000).toString(),
                },
                {
                  type: 'message',
                  user: USER_ID_2,
                  text: 'Second message',
                  ts: (new Date('2026-09-18T11:00:00Z').getTime() / 1000).toString(),
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        // Second call (incremental sync): only 1 new message
        if (callCount === 2) {
          return new Response(
            JSON.stringify({
              ok: true,
              messages: [
                {
                  type: 'message',
                  user: USER_ID_2,
                  text: 'New message after first sync',
                  ts: (new Date('2026-09-18T13:00:00Z').getTime() / 1000).toString(),
                },
              ],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      if (urlStr.includes('/users.info')) {
        if (urlStr.includes(USER_ID_1)) {
          return new Response(
            JSON.stringify({
              ok: true,
              user: { id: USER_ID_1, real_name: 'Alice', profile: { email: 'alice@test.com' } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (urlStr.includes(USER_ID_2)) {
          return new Response(
            JSON.stringify({
              ok: true,
              user: { id: USER_ID_2, real_name: 'Bob', profile: { email: 'bob@test.com' } },
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      return new Response('{}', { status: 404 });
    });

    // Connect and perform initial sync
    const connectRes = await request(app)
      .post('/connectors/slack/connect')
      .set('Authorization', testToken)
      .send({
        code: AUTH_CODE,
        slackWorkspaceId: SLACK_WORKSPACE_ID,
        slackTeamName: SLACK_TEAM_NAME,
        channels: [CHANNEL_ID_1],
      })
      .expect(200);

    const connectionId = connectRes.body.connectionId;
    expect(connectRes.body.messageCount).toBe(2); // Initial sync: 2 messages

    // Verify lastSyncedAt was set
    let conn = await prisma.slackConnection.findUnique({
      where: { id: connectionId },
    });
    expect(conn!.lastSyncedAt).not.toBeNull();
    const firstSyncTime = conn!.lastSyncedAt;

    // Sync again - should only fetch messages after lastSyncedAt (incremental)
    const sync2Res = await request(app)
      .post('/connectors/slack/sync')
      .set('Authorization', testToken)
      .send({ connectionId })
      .expect(200);

    expect(sync2Res.body.messageCount).toBe(1); // Incremental: 1 new message

    // Verify lastSyncedAt was updated
    conn = await prisma.slackConnection.findUnique({
      where: { id: connectionId },
    });
    expect(conn!.lastSyncedAt?.getTime()).toBeGreaterThan(firstSyncTime!.getTime());

    // Cleanup
    await prisma.slackConnection.delete({ where: { id: connectionId } });
  });
});

