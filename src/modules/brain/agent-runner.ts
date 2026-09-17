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

export interface RunAgentTaskOptions {
  taskId: string;
  workspaceId: string;
  userId: string;
  userPrompt: string;
  onEvent?: (event: { type: string; payload: any }) => void;
  onChunk?: (chunk: string) => void;
}

export interface AgentTaskExecutionResult {
  taskId: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  answer: string;
  citations: SourceCitation[];
  verifiedCitations?: VerifiedSourceCitation[];
}

export class AgentRunner {
  private brainTools: BrainTools;
  private storage: WorkspaceStorage;
  private aiClient: AIClient;

  constructor(brainTools: BrainTools, storage: WorkspaceStorage, aiClient?: AIClient) {
    this.brainTools = brainTools;
    this.storage = storage;
    this.aiClient = aiClient || new AIClient();
  }

  public async runTask(options: RunAgentTaskOptions): Promise<AgentTaskExecutionResult> {
    const { taskId, workspaceId, userId, userPrompt, onEvent, onChunk } = options;
    const sourceTracker = new SourceTracker();

    // 1. Update task status to RUNNING in database
    await prisma.agentTask.update({
      where: { id: taskId },
      data: { status: 'RUNNING' }
    });

    const recordEvent = async (type: string, payload: any) => {
      try {
        await prisma.agentEvent.create({
          data: {
            agentTaskId: taskId,
            type,
            payload: JSON.stringify(payload)
          }
        });
      } catch (err) {
        // Continue if event creation fails
      }
      if (onEvent) {
        onEvent({ type, payload });
      }
    };

    await recordEvent('TASK_STARTED', { taskId, prompt: userPrompt });

    try {
      // 2. Initial discovery: read workspace files for context
      const dirListResult = await this.brainTools.execute({
        toolName: 'list_directory',
        args: { path: '' },
        context: {
          userId,
          workspaceId,
          storage: this.storage,
          taskId,
          sourceTracker
        }
      });

      await recordEvent('TOOL_EXECUTED', {
        toolName: 'list_directory',
        result: dirListResult
      });

      // 3. Search or read relevant files
      const searchResult = await this.brainTools.execute({
        toolName: 'search_files',
        args: { query: '' },
        context: {
          userId,
          workspaceId,
          storage: this.storage,
          taskId,
          sourceTracker
        }
      });

      // Read key files found
      if (dirListResult.success && Array.isArray(dirListResult.data)) {
        for (const file of dirListResult.data) {
          if (!file.isDirectory) {
            await this.brainTools.execute({
              toolName: 'read_file',
              args: { path: file.path },
              context: {
                userId,
                workspaceId,
                storage: this.storage,
                taskId,
                sourceTracker
              }
            });
          }
        }
      }

      // 4. Generate AI Completion
      const resolvedApiKey = await CredentialService.resolveApiKey('claude', userId, workspaceId);
      if (resolvedApiKey) {
        this.aiClient.setProvider('claude', resolvedApiKey);
      }

      const messages: AIMessage[] = [
        {
          role: 'user',
          content: userPrompt
        }
      ];

      const aiResponse = await this.aiClient.complete({
        messages,
        systemPrompt: 'You are an intelligent AI workspace assistant for the Company Brain. Always cite your sources in the format [source: path/to/file:lineStart-lineEnd] or [source: path/to/file].',
        tools: this.brainTools.getToolDefinitions()
      });

      let rawAnswer = aiResponse.content;
      let finalAnswer = sanitizeHallucinatedCitations(rawAnswer, sourceTracker);

      if (onChunk) {
        onChunk(finalAnswer);
      }

      const citations = extractCitations(finalAnswer, { sourceTracker, workspaceId, taskId });
      const verifiedCitations = extractVerifiedCitations(finalAnswer, { sourceTracker, workspaceId, taskId });

      if (citations.length === 0) {
        citations.push(...sourceTracker.getAccessedSources());
      }

      if (verifiedCitations.length === 0) {
        const trackerVerified = sourceTracker.getVerifiedCitations(workspaceId, taskId);
        verifiedCitations.push(...trackerVerified);
      }

      // 5. Update task to COMPLETED in database
      await prisma.agentTask.update({
        where: { id: taskId },
        data: { status: 'COMPLETED' }
      });

      await recordEvent('TASK_COMPLETED', {
        taskId,
        citations,
        verifiedCitations,
        answer: finalAnswer
      });

      return {
        taskId,
        status: 'COMPLETED',
        answer: finalAnswer,
        citations,
        verifiedCitations
      };
    } catch (err: any) {
      await prisma.agentTask.update({
        where: { id: taskId },
        data: { status: 'FAILED' }
      });

      await recordEvent('TASK_FAILED', {
        taskId,
        error: err.message
      });

      return {
        taskId,
        status: 'FAILED',
        answer: `Error executing task: ${err.message}`,
        citations: []
      };
    }
  }
}
