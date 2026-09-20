import { McpToolsHandler, McpToolContext } from './mcp-tools';

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class McpServer {
  private toolsHandler: McpToolsHandler;

  constructor(toolsHandler?: McpToolsHandler) {
    this.toolsHandler = toolsHandler || new McpToolsHandler();
  }

  public getToolDefinitions() {
    return [
      {
        name: 'search_brain',
        description:
          'Search across both workspace files and organizational Tribal Memory entries for matching text, facts, or decisions.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search keywords or natural language query.',
            },
            workspace_id: {
              type: 'string',
              description: 'Optional workspace ID (defaults to authenticated workspace).',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_tribal_memory',
        description:
          'Retrieve structured Tribal Memory knowledge entries (decisions, guidelines, best practices) for the workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            tag: {
              type: 'string',
              description: 'Optional tag filter (e.g., "decision", "architecture", "security").',
            },
            workspace_id: {
              type: 'string',
              description: 'Optional workspace ID (defaults to authenticated workspace).',
            },
          },
        },
      },
      {
        name: 'list_recent_decisions',
        description:
          'List confirmed organizational decisions from Tribal Memory, optionally filtered by date.',
        inputSchema: {
          type: 'object',
          properties: {
            since: {
              type: 'string',
              description: 'Optional ISO timestamp to filter decisions created after this date (e.g. "2026-01-01T00:00:00Z").',
            },
            workspace_id: {
              type: 'string',
              description: 'Optional workspace ID (defaults to authenticated workspace).',
            },
          },
        },
      },
      {
        name: 'get_file',
        description:
          'Read the text content of a file located within the workspace boundary with strict path protection.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Relative path of the target file within the workspace.',
            },
            workspace_id: {
              type: 'string',
              description: 'Optional workspace ID (defaults to authenticated workspace).',
            },
          },
          required: ['path'],
        },
      },
    ];
  }

  public async handleRequest(
    request: JsonRpcRequest,
    context: McpToolContext
  ): Promise<JsonRpcResponse | null> {
    const id = request.id ?? null;

    if (!request.method) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Invalid Request: method is missing' },
      };
    }

    try {
      switch (request.method) {
        case 'initialize': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2024-11-05',
              serverInfo: {
                name: 'conti-newty-brain',
                version: '1.0.0',
              },
              capabilities: {
                tools: {},
                resources: {},
              },
            },
          };
        }

        case 'notifications/initialized': {
          // Client notifications do not require a response
          if (request.id === undefined) {
            return null;
          }
          return { jsonrpc: '2.0', id, result: {} };
        }

        case 'ping': {
          return { jsonrpc: '2.0', id, result: {} };
        }

        case 'tools/list': {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              tools: this.getToolDefinitions(),
            },
          };
        }

        case 'tools/call': {
          const params = request.params || {};
          const toolName = params.name;
          const args = params.arguments || {};

          // Allow overriding target workspace if authorized or matching
          const effectiveContext: McpToolContext = {
            ...context,
            workspaceId: args.workspace_id || context.workspaceId,
          };

          let toolResult;

          switch (toolName) {
            case 'search_brain':
              toolResult = await this.toolsHandler.searchBrain(effectiveContext, args);
              break;
            case 'get_tribal_memory':
              toolResult = await this.toolsHandler.getTribalMemory(effectiveContext, args);
              break;
            case 'list_recent_decisions':
              toolResult = await this.toolsHandler.listRecentDecisions(effectiveContext, args);
              break;
            case 'get_file':
              toolResult = await this.toolsHandler.getFile(effectiveContext, args);
              break;
            default:
              return {
                jsonrpc: '2.0',
                id,
                error: {
                  code: -32601,
                  message: `Method not found: unknown tool "${toolName}"`,
                },
              };
          }

          return {
            jsonrpc: '2.0',
            id,
            result: toolResult,
          };
        }

        default:
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: "${request.method}"`,
            },
          };
      }
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: err.message || 'Internal JSON-RPC server error',
        },
      };
    }
  }
}
