/**
 * Relay Mode — cost routing test
 *
 * Asserts that in a 3-step relay:
 *   - step 0 (intermediate) → cheap model for its provider
 *   - step 1 (intermediate) → cheap model for its provider
 *   - step 2 (final)        → strong model for its provider
 *
 * The providers are fully mocked; no real AI calls are made.
 * The model actually passed to each provider's complete() is captured and asserted.
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { BrainTools } from '../src/modules/brain/brain-tools';
import { AuthorizationGuard } from '../src/modules/auth/authorization-guard';
import { AgentRunner, AgentConfig } from '../src/modules/brain/agent-runner';
import { CHEAP_MODEL, STRONG_MODEL } from '../src/modules/brain/providers/types';

// ── Mock CredentialService so resolveApiKey always returns 'test-key' ──────────
jest.mock('../src/modules/auth/credential-service', () => ({
  CredentialService: {
    resolveApiKey: jest.fn().mockResolvedValue('test-key'),
  },
}));

// ── Capture every model value passed into AIClient.complete ──────────────────
const capturedCompleteCalls: Array<{ providerType: string; model: string | undefined }> = [];

jest.mock('../src/modules/brain/ai-client', () => {
  const { CHEAP_MODEL, STRONG_MODEL } = jest.requireActual('../src/modules/brain/providers/types');
  return {
    AIClient: jest.fn().mockImplementation((providerType: string) => ({
      complete: jest.fn().mockImplementation(
        (params: { messages: any[]; systemPrompt?: string; tools?: any[]; model?: string }) => {
          capturedCompleteCalls.push({ providerType, model: params.model });
          const lastUser = [...params.messages].reverse().find((m: any) => m.role === 'user')?.content ?? '';
          return Promise.resolve({
            content: `[mock:${providerType}:${params.model ?? 'default'}] answer for: ${lastUser.slice(0, 40)}`,
            stopReason: 'stop',
            provider: providerType,
          });
        }
      ),
    })),
  };
});

describe('Relay Mode — cost routing', () => {
  const testDir = path.resolve(process.cwd(), 'test-relay-cost-workspace');
  let storage: WorkspaceStorage;
  let brainTools: BrainTools;
  let testUser: any;
  let testWorkspace: any;

  beforeAll(async () => {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(testDir, { recursive: true });

    await clearDatabase();

    const org = await prisma.organization.create({ data: { name: 'Relay Test Org' } });

    testUser = await prisma.user.create({
      data: { email: 'relay@test.com', name: 'Relay Tester', passwordHash: 'x' },
    });

    testWorkspace = await prisma.workspace.create({
      data: { name: 'Relay Test WS', organizationId: org.id },
    });

    await prisma.workspaceMember.create({
      data: { workspaceId: testWorkspace.id, userId: testUser.id, role: 'member' },
    });

    storage = new WorkspaceStorage(testWorkspace.id, testDir);
    await storage.createFile('context.md', '# Context\nRelay mode context document.');

    const authGuard = new AuthorizationGuard();
    brainTools = new BrainTools(authGuard);
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    } catch { /* Windows transient lock */ }
    await clearDatabase();
    await prisma.$disconnect();
  });

  it('routes intermediate steps to cheap model and final step to strong model for a 3-step relay', async () => {
    capturedCompleteCalls.length = 0; // reset capture array

    const task = await prisma.agentTask.create({
      data: {
        title: 'Relay cost routing test task',
        status: 'PENDING',
        createdById: testUser.id,
        workspaceId: testWorkspace.id,
      },
    });

    // 3-step relay: Draft (claude) → Critique (openai) → Finalize (claude)
    // No explicit model on any step — auto cost-routing should apply.
    const agents: AgentConfig[] = [
      { role: 'Drafter',   provider: 'claude' },  // step 0 — intermediate → cheap
      { role: 'Critic',    provider: 'openai' },  // step 1 — intermediate → cheap
      { role: 'Finalizer', provider: 'claude' },  // step 2 — final        → strong
    ];

    const runner = new AgentRunner(brainTools, storage);
    const result = await runner.runTask({
      taskId: task.id,
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      userPrompt: 'Summarize the context document.',
      agents,
    });

    expect(result.status).toBe('COMPLETED');
    expect(capturedCompleteCalls).toHaveLength(3);

    const [step0, step1, step2] = capturedCompleteCalls;

    // Step 0: claude intermediate → CHEAP_MODEL.claude
    expect(step0.providerType).toBe('claude');
    expect(step0.model).toBe(CHEAP_MODEL.claude);

    // Step 1: openai intermediate → CHEAP_MODEL.openai
    expect(step1.providerType).toBe('openai');
    expect(step1.model).toBe(CHEAP_MODEL.openai);

    // Step 2: claude final → STRONG_MODEL.claude
    expect(step2.providerType).toBe('claude');
    expect(step2.model).toBe(STRONG_MODEL.claude);
  });

  it('respects explicit model override on a step, ignoring auto cost-routing', async () => {
    capturedCompleteCalls.length = 0;

    const task = await prisma.agentTask.create({
      data: {
        title: 'Relay explicit model override test',
        status: 'PENDING',
        createdById: testUser.id,
        workspaceId: testWorkspace.id,
      },
    });

    // Intermediate step has explicit model override — should NOT be substituted with cheap
    const agents: AgentConfig[] = [
      { role: 'Specialist', provider: 'openai', model: 'gpt-4o' }, // explicit override
      { role: 'Finalizer',  provider: 'openai' },                  // final → strong
    ];

    const runner = new AgentRunner(brainTools, storage);
    await runner.runTask({
      taskId: task.id,
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      userPrompt: 'Explain the relay model override.',
      agents,
    });

    expect(capturedCompleteCalls).toHaveLength(2);

    const [step0, step1] = capturedCompleteCalls;

    // Step 0 has explicit model: should be exactly 'gpt-4o', NOT gpt-4o-mini
    expect(step0.model).toBe('gpt-4o');

    // Step 1 final: should be STRONG_MODEL.openai
    expect(step1.model).toBe(STRONG_MODEL.openai);
  });
});
