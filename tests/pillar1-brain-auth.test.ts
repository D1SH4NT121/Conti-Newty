import { prisma } from '../src/db/client';
import { BrainTools } from '../src/modules/brain/brain-tools';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { AuthorizationGuard } from '../src/modules/auth/authorization-guard';
import path from 'path';
import fs from 'fs';

describe('Pillar 1.1: Real Per-Tool-Call Authorization & Audit Trail', () => {
  let orgId: string;
  let workspaceId: string;
  let adminUserId: string;
  let memberUserId: string;
  let storage: WorkspaceStorage;
  let brainTools: BrainTools;
  let taskId: string;

  beforeAll(async () => {
    // 1. Create Organization
    const org = await prisma.organization.create({
      data: { name: 'Pillar 1 Test Org' }
    });
    orgId = org.id;

    // 2. Create Admin User
    const admin = await prisma.user.create({
      data: {
        email: `admin-p1-${Date.now()}@test.internal`,
        name: 'Admin User'
      }
    });
    adminUserId = admin.id;

    // 3. Create Member User B (non-admin)
    const member = await prisma.user.create({
      data: {
        email: `member-b-${Date.now()}@test.internal`,
        name: 'Member User B'
      }
    });
    memberUserId = member.id;

    // 4. Create Workspace
    const ws = await prisma.workspace.create({
      data: {
        name: 'Brain Auth Workspace',
        organizationId: orgId
      }
    });
    workspaceId = ws.id;

    // 5. Assign Memberships
    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: adminUserId,
        role: 'admin'
      }
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId: memberUserId,
        role: 'member'
      }
    });

    // 6. Setup storage files
    storage = new WorkspaceStorage(workspaceId);
    await storage.writeFile('company_overview.md', '# Company Overview\nConti-Newty is a Company Brain.');
    await storage.writeFile('salary.md', '# Confidential Salaries\nFounder: $150,000\nEngineer: $120,000');
    await storage.writeFile('config/immutable.json', '{"locked": true}');

    // 7. Add ReadOnlyPath rule on config/immutable.json
    await prisma.readOnlyPath.create({
      data: {
        workspaceId,
        path: 'config/immutable.json'
      }
    });

    // 8. Create an AgentTask created by Member User B
    const task = await prisma.agentTask.create({
      data: {
        title: 'Review Company Information',
        status: 'RUNNING',
        workspaceId,
        createdById: memberUserId
      }
    });
    taskId = task.id;

    brainTools = new BrainTools(new AuthorizationGuard());
  });

  afterAll(async () => {
    const testDir = path.join(process.cwd(), 'data', 'workspaces', workspaceId);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('1. User B successfully executes list_directory and read_file on public document', async () => {
    // Tool call 1: list_directory
    const listRes = await brainTools.execute({
      toolName: 'list_directory',
      args: { path: '' },
      context: {
        userId: memberUserId,
        workspaceId,
        storage,
        taskId
      }
    });

    expect(listRes.success).toBe(true);
    expect(Array.isArray(listRes.data)).toBe(true);

    // Tool call 2: read_file on company_overview.md
    const readRes = await brainTools.execute({
      toolName: 'read_file',
      args: { path: 'company_overview.md' },
      context: {
        userId: memberUserId,
        workspaceId,
        storage,
        taskId
      }
    });

    expect(readRes.success).toBe(true);
    expect(readRes.data).toContain('Conti-Newty is a Company Brain');
  });

  it('2. Mid-task, User B requests to read salary.md — specifically denied while earlier calls succeeded', async () => {
    // Tool call 3: read_file on salary.md in the SAME task context by Member User B
    const salaryRes = await brainTools.execute({
      toolName: 'read_file',
      args: { path: 'salary.md' },
      context: {
        userId: memberUserId,
        workspaceId,
        storage,
        taskId
      }
    });

    // Must be denied on this exact tool call
    expect(salaryRes.success).toBe(false);
    expect(salaryRes.error).toMatch(/cannot access restricted resource "salary\.md"/i);
  });

  it('3. Admin user executing read_file on salary.md is allowed', async () => {
    const adminReadRes = await brainTools.execute({
      toolName: 'read_file',
      args: { path: 'salary.md' },
      context: {
        userId: adminUserId,
        workspaceId,
        storage,
        taskId
      }
    });

    expect(adminReadRes.success).toBe(true);
    expect(adminReadRes.data).toContain('Confidential Salaries');
  });

  it('4. User B attempting to write to a read-only path is denied at the tool level', async () => {
    const writeReadOnlyRes = await brainTools.execute({
      toolName: 'write_file',
      args: { path: 'config/immutable.json', content: '{"hacked": true}' },
      context: {
        userId: memberUserId,
        workspaceId,
        storage,
        taskId
      }
    });

    expect(writeReadOnlyRes.success).toBe(false);
    expect(writeReadOnlyRes.error).toMatch(/configured as read-only/i);
  });

  it('5. ToolExecution database rows record real userId for every tool call (allowed and denied)', async () => {
    const toolExecutions = await prisma.toolExecution.findMany({
      where: {
        workspaceId,
        agentTaskId: taskId
      },
      orderBy: { createdAt: 'asc' }
    });

    // We ran multiple calls in this task
    expect(toolExecutions.length).toBeGreaterThanOrEqual(4);

    // Assert that every single tool call was logged with the actual requesting userId
    for (const exec of toolExecutions) {
      expect(exec.userId).toBeDefined();
      expect(exec.workspaceId).toBe(workspaceId);
    }

    // Find the salary.md execution record for User B
    const salaryExec = toolExecutions.find(
      (e) => e.toolName === 'read_file' && e.input.includes('salary.md') && e.userId === memberUserId
    );
    expect(salaryExec).toBeDefined();
    expect(salaryExec?.userId).toBe(memberUserId);
    expect(salaryExec?.allowed).toBe(false);
    expect(salaryExec?.status).toBe('FAILURE');

    // Find the allowed company_overview.md execution record for User B
    const overviewExec = toolExecutions.find(
      (e) => e.toolName === 'read_file' && e.input.includes('company_overview.md') && e.userId === memberUserId
    );
    expect(overviewExec).toBeDefined();
    expect(overviewExec?.userId).toBe(memberUserId);
    expect(overviewExec?.allowed).toBe(true);
    expect(overviewExec?.status).toBe('SUCCESS');
  });
});
