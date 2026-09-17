import { ThreadTurnQueue } from '../src/modules/brain/thread-turn-queue';
import { AgentRunner } from '../src/modules/brain/agent-runner';
import { BrainTools } from '../src/modules/brain/brain-tools';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { AuthorizationGuard } from '../src/modules/auth/authorization-guard';
import { prisma } from '../src/db/client';
import path from 'path';
import fs from 'fs';

describe('Pillar 2.3: Real Async Steering and Task Queueing', () => {
  const workspaceId = `test-ws-queue-${Date.now()}`;
  const threadId = `thread-async-${Date.now()}`;
  let storage: WorkspaceStorage;
  let runner: AgentRunner;
  let userId: string;
  let task1Id: string;
  let task2Id: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_AI_SIMULATION = 'true';

    storage = new WorkspaceStorage(workspaceId);
    await storage.writeFile('goals.md', '# Goals\nBuild single-agent company brain.');
    await storage.writeFile('budget.md', '# Budget\nTotal: $200k');

    const org = await prisma.organization.create({
      data: { name: 'Queue Test Org' }
    });

    const user = await prisma.user.create({
      data: {
        email: `user-queue-${Date.now()}@test.internal`,
        name: 'Queue User'
      }
    });
    userId = user.id;

    await prisma.workspace.create({
      data: {
        id: workspaceId,
        name: 'Queue Test WS',
        organizationId: org.id
      }
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role: 'admin'
      }
    });

    const t1 = await prisma.agentTask.create({
      data: {
        title: 'Task 1',
        status: 'PENDING',
        workspaceId,
        createdById: userId
      }
    });
    task1Id = t1.id;

    const t2 = await prisma.agentTask.create({
      data: {
        title: 'Task 2',
        status: 'PENDING',
        workspaceId,
        createdById: userId
      }
    });
    task2Id = t2.id;

    const brainTools = new BrainTools(new AuthorizationGuard());
    runner = new AgentRunner(brainTools, storage);
  });

  afterAll(async () => {
    const testDir = path.join(process.cwd(), 'data', 'workspaces', workspaceId);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('1. Rapidly submitted messages are queued and executed sequentially in FIFO order without drops', async () => {
    const queue = ThreadTurnQueue.getInstance();
    queue.clear();

    const turn1Promise = queue.enqueueTurn({
      threadId,
      workspaceId,
      userId,
      prompt: 'Summarize company goals',
      taskId: task1Id,
      runner
    });

    // Immediately submit second message before turn 1 completes
    const turn2Promise = queue.enqueueTurn({
      threadId,
      workspaceId,
      userId,
      prompt: 'Summarize company budget',
      taskId: task2Id,
      runner
    });

    // Await both turn resolutions
    const [result1, result2] = await Promise.all([turn1Promise, turn2Promise]);

    // Assert both produced real results and neither was dropped
    expect(result1).toBeDefined();
    expect(result1.status).toBe('COMPLETED');
    expect(result1.taskId).toBe(task1Id);
    expect(result1.answer).toContain('company goals');

    expect(result2).toBeDefined();
    expect(result2.status).toBe('COMPLETED');
    expect(result2.taskId).toBe(task2Id);
    expect(result2.answer).toContain('company budget');

    // Verify execution history order
    const history = queue.getExecutionHistory(threadId);
    expect(history).toHaveLength(2);
    expect(history[0].taskId).toBe(task1Id);
    expect(history[1].taskId).toBe(task2Id);
  });
});
