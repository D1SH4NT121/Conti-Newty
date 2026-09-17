import fs from 'fs';
import path from 'path';
import http from 'http';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { AppGeneratorService } from '../src/modules/app-generator/generator-service';
import { SandboxRunner } from '../src/modules/app-generator/sandbox-runner';
import { validateGeneratedCode } from '../src/modules/app-generator/validator';

describe('App Generation Engine & Isolated Sandbox Cloud', () => {
  const testWorkspaceDir = path.resolve(process.cwd(), 'test-apps-workspace');
  let storage: WorkspaceStorage;
  let generatorService: AppGeneratorService;
  let sandboxRunner: SandboxRunner;
  let testUser: any;
  let testWorkspace: any;

  beforeAll(async () => {
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testWorkspaceDir, { recursive: true });

    await clearDatabase();

    const org = await prisma.organization.create({
      data: { name: 'App Gen Test Org' }
    });

    testUser = await prisma.user.create({
      data: {
        email: 'developer@app-cloud.com',
        name: 'App Dev',
        passwordHash: 'hash123'
      }
    });

    testWorkspace = await prisma.workspace.create({
      data: {
        name: 'Sales & Metrics Workspace',
        organizationId: org.id
      }
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: testWorkspace.id,
        userId: testUser.id,
        role: 'admin'
      }
    });

    storage = new WorkspaceStorage(testWorkspace.id, testWorkspaceDir);
    sandboxRunner = new SandboxRunner();
    generatorService = new AppGeneratorService(storage, sandboxRunner);

    // Create knowledge data files to base app on
    await storage.createFile(
      'data/sales-metrics.json',
      JSON.stringify({
        q1: 150000,
        q2: 240000,
        q3: 310000,
        topProduct: 'Multiplayer Brain Pro'
      })
    );
  });

  afterAll(async () => {
    sandboxRunner.stopAll();
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

  describe('Security Code Validator', () => {
    it('should approve clean generated HTML/JS code', () => {
      const files = {
        'index.html': '<!DOCTYPE html><html><body><h1>Sales Dashboard</h1></body></html>',
        'app.js': 'console.log("Loaded dashboard");'
      };
      const result = validateGeneratedCode(files);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject dangerous code patterns', () => {
      const unsafeFiles = {
        'index.html': '<html><body>Bad</body></html>',
        'server.js': 'require("child_process").execSync("rm -rf /");'
      };
      const result = validateGeneratedCode(unsafeFiles);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('child_process'))).toBe(true);
    });
  });

  describe('App Generation Pipeline', () => {
    it('should generate an app from workspace knowledge and persist deployment in DB', async () => {
      const generated = await generatorService.generateAppFromKnowledge({
        workspaceId: testWorkspace.id,
        userId: testUser.id,
        prompt: 'Generate an interactive sales dashboard displaying quarterly revenue',
        appType: 'dashboard'
      });

      expect(generated.appWorkspaceId).toBeDefined();
      expect(generated.files['index.html']).toBeDefined();
      expect(generated.files['index.html'].toLowerCase()).toContain('sales');

      // Verify records in DB
      const appRecord = await prisma.appWorkspace.findUnique({
        where: { id: generated.appWorkspaceId },
        include: { deployments: true }
      });
      expect(appRecord).not.toBeNull();
      expect(appRecord?.deployments.length).toBe(1);
      expect(appRecord?.deployments[0].status).toBe('DEPLOYED');
    });
  });

  describe('Sandbox Execution & Live Requests', () => {
    it('should launch an isolated sandbox and respond to HTTP GET requests', async () => {
      const testAppDir = path.join(testWorkspaceDir, 'test-sandbox-app');
      fs.mkdirSync(testAppDir, { recursive: true });
      fs.writeFileSync(
        path.join(testAppDir, 'index.html'),
        '<!DOCTYPE html><html><head><title>Sandbox App</title></head><body><div id="root">Live App Running</div></body></html>'
      );

      const deployment = await sandboxRunner.startSandbox('test-app-1', testAppDir);
      expect(deployment.port).toBeGreaterThan(0);
      expect(deployment.url).toContain(`http://localhost:${deployment.port}`);

      // Verify HTTP request to sandbox returns the HTML content
      const html = await new Promise<string>((resolve, reject) => {
        http.get(deployment.url, (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => resolve(data));
          res.on('error', reject);
        }).on('error', reject);
      });

      expect(html).toContain('Live App Running');

      // Stop sandbox
      await sandboxRunner.stopSandbox('test-app-1');
      expect(sandboxRunner.isRunning('test-app-1')).toBe(false);
    });
  });
});
