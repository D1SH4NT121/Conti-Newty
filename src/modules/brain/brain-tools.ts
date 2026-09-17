import path from 'path';
import fs from 'fs';
import { WorkspaceStorage } from '../storage/workspace-storage';
import { AuthorizationGuard } from '../auth/authorization-guard';
import { SourceTracker } from './source-grounding';

export interface BrainToolContext {
  userId: string;
  workspaceId: string;
  storage: WorkspaceStorage;
  taskId?: string;
  sourceTracker?: SourceTracker;
}

export interface BrainToolExecutionParams {
  toolName: string;
  args: Record<string, any>;
  context: BrainToolContext;
}

export interface BrainToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class BrainTools {
  private authGuard: AuthorizationGuard;

  constructor(authGuard?: AuthorizationGuard) {
    this.authGuard = authGuard || new AuthorizationGuard();
  }

  public getToolDefinitions() {
    return [
      {
        name: 'list_directory',
        description: 'List all files and subdirectories inside a specified workspace path.',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path of directory within workspace (leave empty for root).'
            }
          }
        }
      },
      {
        name: 'read_file',
        description: 'Read the text content of a file in the workspace.',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative file path in the workspace.'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write or overwrite text content to a file in the workspace.',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative file path in the workspace.'
            },
            content: {
              type: 'string',
              description: 'Text content to write.'
            }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'create_file',
        description: 'Create a new file with text content in the workspace.',
        input_schema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative file path in the workspace.'
            },
            content: {
              type: 'string',
              description: 'Initial text content.'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'search_files',
        description: 'Search for text or keywords across all files in the workspace.',
        input_schema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query string.'
            }
          },
          required: ['query']
        }
      }
    ];
  }

  public async execute(params: BrainToolExecutionParams): Promise<BrainToolExecutionResult> {
    const { toolName, args, context } = params;
    const { userId, workspaceId, storage, taskId, sourceTracker } = context;

    // 1. Evaluate Server-side Tool Authorization
    const authResult = await this.authGuard.evaluateToolAuthorization({
      userId,
      workspaceId,
      toolName,
      resourcePath: args?.path,
      taskId
    });

    if (!authResult.allowed) {
      await this.authGuard.logToolExecution({
        userId,
        workspaceId,
        toolName,
        taskId,
        input: args,
        status: 'FAILURE',
        allowed: false,
        output: { error: authResult.reason }
      });
      return {
        success: false,
        error: authResult.reason || 'Unauthorized tool execution'
      };
    }

    try {
      let resultData: any;

      switch (toolName) {
        case 'list_directory': {
          const dirPath = args?.path || '';
          resultData = await storage.listDirectory(dirPath);
          break;
        }

        case 'read_file': {
          if (!args?.path) {
            throw new Error('File path is required for read_file');
          }
          resultData = await storage.readFile(args.path);
          if (sourceTracker) {
            sourceTracker.recordAccess(args.path, resultData, undefined, undefined, {
              workspaceId,
              taskId
            });
          }
          break;
        }

        case 'write_file': {
          if (!args?.path) {
            throw new Error('File path is required for write_file');
          }
          await storage.writeFile(args.path, args.content ?? '');
          resultData = { message: `File "${args.path}" successfully written.` };
          break;
        }

        case 'create_file': {
          if (!args?.path) {
            throw new Error('File path is required for create_file');
          }
          await storage.createFile(args.path, args.content ?? '');
          resultData = { message: `File "${args.path}" successfully created.` };
          break;
        }

        case 'search_files': {
          const query = (args?.query || '').toLowerCase();
          const matches: Array<{ filePath: string; line: number; content: string }> = [];

          const searchRecursive = async (currentRelDir: string) => {
            const entries = await storage.listDirectory(currentRelDir);
            for (const entry of entries) {
              if (entry.isDirectory) {
                await searchRecursive(entry.path);
              } else {
                try {
                  const content = await storage.readFile(entry.path);
                  const lines = content.split('\n');
                  for (let idx = 0; idx < lines.length; idx++) {
                    if (lines[idx].toLowerCase().includes(query)) {
                      matches.push({
                        filePath: entry.path,
                        line: idx + 1,
                        content: lines[idx].trim()
                      });
                    }
                  }
                  if (lines.some((l) => l.toLowerCase().includes(query)) && sourceTracker) {
                    sourceTracker.recordAccess(entry.path, content, undefined, undefined, {
                      workspaceId,
                      taskId
                    });
                  }
                } catch {
                  // Skip non-text or unreadable files
                }
              }
            }
          };

          await searchRecursive('');
          resultData = matches;
          break;
        }

        default:
          throw new Error(`Unknown brain tool: "${toolName}"`);
      }

      await this.authGuard.logToolExecution({
        userId,
        workspaceId,
        toolName,
        taskId,
        input: args,
        output: resultData,
        status: 'SUCCESS',
        allowed: true
      });

      return {
        success: true,
        data: resultData
      };
    } catch (err: any) {
      await this.authGuard.logToolExecution({
        userId,
        workspaceId,
        toolName,
        taskId,
        input: args,
        status: 'FAILURE',
        allowed: true,
        output: { error: err.message }
      });
      return {
        success: false,
        error: err.message
      };
    }
  }
}
