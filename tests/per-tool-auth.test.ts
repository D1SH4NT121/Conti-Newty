import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { AuthorizationGuard } from '../src/modules/auth/authorization-guard';
import { BrainTools } from '../src/modules/brain/brain-tools';

describe('TASK 1: Per-Tool-Call Authorization', () => {
  const testWorkspaceDir = path.resolve(process.cwd(), 'test-per-tool-auth-workspace');
  let storage: WorkspaceStorage;
  let authGuard: AuthorizationGuard;
  let brainTools: BrainTools;
  let userA: any;
  let userB: any;
  let testWorkspace: any;
  let org: any;
  let testTaskId: string;

  beforeAll(async () => {
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testWorkspaceDir, { recursive: true });

    await clearDatabase();

    org = await prisma.organization.create({
      data: { name: 'Per Tool Auth Test Org' }
    });

    userA = await prisma.user.create({
      data: {
        email: 'user-a@test.com',
        name: 'User A (Owner)',
        passwordHash: 'hash123'
      }
    });

    userB = await prisma.user.create({
      data: {
        email: 'user-b@test.com',
        name: 'User B (Viewer)',
        passwordHash: 'hash123'
      }
    });

    testWorkspace = await prisma.workspace.create({
      data: {
        name: 'Per Tool Auth Test Workspace',
        organizationId: org.id
      }
    });

    // Initialize storage FIRST
    storage = new WorkspaceStorage(testWorkspace.id, testWorkspaceDir);

    // User A as owner (can write)
    await prisma.workspaceMember.create({
      data: {
        workspaceId: testWorkspace.id,
        userId: userA.id,
        role: 'owner'
      }
    });

    // User B as viewer (can only read)
    await prisma.workspaceMember.create({
      data: {
        workspaceId: testWorkspace.id,
        userId: userB.id,
        role: 'viewer'
      }
    });

    // Create a file that User B should NOT be able to write to
    await storage.createFile('public.md', '# Public Document\nAnyone can read this.');
    
    // Create a sensitive file - mark it as read-only
    await storage.createFile('secret.md', '# Secret Document\nOnly User A should write this.');
    
    // Mark secret.md as read-only for everyone
    await prisma.readOnlyPath.create({
      data: {
        workspaceId: testWorkspace.id,
        path: 'secret.md'
      }
    });

    // Create a dummy AgentTask for tool execution logging
    const testTask = await prisma.agentTask.create({
      data: {
        title: 'Test Task for Auth',
        description: 'Test',
        status: 'PENDING',
        workspaceId: testWorkspace.id,
        createdById: userA.id
      }
    });
    testTaskId = testTask.id;

    authGuard = new AuthorizationGuard();
    brainTools = new BrainTools(authGuard);
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

  it('should deny User B (viewer) from writing to a file via write_file tool', async () => {
    const result = await brainTools.execute({
      toolName: 'write_file',
      args: { path: 'public.md', content: 'Modified by B' },
      context: {
        userId: userB.id,
        workspaceId: testWorkspace.id,
        storage,
        taskId: testTaskId
      }
    });

    // Viewer role cannot use write tools
    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient role');

    // Verify ToolExecution was logged with allowed: false
    const toolExecutions = await prisma.toolExecution.findMany({
      where: { userId: userB.id, toolName: 'write_file' },
      orderBy: { createdAt: 'desc' }
    });
    expect(toolExecutions.length).toBeGreaterThan(0);
    const lastExec = toolExecutions[0];
    expect(lastExec.allowed).toBe(false);
    expect(lastExec.status).toBe('FAILURE');
  });

  it('should deny User B (viewer) from writing to a read-only file', async () => {
    // User B tries to write to secret.md (which is read-only)
    // The viewer role restriction is checked first, so we get "Insufficient role" before "read-only"
    const result = await brainTools.execute({
      toolName: 'write_file',
      args: { path: 'secret.md', content: 'Attempted modification by B' },
      context: {
        userId: userB.id,
        workspaceId: testWorkspace.id,
        storage,
        taskId: testTaskId
      }
    });

    // Should fail due to viewer role restriction (checked before read-only)
    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient role');

    // Verify ToolExecution was logged with allowed: false
    const toolExecutions = await prisma.toolExecution.findMany({
      where: { userId: userB.id, toolName: 'write_file' },
      orderBy: { createdAt: 'desc' }
    });
    expect(toolExecutions.length).toBeGreaterThan(0);
    const lastExec = toolExecutions[0];
    expect(lastExec.allowed).toBe(false);
    expect(lastExec.status).toBe('FAILURE');
  });

  it('should allow User A (owner) to write to the same file', async () => {
    const result = await brainTools.execute({
      toolName: 'write_file',
      args: { path: 'public.md', content: 'Modified by A' },
      context: {
        userId: userA.id,
        workspaceId: testWorkspace.id,
        storage,
        taskId: testTaskId
      }
    });

    // Owner can write
    expect(result.success).toBe(true);

    // Verify ToolExecution was logged with allowed: true
    const toolExecutions = await prisma.toolExecution.findMany({
      where: { userId: userA.id, toolName: 'write_file' },
      orderBy: { createdAt: 'desc' }
    });
    expect(toolExecutions.length).toBeGreaterThan(0);
    const lastExec = toolExecutions[0];
    expect(lastExec.allowed).toBe(true);
    expect(lastExec.status).toBe('SUCCESS');
  });

  it('should deny any user from writing to a read-only file (secret.md)', async () => {
    // Even User A (owner) should be denied writing to secret.md because it's read-only
    const result = await brainTools.execute({
      toolName: 'write_file',
      args: { path: 'secret.md', content: 'Attempted modification by A' },
      context: {
        userId: userA.id,
        workspaceId: testWorkspace.id,
        storage,
        taskId: testTaskId
      }
    });

    // Should fail due to read-only path restriction regardless of role
    expect(result.success).toBe(false);
    expect(result.error).toContain('read-only');

    // Verify ToolExecution was logged with allowed: false
    const toolExecutions = await prisma.toolExecution.findMany({
      where: { userId: userA.id, toolName: 'write_file' },
      orderBy: { createdAt: 'desc' }
    });
    const lastExec = toolExecutions[0];
    expect(lastExec.allowed).toBe(false);
  });

  it('should allow both users to read the public file', async () => {
    const resultA = await brainTools.execute({
      toolName: 'read_file',
      args: { path: 'public.md' },
      context: {
        userId: userA.id,
        workspaceId: testWorkspace.id,
        storage,
        taskId: testTaskId
      }
    });

    const resultB = await brainTools.execute({
      toolName: 'read_file',
      args: { path: 'public.md' },
      context: {
        userId: userB.id,
        workspaceId: testWorkspace.id,
        storage,
        taskId: testTaskId
      }
    });

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);

    // Both reads should be logged with allowed: true
    const execA = await prisma.toolExecution.findFirst({
      where: { userId: userA.id, toolName: 'read_file', allowed: true },
      orderBy: { createdAt: 'desc' }
    });
    const execB = await prisma.toolExecution.findFirst({
      where: { userId: userB.id, toolName: 'read_file', allowed: true },
      orderBy: { createdAt: 'desc' }
    });
    expect(execA).not.toBeNull();
    expect(execB).not.toBeNull();
  });

  it('should allow User B (viewer) to read the read-only file (read-only only blocks writes)', async () => {
    const result = await brainTools.execute({
      toolName: 'read_file',
      args: { path: 'secret.md' },
      context: {
        userId: userB.id,
        workspaceId: testWorkspace.id,
        storage,
        taskId: testTaskId
      }
    });

    // Viewers can read read-only files
    expect(result.success).toBe(true);
    expect(result.data).toContain('Secret Document');
  });
});