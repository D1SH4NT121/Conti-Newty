import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/api/app';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { AuthService } from '../src/modules/auth/auth-service';

describe('REST API Routes & Controllers', () => {
  let app: any;
  let authService: AuthService;
  let testUser: any;
  let authToken: string;
  let testOrg: any;
  let testWorkspace: any;
  let sandboxRunner: any;
  const testWorkspaceDir = path.resolve(process.cwd(), 'test-api-workspace');

  beforeAll(async () => {
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testWorkspaceDir, { recursive: true });

    authService = new AuthService();
    const { SandboxRunner } = await import('../src/modules/app-generator/sandbox-runner');
    sandboxRunner = new SandboxRunner();
    app = createApp(testWorkspaceDir, sandboxRunner);

    await clearDatabase();

    testOrg = await prisma.organization.create({
      data: { name: 'API Test Organization' }
    });

    testUser = await prisma.user.create({
      data: {
        email: 'tester@api-workbench.com',
        name: 'API Tester',
        passwordHash: authService.hashPassword('password123')
      }
    });

    authToken = authService.generateToken({
      userId: testUser.id,
      email: testUser.email
    });

    testWorkspace = await prisma.workspace.create({
      data: {
        name: 'Primary API Workspace',
        organizationId: testOrg.id
      }
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: testWorkspace.id,
        userId: testUser.id,
        role: 'admin'
      }
    });
  });

  afterAll(async () => {
    if (sandboxRunner) {
      sandboxRunner.stopAll();
    }
    try {
      if (fs.existsSync(testWorkspaceDir)) {
        fs.rmSync(testWorkspaceDir, { recursive: true, force: true, maxRetries: 3 });
      }
    } catch {
      // Ignore Windows file lock race
    }
    await clearDatabase();
    await prisma.$disconnect();
  });

  describe('Auth Endpoints', () => {
    it('POST /api/auth/login should authenticate user and return token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'tester@api-workbench.com',
          password: 'password123'
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('tester@api-workbench.com');
    });

    it('GET /api/auth/me should return current user profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe(testUser.id);
    });
  });

  describe('Workspace Endpoints', () => {
    it('GET /api/workspaces should list workspaces for user', async () => {
      const res = await request(app)
        .get('/api/workspaces')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('POST /api/workspaces should create a new workspace', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Collaboration Workspace',
          organizationId: testOrg.id
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('New Collaboration Workspace');
    });
  });

  describe('File Management Endpoints', () => {
    it('PUT /api/workspaces/:id/files/* should create/write a file', async () => {
      const res = await request(app)
        .put(`/api/workspaces/${testWorkspace.id}/files/docs/guide.md`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: '# API Workspace Guide\nWelcome to Workbench.' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/workspaces/:id/files/* should read the created file', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${testWorkspace.id}/files/docs/guide.md`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.content).toContain('API Workspace Guide');
    });

    it('GET /api/workspaces/:id/files should list directory files', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${testWorkspace.id}/files`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.files)).toBe(true);
    });
  });

  describe('Threads & Messages Endpoints', () => {
    let createdThreadId: string;

    it('POST /api/workspaces/:id/threads should create a thread', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${testWorkspace.id}/threads`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: 'Feature Planning Thread' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Feature Planning Thread');
      createdThreadId = res.body.id;
    });

    it('POST /api/workspaces/:id/threads/:threadId/messages should post a message', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${testWorkspace.id}/threads/${createdThreadId}/messages`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ content: 'Hello team, let us review the knowledge base.' });

      expect(res.status).toBe(201);
      expect(res.body.content).toContain('knowledge base');
    });
  });

  describe('Agent Task Endpoints', () => {
    it('POST /api/workspaces/:id/tasks should create and run an agent task', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${testWorkspace.id}/tasks`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Analyze Guide',
          prompt: 'Summarize docs/guide.md'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.answer).toBeDefined();
    });
  });

  describe('Small Software Cloud (App Generator) Endpoints', () => {
    it('POST /api/workspaces/:id/apps should generate and deploy a small software app', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${testWorkspace.id}/apps`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          prompt: 'Generate an interactive dashboard for workspace guide metrics',
          appType: 'dashboard'
        });

      expect(res.status).toBe(201);
      expect(res.body.appWorkspaceId).toBeDefined();
      expect(res.body.status).toBe('DEPLOYED');
    });
  });
});
