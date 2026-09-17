import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { AuthorizationGuard } from '../src/modules/auth/authorization-guard';
import { BrainTools } from '../src/modules/brain/brain-tools';
import { SourceTracker, extractCitations } from '../src/modules/brain/source-grounding';
import { AgentRunner } from '../src/modules/brain/agent-runner';

describe('AI Agent Harness & Brain Tools with Source Grounding', () => {
  const testWorkspaceDir = path.resolve(process.cwd(), 'test-brain-workspace');
  let storage: WorkspaceStorage;
  let authGuard: AuthorizationGuard;
  let brainTools: BrainTools;
  let testUser: any;
  let testWorkspace: any;

  beforeAll(async () => {
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testWorkspaceDir, { recursive: true });

    await clearDatabase();

    const org = await prisma.organization.create({
      data: { name: 'Brain Test Org' }
    });

    testUser = await prisma.user.create({
      data: {
        email: 'agent-dev@brain.com',
        name: 'Agent Dev',
        passwordHash: 'hash123'
      }
    });

    testWorkspace = await prisma.workspace.create({
      data: {
        name: 'Brain Test Workspace',
        organizationId: org.id
      }
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: testWorkspace.id,
        userId: testUser.id,
        role: 'member'
      }
    });

    storage = new WorkspaceStorage(testWorkspace.id, testWorkspaceDir);
    authGuard = new AuthorizationGuard();
    brainTools = new BrainTools(authGuard);

    // Create sample workspace knowledge files
    await storage.createFile('sop.md', '# Standard Operating Procedure\n1. Always verify before push.\n2. Keep logs clean.');
    await storage.createFile('roadmap.md', '# Product Roadmap\nQ1: Multiplayer AI\nQ2: App Cloud');
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(testWorkspaceDir)) {
        fs.rmSync(testWorkspaceDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      }
    } catch {
      // Ignored for Windows transient file locks
    }
    await clearDatabase();
    await prisma.$disconnect();
  });

  describe('Source Grounding & Citation Extraction', () => {
    it('should extract citations from formatted AI output text', () => {
      const text = 'According to [source: sop.md:2-3], always verify before push. Also check [source: roadmap.md].';
      const citations = extractCitations(text);
      expect(citations.length).toBe(2);
      expect(citations[0].filePath).toBe('sop.md');
      expect(citations[0].startLine).toBe(2);
      expect(citations[0].endLine).toBe(3);
      expect(citations[1].filePath).toBe('roadmap.md');
    });

    it('should track accessed files during execution', () => {
      const tracker = new SourceTracker();
      tracker.recordAccess('sop.md', '# Standard Operating Procedure');
      tracker.recordAccess('roadmap.md', '# Product Roadmap');

      const accessed = tracker.getAccessedSources();
      expect(accessed.length).toBe(2);
      expect(accessed.map((s: { filePath: string }) => s.filePath)).toContain('sop.md');
    });
  });

  describe('Brain Tools Execution & Authorization', () => {
    it('should execute list_directory tool with grounded metadata', async () => {
      const result = await brainTools.execute({
        toolName: 'list_directory',
        args: { path: '' },
        context: {
          userId: testUser.id,
          workspaceId: testWorkspace.id,
          storage
        }
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      const names = result.data.map((f: any) => f.name);
      expect(names).toContain('sop.md');
      expect(names).toContain('roadmap.md');
    });

    it('should execute read_file tool and record source access in tracker', async () => {
      const tracker = new SourceTracker();
      const result = await brainTools.execute({
        toolName: 'read_file',
        args: { path: 'sop.md' },
        context: {
          userId: testUser.id,
          workspaceId: testWorkspace.id,
          storage,
          sourceTracker: tracker
        }
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('Standard Operating Procedure');
      expect(tracker.getAccessedSources().length).toBe(1);
      expect(tracker.getAccessedSources()[0].filePath).toBe('sop.md');
    });

    it('should execute search_files tool across workspace', async () => {
      const result = await brainTools.execute({
        toolName: 'search_files',
        args: { query: 'Multiplayer AI' },
        context: {
          userId: testUser.id,
          workspaceId: testWorkspace.id,
          storage
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].filePath).toBe('roadmap.md');
    });
  });

  describe('Agent Task Lifecycle & Execution', () => {
    it('should run an agent task from start to completion with events and citations', async () => {
      const task = await prisma.agentTask.create({
        data: {
          title: 'Review SOP and Roadmap',
          status: 'PENDING',
          createdById: testUser.id,
          workspaceId: testWorkspace.id
        }
      });

      const runner = new AgentRunner(brainTools, storage);
      const events: any[] = [];

      const result = await runner.runTask({
        taskId: task.id,
        workspaceId: testWorkspace.id,
        userId: testUser.id,
        userPrompt: 'What is our Q1 roadmap goal and what does the SOP say?',
        onEvent: (event: any) => events.push(event)
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.answer).toBeDefined();
      expect(events.length).toBeGreaterThan(0);

      // Verify task status in database was updated
      const updatedTask = await prisma.agentTask.findUnique({
        where: { id: task.id },
        include: { events: true }
      });
      expect(updatedTask?.status).toBe('COMPLETED');
      expect(updatedTask?.events.length).toBeGreaterThan(0);
    });
  });
});
