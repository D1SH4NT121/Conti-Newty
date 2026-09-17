import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/client';
import { createApp } from '../src/api/app';
import { AuthService } from '../src/modules/auth/auth-service';

describe('Pillar 3.3: Rate Limiting & Lifecycle Teardown', () => {
  let app: any;
  let testOrg: any;
  let testWorkspace: any;
  let userToken: string;
  let userId: string;
  let appWorkspace: any;
  let customStorageDir: string;
  const authService = new AuthService();

  beforeAll(async () => {
    customStorageDir = path.join(process.cwd(), 'tmp-test-storage-pillar3-abuse');
    if (!fs.existsSync(customStorageDir)) {
      fs.mkdirSync(customStorageDir, { recursive: true });
    }

    app = createApp(customStorageDir);

    const user = await prisma.user.create({
      data: {
        email: `pillar3-abuse-${Date.now()}@continewty.internal`,
        name: 'Abuse Test User',
        passwordHash: 'hash'
      }
    });
    userId = user.id;
    userToken = authService.generateToken({ userId: user.id, email: user.email, name: user.name });

    testOrg = await prisma.organization.create({
      data: { name: 'Pillar 3 Abuse Org' }
    });

    testWorkspace = await prisma.workspace.create({
      data: {
        name: 'Pillar 3 Abuse Workspace',
        organizationId: testOrg.id
      }
    });

    await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: testWorkspace.id,
        role: 'OWNER'
      }
    });

    appWorkspace = await prisma.appWorkspace.create({
      data: {
        name: 'Lifecycle App',
        description: 'Testing 410 teardown',
        workspaceId: testWorkspace.id
      }
    });

    await prisma.appDeployment.create({
      data: {
        version: '1.0.0',
        status: 'DEPLOYED',
        appWorkspaceId: appWorkspace.id
      }
    });

    const appDir = path.join(customStorageDir, testWorkspace.id, 'apps', appWorkspace.id);
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'index.html'), '<html><body>Live App</body></html>', 'utf-8');
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(customStorageDir)) {
        fs.rmSync(customStorageDir, { recursive: true, force: true });
      }
      await prisma.appDeployment.deleteMany({ where: { appWorkspaceId: appWorkspace?.id } });
      await prisma.appWorkspace.deleteMany({ where: { workspaceId: testWorkspace?.id } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: testWorkspace?.id } });
      await prisma.workspace.deleteMany({ where: { id: testWorkspace?.id } });
      await prisma.organization.deleteMany({ where: { id: testOrg?.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
    } catch {}
  });

  test('1. Expiring an app deployment causes preview endpoint to return HTTP 410 Gone immediately', async () => {
    // First verify it's active
    const activeRes = await request(app)
      .get(`/api/workspaces/${testWorkspace.id}/apps/${appWorkspace.id}/preview/index.html`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(activeRes.status).toBe(200);

    // Expire the deployment via expire endpoint
    const expireRes = await request(app)
      .post(`/api/workspaces/${testWorkspace.id}/apps/${appWorkspace.id}/expire`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(expireRes.status).toBe(200);
    expect(expireRes.body.success).toBe(true);

    // Subsequent preview requests must return 410 Gone
    const expiredPreviewRes = await request(app)
      .get(`/api/workspaces/${testWorkspace.id}/apps/${appWorkspace.id}/preview/index.html`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(expiredPreviewRes.status).toBe(410);
    expect(expiredPreviewRes.body.error).toMatch(/expired or inactive/i);
  });

  test('2. Rate limiter blocks rapid bursts of app generation requests with HTTP 429', async () => {
    // Max requests is 5 in 1 minute window on POST /
    const responses: any[] = [];
    for (let i = 0; i < 7; i++) {
      const res = await request(app)
        .post(`/api/workspaces/${testWorkspace.id}/apps`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ prompt: `App burst ${i}`, appType: 'dashboard' });
      responses.push(res);
    }

    const rateLimitedResponses = responses.filter(r => r.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(1);
    expect(rateLimitedResponses[0].body.error).toMatch(/rate limit exceeded/i);
  });
});
