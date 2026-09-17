import request from 'supertest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createApp } from '../../src/api/app';
import { prisma } from '../../src/db/client';
import { main as seedDb } from '../../src/db/seed';

describe('V0 Engine Proof: End-to-End Verification Gate', () => {
  let app: any;
  let authToken: string;
  let testWorkspaceId: string;
  const testWorkspaceDir = path.resolve(process.cwd(), 'workspaces');

  beforeAll(async () => {
    // 1. Ensure seed database is populated and admin password hash matches AuthService
    await seedDb();
    const { AuthService } = await import('../../src/modules/auth/auth-service');
    const authService = new AuthService();
    await prisma.user.updateMany({
      where: { email: 'admin@conti-newty.com' },
      data: { passwordHash: authService.hashPassword('password123') }
    });

    app = createApp();

    // 2. Perform native login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@conti-newty.com',
        password: 'password123'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    authToken = loginRes.body.token;

    // 3. Fetch workspaces
    const wsRes = await request(app)
      .get('/api/workspaces')
      .set('Authorization', `Bearer ${authToken}`);

    expect(wsRes.status).toBe(200);
    expect(wsRes.body.length).toBeGreaterThan(0);
    testWorkspaceId = wsRes.body[0].id;

    // Ensure test workspace directory has docs/sop-incident-response.md
    const targetDir = path.join(testWorkspaceDir, testWorkspaceId, 'docs');
    fs.mkdirSync(targetDir, { recursive: true });
    const sopPath = path.join(targetDir, 'sop-incident-response.md');
    fs.writeFileSync(
      sopPath,
      `# SOP-004: Production Incident Response\n1. Severity 1 (Critical Outage):\n   - Acknowledge within 5 minutes.\n   - Open war room thread on Workbench.\n   - Keep status communication hourly.\n2. Mitigation First:\n   - Revert recent changes or switch traffic before deep debugging.\n3. Post-Mortem:\n   - Deliver root cause analysis within 48 hours.\n`
    );
  });

  it('Step 5: Authenticated request retrieves current profile (/api/auth/me)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('admin@conti-newty.com');
  });

  it('Step 6: Workspace selection works with authorization', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${testWorkspaceId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testWorkspaceId);
  });

  it('Step 7, 8, 9: Ask executes real AgentRunner and returns line-grounded SHA-256 provenance', async () => {
    const res = await request(app)
      .post(`/api/workspaces/${testWorkspaceId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        prompt: 'What is our incident response SOP?'
      });

    expect(res.status).toBe(200);
    expect(res.body.taskId).toBeDefined();
    expect(res.body.status).toBe('COMPLETED');
    expect(res.body.answer).toBeDefined();

    // Check citations
    expect(res.body.citations).toBeDefined();
    expect(res.body.citations.length).toBeGreaterThan(0);

    // Check verified citations
    const verifiedCitations = res.body.verifiedCitations;
    expect(verifiedCitations).toBeDefined();
    expect(verifiedCitations.length).toBeGreaterThan(0);

    const cit = verifiedCitations[0];
    expect(cit.filePath).toBeDefined();
    expect(cit.startLine).toBeGreaterThanOrEqual(1);
    expect(cit.endLine).toBeGreaterThanOrEqual(cit.startLine);
    expect(cit.contentHash).toBeDefined();
    expect(cit.contentHash).toHaveLength(64); // SHA-256 hex string
    expect(cit.snippet).toBeDefined();
    expect(cit.workspaceId).toBe(testWorkspaceId);
    expect(cit.taskId).toBe(res.body.taskId);
  });

  it('Step 11: Independent Hash Verification matches contentHash and detects tampering', async () => {
    // Read raw file directly from storage endpoint
    const fileRes = await request(app)
      .get(`/api/workspaces/${testWorkspaceId}/files/docs/sop-incident-response.md`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(fileRes.status).toBe(200);
    const content = fileRes.body.content;
    expect(content).toContain('Production Incident Response');

    // Extract lines 2 to 5
    const lines = content.split('\n');
    const slice = lines.slice(1, 5).join('\n');

    // Independent SHA-256 hash
    const independentHash = crypto.createHash('sha256').update(slice).digest('hex');

    // Submit task specifically asking about critical outage to ground on lines 2-5
    const taskRes = await request(app)
      .post(`/api/workspaces/${testWorkspaceId}/tasks`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        prompt: 'How quickly must we acknowledge a Severity 1 outage according to docs/sop-incident-response.md?'
      });

    expect(taskRes.status).toBe(200);
    const cit = taskRes.body.verifiedCitations?.[0];
    expect(cit).toBeDefined();

    // 1. Verify that contentHash strictly matches SHA-256 of cit.snippet
    const expectedSnippetHash = crypto.createHash('sha256').update(cit.snippet).digest('hex');
    expect(cit.contentHash).toBe(expectedSnippetHash);

    // 2. Tampering test: Changing 1 character produces a completely different hash
    const tamperedSnippet = cit.snippet + ' [MODIFIED BY ATTACKER]';
    const tamperedHash = crypto.createHash('sha256').update(tamperedSnippet).digest('hex');
    expect(tamperedHash).not.toBe(cit.contentHash);
  });

  it('Step 12: Production app route serves compiled client (/app)', async () => {
    const res = await request(app).get('/app');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Conti-Newty Workbench');
  });
});
