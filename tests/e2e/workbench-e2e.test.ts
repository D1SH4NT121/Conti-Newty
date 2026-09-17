import request from 'supertest';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createApp } from '../../src/api/app';
import { prisma } from '../../src/db/client';
import { clearDatabase } from '../test-utils';
import { AuthService } from '../../src/modules/auth/auth-service';
import { SandboxRunner } from '../../src/modules/app-generator/sandbox-runner';

describe('End-to-End System Verification: Full Lifecycle', () => {
  let app: any;
  let authService: AuthService;
  let sandboxRunner: SandboxRunner;
  let adminToken: string;
  let adminUser: any;
  let memberToken: string;
  let memberUser: any;
  let org: any;
  let workspace: any;
  const e2eStorageDir = path.resolve(process.cwd(), 'test-e2e-workspace');

  beforeAll(async () => {
    if (fs.existsSync(e2eStorageDir)) {
      fs.rmSync(e2eStorageDir, { recursive: true, force: true });
    }
    fs.mkdirSync(e2eStorageDir, { recursive: true });

    authService = new AuthService();
    sandboxRunner = new SandboxRunner();
    app = createApp(e2eStorageDir, sandboxRunner);

    await clearDatabase();

    org = await prisma.organization.create({
      data: { name: 'E2E Enterprise Org' }
    });

    adminUser = await prisma.user.create({
      data: {
        email: 'admin@e2e-workbench.com',
        name: 'Enterprise Admin',
        passwordHash: authService.hashPassword('adminpass123')
      }
    });

    memberUser = await prisma.user.create({
      data: {
        email: 'member@e2e-workbench.com',
        name: 'Enterprise Member',
        passwordHash: authService.hashPassword('memberpass123')
      }
    });

    adminToken = authService.generateToken({
      userId: adminUser.id,
      email: adminUser.email
    });

    memberToken = authService.generateToken({
      userId: memberUser.id,
      email: memberUser.email
    });

    workspace = await prisma.workspace.create({
      data: {
        name: 'Product Engineering Knowledge Base',
        organizationId: org.id
      }
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: adminUser.id,
        role: 'admin'
      }
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: memberUser.id,
        role: 'member'
      }
    });
  });

  afterAll(async () => {
    sandboxRunner.stopAll();
    try {
      if (fs.existsSync(e2eStorageDir)) {
        fs.rmSync(e2eStorageDir, { recursive: true, force: true, maxRetries: 3 });
      }
    } catch {
      // Ignore Windows file lock race
    }
    await clearDatabase();
    await prisma.$disconnect();
  });

  it('Flow 1: Upload and populate workspace knowledge files', async () => {
    // Write architecture specification
    const archRes = await request(app)
      .put(`/api/workspaces/${workspace.id}/files/docs/architecture.md`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        content: '# Architecture Specification\nMicroVM isolation with REST API and WebSockets.'
      });
    expect(archRes.status).toBe(200);

    // Write sales data
    const salesRes = await request(app)
      .put(`/api/workspaces/${workspace.id}/files/data/sales.json`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        content: JSON.stringify({ mrr: 85000, growthRate: '35%', customers: 120 })
      });
    expect(salesRes.status).toBe(200);

    // Verify files listed in workspace
    const listRes = await request(app)
      .get(`/api/workspaces/${workspace.id}/files`)
      .set('Authorization', `Bearer ${memberToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.files.length).toBeGreaterThanOrEqual(2);
  });

  it('Flow 2: AI Agent answers user questions with citations', async () => {
    const taskRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/tasks`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Review System Architecture',
        prompt: 'What is our isolation model and current product goals?'
      });

    expect(taskRes.status).toBe(200);
    expect(taskRes.body.status).toBe('COMPLETED');
    expect(taskRes.body.answer).toBeDefined();
    expect(taskRes.body.citations.length).toBeGreaterThan(0);
  });

  it('Flow 3: AI/Collaborator proposes change, reviewer approves and applies it', async () => {
    // Propose change to architecture doc
    const propRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/changes`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        filePath: 'docs/architecture.md',
        proposedContent: '# Architecture Specification v2.0\nMicroVM and container sandbox isolation.',
        description: 'Upgrade architecture to v2.0'
      });

    expect(propRes.status).toBe(201);
    const changeId = propRes.body.id;

    // Reviewer approves change
    const approveRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/changes/${changeId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.success).toBe(true);

    // Verify updated content on disk
    const readRes = await request(app)
      .get(`/api/workspaces/${workspace.id}/files/docs/architecture.md`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(readRes.status).toBe(200);
    expect(readRes.body.content).toContain('Architecture Specification v2.0');
  });

  it('Flow 4: Generate Small Software Cloud app, deploy sandbox, and fetch live response', async () => {
    const genRes = await request(app)
      .post(`/api/workspaces/${workspace.id}/apps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appName: 'Executive Dashboard',
        prompt: 'Generate an interactive executive sales dashboard',
        appType: 'dashboard'
      });

    expect(genRes.status).toBe(201);
    expect(genRes.body.appWorkspaceId).toBeDefined();
    expect(genRes.body.url).toBeDefined();

    // Verify HTTP GET request directly to deployed sandbox URL
    const html = await new Promise<string>((resolve, reject) => {
      http.get(genRes.body.url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(data));
        res.on('error', reject);
      }).on('error', reject);
    });

    expect(html).toContain('Executive Dashboard');
    expect(html).toContain('Live Workspace Data');
    expect(html).toContain('Metrics Overview');
  });
});
