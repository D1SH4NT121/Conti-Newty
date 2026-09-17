import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/client';
import { createApp } from '../src/api/app';
import { AuthService } from '../src/modules/auth/auth-service';

describe('Pillar 3.1 & 3.2: Sandboxed Iframe Runtime, CSP, and Directory Isolation', () => {
  let app: any;
  let testWorkspace: any;
  let testOrg: any;
  let userToken: string;
  let userId: string;
  let appWorkspace: any;
  let customStorageDir: string;
  const authService = new AuthService();

  beforeAll(async () => {
    customStorageDir = path.join(process.cwd(), 'tmp-test-storage-pillar3-iso');
    if (!fs.existsSync(customStorageDir)) {
      fs.mkdirSync(customStorageDir, { recursive: true });
    }

    app = createApp(customStorageDir);

    const user = await prisma.user.create({
      data: {
        email: `pillar3-iso-${Date.now()}@continewty.internal`,
        name: 'Sandbox User',
        passwordHash: 'hash'
      }
    });
    userId = user.id;
    userToken = authService.generateToken({ userId: user.id, email: user.email, name: user.name });

    testOrg = await prisma.organization.create({
      data: { name: 'Pillar 3 Isolation Org' }
    });

    testWorkspace = await prisma.workspace.create({
      data: {
        name: 'Pillar 3 Isolation Workspace',
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

    // Create an app workspace and deployment
    appWorkspace = await prisma.appWorkspace.create({
      data: {
        name: 'Test Sandboxed App',
        description: 'Test sandbox isolation',
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

    // Create app files on disk in the isolated directory
    const appDir = path.join(customStorageDir, testWorkspace.id, 'apps', appWorkspace.id);
    fs.mkdirSync(appDir, { recursive: true });
    fs.writeFileSync(path.join(appDir, 'index.html'), '<!DOCTYPE html><html><body><h1>Isolated App</h1><script src="app.js"></script></body></html>', 'utf-8');
    fs.writeFileSync(path.join(appDir, 'app.js'), 'console.log("Isolated JS executed");', 'utf-8');
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

  test('1. Preview endpoint returns strict Content Security Policy headers (no connect-src, restrictive scripts)', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${testWorkspace.id}/apps/${appWorkspace.id}/preview/index.html`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBeDefined();
    
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'unsafe-inline' 'self'");
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.text).toContain('Isolated App');
  });

  test('2. Preview endpoint denies directory traversal attempts outside app base directory', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${testWorkspace.id}/apps/${appWorkspace.id}/preview/../../../../etc/passwd`)
      .set('Authorization', `Bearer ${userToken}`);

    // Expect either 403 Forbidden (traversal detected) or 404 Not Found (safely sanitized relative path)
    expect([403, 404]).toContain(res.status);
    expect(res.body.error || '').not.toContain('root:');
  });

  test('3. Non-existent file in sandbox returns 404 cleanly', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${testWorkspace.id}/apps/${appWorkspace.id}/preview/missing.js`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Preview file not found/i);
  });
});
