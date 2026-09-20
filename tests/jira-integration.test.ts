/**
 * Jira Connector Integration Test
 *
 * Simulates end-to-end Jira OAuth flow + connection + sync workflow:
 *   1. User requests auth URL from backend
 *   2. User completes OAuth and receives code
 *   3. User provides Jira instance details (baseUrl, email, JQL)
 *   4. Backend exchanges code for token, creates connection, syncs issues
 *   5. Issues written to Brain file tree
 *   6. User manually triggers sync again (should update changed issues)
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

const testDir = path.resolve(process.cwd(), 'test-jira-integration');
let app: Express;
let testUser: any;
let testWorkspace: any;
let testToken: string;

const JIRA_BASE_URL = 'https://company.atlassian.net';
const TEST_EMAIL = 'test@company.com';
const ACCESS_TOKEN = 'access-token-integration-123';
const AUTH_CODE = 'auth-code-integration-123';

beforeAll(async () => {
  config.jiraClientId = 'test-jira-client-id';
  config.jiraClientSecret = 'test-jira-client-secret';

  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  await clearDatabase();

  // Create test org, user, workspace
  const org = await prisma.organization.create({ data: { name: 'Jira Integration Org' } });
  testUser = await prisma.user.create({
    data: { email: 'jira-int@test.com', name: 'Jira Integrator', passwordHash: 'x' },
  });
  testWorkspace = await prisma.workspace.create({
    data: { name: 'Jira Integration WS', organizationId: org.id },
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

describe('Jira Connector - End-to-End Integration', () => {
  it('completes full OAuth → connect → sync workflow', async () => {
    // ── Step 1: Get auth URL ─────────────────────────────────────────────

    const authUrlRes = await request(app)
      .get('/connectors/jira/auth-url')
      .set('Authorization', testToken)
      .expect(200);

    expect(authUrlRes.body.url).toContain('auth.atlassian.com');
    expect(authUrlRes.body.url).toContain('client_id');
    expect(authUrlRes.body.url).toContain('response_type=code');
    expect(decodeURIComponent(authUrlRes.body.url)).toContain('scope=read:jira-work');

    // ── Step 2: Mock OAuth code exchange ─────────────────────────────────

    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();

      // Token exchange
      if (urlStr.includes('oauth2.googleapis.com/token') || urlStr.includes('auth.atlassian.com/oauth/token')) {
        return new Response(JSON.stringify({ access_token: ACCESS_TOKEN, token_type: 'Bearer' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Validate token (myself endpoint)
      if (urlStr.includes('/rest/api/3/myself')) {
        return new Response(
          JSON.stringify({ accountId: 'user-123', displayName: 'Test User', email: TEST_EMAIL }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Search issues
      if (urlStr.includes('/rest/api/3/search')) {
        return new Response(
          JSON.stringify({
            issues: [
              {
                key: 'PROJ-100',
                fields: {
                  summary: 'First Issue',
                  description: 'This is the first issue',
                  status: { name: 'In Progress' },
                  priority: { name: 'High' },
                  assignee: { displayName: 'John Doe' },
                  updated: new Date().toISOString(),
                },
              },
              {
                key: 'PROJ-101',
                fields: {
                  summary: 'Second Issue',
                  description: 'This is the second issue',
                  status: { name: 'To Do' },
                  priority: { name: 'Medium' },
                  assignee: { displayName: 'Jane Smith' },
                  updated: new Date().toISOString(),
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('{}', { status: 404 });
    });

    // ── Step 3: Connect Jira ─────────────────────────────────────────────

    const connectRes = await request(app)
      .post('/connectors/jira/connect')
      .set('Authorization', testToken)
      .send({
        code: AUTH_CODE,
        baseUrl: JIRA_BASE_URL,
        email: TEST_EMAIL,
        jql: 'ORDER BY updated DESC',
      })
      .expect(200);

    expect(connectRes.body.connectionId).toBeDefined();
    expect(connectRes.body.issueCount).toBe(2);
    expect(connectRes.body.fileCount).toBe(2);

    const connectionId = connectRes.body.connectionId;

    // ── Step 4: Verify connection stored in DB ───────────────────────────

    const conn = await prisma.jiraConnection.findUnique({
      where: { id: connectionId },
    });

    expect(conn).not.toBeNull();
    expect(conn!.baseUrl).toBe(JIRA_BASE_URL);
    expect(conn!.email).toBe(TEST_EMAIL);
    expect(conn!.syncStatus).toBe('active');
    expect(conn!.lastError).toBeNull();
    expect(conn!.lastSyncedAt).not.toBeNull();

    // Token should be encrypted
    expect(conn!.apiTokenEnc).not.toBe(ACCESS_TOKEN);
    expect(CredentialVault.decrypt(conn!.apiTokenEnc)).toBe(ACCESS_TOKEN);

    // ── Step 5: Verify files written to Brain ────────────────────────────

    const storage = new WorkspaceStorage(testWorkspace.id, testDir);

    const proj100 = await storage.readFile('connectors/jira/PROJ-100.md');
    expect(proj100).toContain('PROJ-100: First Issue');
    expect(proj100).toContain('In Progress');
    expect(proj100).toContain('This is the first issue');

    const proj101 = await storage.readFile('connectors/jira/PROJ-101.md');
    expect(proj101).toContain('PROJ-101: Second Issue');
    expect(proj101).toContain('To Do');
    expect(proj101).toContain('This is the second issue');

    // ── Step 6: List connections ─────────────────────────────────────────

    const listRes = await request(app)
      .get('/connectors/jira/connections')
      .set('Authorization', testToken)
      .expect(200);

    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(connectionId);
    expect(listRes.body[0].baseUrl).toBe(JIRA_BASE_URL);
    expect(listRes.body[0].email).toBe(TEST_EMAIL);
    expect(listRes.body[0].syncStatus).toBe('active');

    // Tokens should NOT be returned
    expect(listRes.body[0].apiTokenEnc).toBeUndefined();

    // ── Step 7: Sync again (no changes) ──────────────────────────────────

    const sync1Res = await request(app)
      .post('/connectors/jira/sync')
      .set('Authorization', testToken)
      .send({ connectionId })
      .expect(200);

    expect(sync1Res.body.fileCount).toBe(2);

    // ── Step 8: Disconnect ───────────────────────────────────────────────

    const disconnectRes = await request(app)
      .delete(`/connectors/jira/connections/${connectionId}`)
      .set('Authorization', testToken)
      .expect(200);

    expect(disconnectRes.body.success).toBe(true);

    // ── Step 9: Verify connection deleted ────────────────────────────────

    const deletedConn = await prisma.jiraConnection.findUnique({
      where: { id: connectionId },
    });

    expect(deletedConn).toBeNull();

    // ── Step 10: List connections should be empty ────────────────────────

    const listRes2 = await request(app)
      .get('/connectors/jira/connections')
      .set('Authorization', testToken)
      .expect(200);

    expect(listRes2.body).toHaveLength(0);
  });

  it('handles auth failure gracefully', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response('Unauthorized', { status: 401 })
    );

    const connectRes = await request(app)
      .post('/connectors/jira/connect')
      .set('Authorization', testToken)
      .send({
        code: 'bad-code',
        baseUrl: JIRA_BASE_URL,
        email: TEST_EMAIL,
      })
      .expect(400);

    expect(connectRes.body.error).toContain('failed');
  });

  it('validates required fields', async () => {
    // Missing code
    const res1 = await request(app)
      .post('/connectors/jira/connect')
      .set('Authorization', testToken)
      .send({
        baseUrl: JIRA_BASE_URL,
        email: TEST_EMAIL,
      })
      .expect(400);

    expect(res1.body.error).toContain('code');

    // Missing baseUrl
    const res2 = await request(app)
      .post('/connectors/jira/connect')
      .set('Authorization', testToken)
      .send({
        code: AUTH_CODE,
        email: TEST_EMAIL,
      })
      .expect(400);

    expect(res2.body.error).toContain('baseUrl');

    // Missing email
    const res3 = await request(app)
      .post('/connectors/jira/connect')
      .set('Authorization', testToken)
      .send({
        code: AUTH_CODE,
        baseUrl: JIRA_BASE_URL,
      })
      .expect(400);

    expect(res3.body.error).toContain('email');
  });

  it('prevents duplicate connections (upsert on reconnect)', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/rest/api/3/myself')) {
        return new Response(JSON.stringify({ accountId: 'user-123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/rest/api/3/search')) {
        return new Response(JSON.stringify({ issues: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('oauth2.googleapis.com/token') || urlStr.includes('auth.atlassian.com/oauth/token')) {
        return new Response(JSON.stringify({ access_token: ACCESS_TOKEN }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('{}', { status: 404 });
    });

    // First connection
    const res1 = await request(app)
      .post('/connectors/jira/connect')
      .set('Authorization', testToken)
      .send({
        code: AUTH_CODE,
        baseUrl: JIRA_BASE_URL,
        email: TEST_EMAIL,
      })
      .expect(200);

    const connectionId1 = res1.body.connectionId;

    // Reconnect with same instance (should update, not create new)
    const res2 = await request(app)
      .post('/connectors/jira/connect')
      .set('Authorization', testToken)
      .send({
        code: AUTH_CODE,
        baseUrl: JIRA_BASE_URL,
        email: TEST_EMAIL,
      })
      .expect(200);

    const connectionId2 = res2.body.connectionId;

    // Should be same connection (upserted)
    expect(connectionId1).toBe(connectionId2);

    // Should only have 1 connection in DB
    const conns = await prisma.jiraConnection.findMany({
      where: { workspaceId: testWorkspace.id, baseUrl: JIRA_BASE_URL, email: TEST_EMAIL },
    });

    expect(conns).toHaveLength(1);

    // Cleanup
    await prisma.jiraConnection.delete({ where: { id: connectionId1 } });
  });
});
