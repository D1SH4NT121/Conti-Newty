import { prisma } from '../../db/client';
import { WorkspaceStorage } from '../storage/workspace-storage';
import { BrainTools } from './brain-tools';
import {
  SourceTracker,
  extractCitations,
  extractVerifiedCitations,
  sanitizeHallucinatedCitations,
  SourceCitation,
  VerifiedSourceCitation
} from './source-grounding';
import { AIClient, AIMessage } from './ai-client';
import { CredentialService } from '../auth/credential-service';
import { CHEAP_MODEL, STRONG_MODEL } from './providers/types';
import { config } from '../../config';

export interface AgentConfig {
  role: string;       // e.g. "Researcher", "Critic", "Summarizer"
  provider: string;   // claude | openai | gemini
  systemPrompt?: string;
  /**
   * Explicit model override for this relay step.
   * If omitted, the runner auto-assigns: cheap model for intermediate steps,
   * strong model for the final step.
   * Pass a full model ID string (e.g. "gpt-4o-mini", "claude-3-haiku-20240307").
   */
  model?: string;
}

export interface RunAgentTaskOptions {
  taskId: string;
  workspaceId: string;
  userId: string;
  userPrompt: string;
  agents?: AgentConfig[];
  onEvent?: (event: { type: string; payload: any }) => void;
  onChunk?: (chunk: string) => void;
}

export interface AgentTurn {
  agentRole: string;
  provider: string;
  answer: string;
  citations: SourceCitation[];
  verifiedCitations: VerifiedSourceCitation[];
}

export interface AgentTaskExecutionResult {
  taskId: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  answer: string;
  citations: SourceCitation[];
  verifiedCitations?: VerifiedSourceCitation[];
  turns?: AgentTurn[];
}

const DEFAULT_AGENTS: AgentConfig[] = [
  { role: 'Researcher', provider: config.aiProvider, systemPrompt: 'You are a research agent. Navigate the Company Brain folder, read relevant files, and answer the question with exact citations in the format [source: path/to/file:lineStart-lineEnd].' }
];

export class AgentRunner {
  private brainTools: BrainTools;
  private storage: WorkspaceStorage;
  private io?: any;

  constructor(brainTools: BrainTools, storage: WorkspaceStorage, _aiClient?: AIClient, io?: any) {
    this.brainTools = brainTools;
    this.storage = storage;
    this.io = io;
  }

  private broadcastTaskEvent(workspaceId: string, taskId: string, type: string, payload: any) {
    if (!this.io) return;
    const event = { taskId, type, payload, ts: Date.now() };
    this.io.to(`workspace:${workspaceId}`).emit('task.event', event);
    this.io.to(`task:${taskId}`).emit('task.event', event);
  }

  private async gatherContext(userId: string, workspaceId: string, taskId: string, sourceTracker: SourceTracker): Promise<string> {
    const toolCtx = { userId, workspaceId, storage: this.storage, taskId, sourceTracker };

    let contextBlocks: string[] = [];
    const collectDirectory = async (relativePath: string): Promise<void> => {
      const dirResult = await this.brainTools.execute({
        toolName: 'list_directory',
        args: { path: relativePath },
        context: toolCtx
      });
      if (!dirResult.success || !Array.isArray(dirResult.data)) return;

      for (const entry of dirResult.data) {
        if (entry.isDirectory) {
          await collectDirectory(entry.path);
          continue;
        }

        const r = await this.brainTools.execute({
          toolName: 'read_file',
          args: { path: entry.path },
          context: toolCtx
        });
        if (r.success && typeof r.data === 'string') {
          contextBlocks.push(`--- FILE: ${entry.path} ---\n${r.data}`);
        }
      }
    };

    await collectDirectory('');
    return contextBlocks.join('\n\n');
  }

  public async runTask(options: RunAgentTaskOptions): Promise<AgentTaskExecutionResult> {
    const { taskId, workspaceId, userId, userPrompt, onEvent } = options;
    const agents = (options.agents && options.agents.length > 0) ? options.agents : DEFAULT_AGENTS;

    await prisma.agentTask.update({ where: { id: taskId }, data: { status: 'RUNNING' } });

    const recordEvent = async (type: string, payload: any) => {
      try { await prisma.agentEvent.create({ data: { agentTaskId: taskId, type, payload: JSON.stringify(payload) } }); } catch {}
      if (onEvent) onEvent({ type, payload });
      this.broadcastTaskEvent(workspaceId, taskId, type, payload);
    };

    await recordEvent('TASK_STARTED', { taskId, prompt: userPrompt, agents: agents.map(a => ({ role: a.role, provider: a.provider })) });

    try {
      const sourceTracker = new SourceTracker();
      const workspaceContext = await this.gatherContext(userId, workspaceId, taskId, sourceTracker);

      await recordEvent('TOOL_EXECUTED', { toolName: 'list_directory', result: { success: true } });

      const turns: AgentTurn[] = [];
      let conversationHistory: AIMessage[] = [];

      for (let i = 0; i < agents.length; i++) {
        const agentCfg = agents[i];
        await recordEvent('AGENT_TURN_STARTED', { agentRole: agentCfg.role, provider: agentCfg.provider, turnIndex: i });

        const apiKey = await CredentialService.resolveApiKey(agentCfg.provider, userId, workspaceId);
        const client = new AIClient(agentCfg.provider, apiKey);

        // Cost routing: explicit model > auto-assign by position.
        // Intermediate steps (not last) default to the cheapest model for the provider;
        // the final step defaults to the strongest model.
        const isFinalStep = i === agents.length - 1;
        const providerKey = agentCfg.provider.toLowerCase() as keyof typeof CHEAP_MODEL;
        const resolvedModel: string | undefined = agentCfg.model
          ? agentCfg.model
          : isFinalStep
            ? (STRONG_MODEL[providerKey] ?? undefined)
            : (CHEAP_MODEL[providerKey] ?? undefined);

        // Build messages: workspace context + prior turns + current prompt
        const priorContext = turns.length > 0
          ? `\n\nPrevious agent turns:\n${turns.map(t => `[${t.agentRole} via ${t.provider}]: ${t.answer}`).join('\n\n')}`
          : '';

        const userMessage: AIMessage = {
          role: 'user',
          content: `WORKSPACE DOCUMENTS:\n${workspaceContext}${priorContext}\n\nUSER QUESTION: ${userPrompt}`
        };

        const messages: AIMessage[] = [...conversationHistory, userMessage];

        const systemPrompt = agentCfg.systemPrompt ||
          `You are the ${agentCfg.role} agent. Always cite sources as [source: path/to/file:lineStart-lineEnd].`;

        const aiResponse = await client.complete({ messages, systemPrompt, tools: this.brainTools.getToolDefinitions(), model: resolvedModel });

        const rawAnswer = aiResponse.content;
        const finalAnswer = sanitizeHallucinatedCitations(rawAnswer, sourceTracker);
        const extractedCitations = extractCitations(finalAnswer, { sourceTracker, workspaceId, taskId });
        const extractedVerifiedCitations = extractVerifiedCitations(finalAnswer, { sourceTracker, workspaceId, taskId });
        const citations = extractedCitations.length > 0
          ? extractedCitations
          : sourceTracker.getAccessedSources();
        const verifiedCitations = extractedVerifiedCitations.length > 0
          ? extractedVerifiedCitations
          : sourceTracker.getVerifiedCitations(workspaceId, taskId);

        const turn: AgentTurn = { agentRole: agentCfg.role, provider: agentCfg.provider, answer: finalAnswer, citations, verifiedCitations };
        turns.push(turn);

        // Add to conversation history so next agent sees this turn
        conversationHistory.push(userMessage);
        conversationHistory.push({ role: 'assistant', content: finalAnswer });

        await recordEvent('AGENT_TURN_COMPLETED', {
          agentRole: agentCfg.role,
          provider: agentCfg.provider,
          model: resolvedModel,
          turnIndex: i,
          answer: finalAnswer,
          citations,
          verifiedCitations
        });
      }

      // Final answer = last agent's turn
      const lastTurn = turns[turns.length - 1];
      const allCitations = turns.flatMap(t => t.citations);
      const allVerified = turns.flatMap(t => t.verifiedCitations);

      await prisma.agentTask.update({ where: { id: taskId }, data: { status: 'COMPLETED' } });

      await recordEvent('TASK_COMPLETED', {
        taskId,
        turns,
        citations: allCitations,
        verifiedCitations: allVerified,
        answer: lastTurn.answer
      });

      return {
        taskId,
        status: 'COMPLETED',
        answer: lastTurn.answer,
        citations: allCitations,
        verifiedCitations: allVerified,
        turns
      };
    } catch (err: any) {
      await prisma.agentTask.update({ where: { id: taskId }, data: { status: 'FAILED' } });
      await recordEvent('TASK_FAILED', { taskId, error: err.message });
      return { taskId, status: 'FAILED', answer: `Error: ${err.message}`, citations: [] };
    }
  }
}
