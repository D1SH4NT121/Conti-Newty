import request from 'supertest';
import { createApp } from '../../src/api/app';
import { prisma } from '../../src/db/client';

describe('V1 Workspace Lifecycle & Living Filesystem Proof', () => {
  const app = createApp();
  let authToken: string;
  let userId: string;
  let workspaceId: string;
  let exportedZipBase64: string;

  beforeAll(async () => {
    const { main: seedDb } = await import('../../src/db/seed');
    await seedDb();
    const { AuthService } = await import('../../src/modules/auth/auth-service');
    const authService = new AuthService();
    await prisma.user.updateMany({
      where: { email: 'admin@conti-newty.com' },
      data: { passwordHash: authService.hashPassword('password123') }
    });

    // 1. Authenticate with seeded admin
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@conti-newty.com',
        password: 'password123'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeDefined();
    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;
  });

  afterAll(async () => {
    // Cleanup any created test workspaces if needed
    if (workspaceId) {
      await prisma.workspaceMember.deleteMany({ where: { workspaceId } }).catch(() => {});
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test('1. Creates a new workspace with Founder ICM template auto-assigning organizationId', async () => {
    const res = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'V1 Sovereign Core',
        description: 'Living filesystem lifecycle verification',
        template: 'icm'
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('V1 Sovereign Core');
    expect(res.body.organizationId).toBeDefined();
    workspaceId = res.body.id;
  });

  test('2. Lists seeded ICM template files via GET /api/workspaces/:id/files', async () => {
    const res = await request(app)
      .get(`/api/workspaces/${workspaceId}/files`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.files).toBeDefined();
    expect(Array.isArray(res.body.files)).toBe(true);

    const filePaths = res.body.files.map((f: any) => f.path);
    // Should have seeded ICM directories
    expect(filePaths.some((p: string) => p.includes('docs') || p.includes('sops') || p.includes('prompts'))).toBe(true);
  });

  test('3. Writes and updates a document in living filesystem with PUT /api/workspaces/:id/files/*', async () => {
    const docPath = 'sops/system-failover-sop.md';
    const initialContent = `# System Failover Standard Operating Procedure\n\n1. Detect network anomaly.\n2. Trigger isolated failover node.\n3. Verify data provenance.`;

    const writeRes = await request(app)
      .put(`/api/workspaces/${workspaceId}/files/${docPath}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: initialContent });

    expect(writeRes.status).toBe(200);
    expect(writeRes.body.success).toBe(true);

    // Read back and verify
    const readRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/files/${docPath}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.content).toBe(initialContent);
    expect(readRes.body.path).toBe(docPath);
  });

  test('4. Enforces path traversal protection on living filesystem', async () => {
    const badRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/files/../../package.json`)
      .set('Authorization', `Bearer ${authToken}`);

    // Must be blocked
    expect([400, 403, 404, 500]).toContain(badRes.status);
    if (badRes.status === 200) {
      fail('Path traversal succeeded; expected rejection.');
    }
  });

  test('5. Exports entire living workspace as downloadable ZIP archive', async () => {
    const downloadRes = await request(app)
      .get(`/api/workspaces/${workspaceId}/download`)
      .set('Authorization', `Bearer ${authToken}`)
      .responseType('blob');

    expect(downloadRes.status).toBe(200);
    expect(downloadRes.header['content-type']).toContain('application/zip');
    expect(downloadRes.header['content-disposition']).toContain('attachment');
    expect(downloadRes.body.length).toBeGreaterThan(100);

    exportedZipBase64 = Buffer.from(downloadRes.body).toString('base64');
  });

  test('6. Ingests exported ZIP archive into a fresh workspace', async () => {
    // Create new blank workspace
    const newWsRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'V1 Restored Target',
        description: 'Ingested from exported ZIP'
      });

    expect(newWsRes.status).toBe(201);
    const targetWsId = newWsRes.body.id;

    // Upload ZIP base64
    const uploadRes = await request(app)
      .post(`/api/workspaces/${targetWsId}/upload`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ zipBase64: exportedZipBase64 });

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.importedCount).toBeGreaterThan(0);

    // Verify restored file exists in target workspace
    const checkRes = await request(app)
      .get(`/api/workspaces/${targetWsId}/files/sops/system-failover-sop.md`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(checkRes.status).toBe(200);
    expect(checkRes.body.content).toContain('System Failover Standard Operating Procedure');

    // Cleanup target
    await prisma.workspaceMember.deleteMany({ where: { workspaceId: targetWsId } }).catch(() => {});
    await prisma.workspace.delete({ where: { id: targetWsId } }).catch(() => {});
  });
});
