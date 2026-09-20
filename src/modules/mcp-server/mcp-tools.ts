import { WorkspaceStorage } from '../storage/workspace-storage';
import { AuthorizationGuard } from '../auth/authorization-guard';
import { prisma } from '../../db/client';
import {
  searchEntries,
  listEntries,
  TribalMemoryEntryPublic,
} from '../tribal-memory/tribal-memory';

export interface McpToolContext {
  workspaceId: string;
  userId: string;
  storage: WorkspaceStorage;
}

export interface McpToolResult {
  success: boolean;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export class McpToolsHandler {
  private authGuard: AuthorizationGuard;

  constructor(authGuard?: AuthorizationGuard) {
    this.authGuard = authGuard || new AuthorizationGuard();
  }

  /**
   * Logs external MCP tool calls into both ToolExecution and AuditLog tables.
   */
  private async logAudit(
    context: McpToolContext,
    toolName: string,
    args: any,
    result: any,
    isError: boolean,
    errorMessage?: string
  ) {
    try {
      await this.authGuard.logToolExecution({
        userId: context.userId,
        workspaceId: context.workspaceId,
        toolName: `mcp_${toolName}`,
        input: args,
        output: isError ? { error: errorMessage } : result,
        status: isError ? 'FAILURE' : 'SUCCESS',
        allowed: !isError,
      });

      await prisma.auditLog.create({
        data: {
          action: `MCP_${toolName.toUpperCase()}`,
          userId: context.userId,
          workspaceId: context.workspaceId,
          details: JSON.stringify({
            origin: 'MCP_SERVER',
            tool: toolName,
            args,
            status: isError ? 'FAILURE' : 'SUCCESS',
            error: errorMessage || null,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } catch (auditErr: any) {
      console.error(`[MCP Audit Warning] Failed to persist audit trail: ${auditErr?.message}`);
    }
  }

  /**
   * 1. search_brain(workspace_id, query)
   * Wraps file search + Tribal Memory search into a unified response.
   */
  public async searchBrain(
    context: McpToolContext,
    args: { query: string; workspace_id?: string; include_superseded?: boolean }
  ): Promise<McpToolResult> {
    const query = args.query?.trim() || '';
    if (!query) {
      const err = 'Query string is required';
      await this.logAudit(context, 'search_brain', args, null, true, err);
      return {
        success: false,
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: err }) }],
      };
    }

    try {
      // 1. Search Files
      const fileMatches: Array<{ filePath: string; line: number; snippet: string }> = [];
      const searchDirectory = async (relDir: string) => {
        const entries = await context.storage.listDirectory(relDir);
        for (const entry of entries) {
          if (entry.isDirectory) {
            await searchDirectory(entry.path);
          } else {
            try {
              const content = await context.storage.readFile(entry.path);
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                  fileMatches.push({
                    filePath: entry.path,
                    line: i + 1,
                    snippet: lines[i].trim(),
                  });
                }
              }
            } catch {
              // Skip binary or unreadable files
            }
          }
        }
      };
      await searchDirectory('');

      // 2. Search Tribal Memory (defaults to ACTIVE only)
      const tribalResult = await searchEntries({
        workspaceId: context.workspaceId,
        query,
        includeSuperseded: args.include_superseded,
        limit: 20,
      });

      const responsePayload = {
        query,
        workspaceId: context.workspaceId,
        totalFileMatches: fileMatches.length,
        files: fileMatches.slice(0, 50),
        totalTribalMatches: tribalResult.total,
        tribalMemory: tribalResult.entries,
      };

      await this.logAudit(context, 'search_brain', args, responsePayload, false);

      return {
        success: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify(responsePayload, null, 2),
          },
        ],
      };
    } catch (err: any) {
      await this.logAudit(context, 'search_brain', args, null, true, err.message);
      return {
        success: false,
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
      };
    }
  }

  /**
   * 2. get_tribal_memory(workspace_id, tag?, include_superseded?)
   * Reads tribal memory entries for the workspace, optionally filtered by tag.
   */
  public async getTribalMemory(
    context: McpToolContext,
    args: { tag?: string; workspace_id?: string; include_superseded?: boolean }
  ): Promise<McpToolResult> {
    try {
      let entries: TribalMemoryEntryPublic[];
      let total: number;

      if (args.tag && args.tag.trim()) {
        const res = await searchEntries({
          workspaceId: context.workspaceId,
          query: '',
          tags: [args.tag.trim()],
          includeSuperseded: args.include_superseded,
          limit: 100,
        });
        entries = res.entries;
        total = res.total;
      } else {
        const res = await listEntries({
          workspaceId: context.workspaceId,
          includeSuperseded: args.include_superseded,
          limit: 100,
        });
        entries = res.entries;
        total = res.total;
      }

      const responsePayload = {
        workspaceId: context.workspaceId,
        filterTag: args.tag || null,
        total,
        entries,
      };

      await this.logAudit(context, 'get_tribal_memory', args, responsePayload, false);

      return {
        success: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify(responsePayload, null, 2),
          },
        ],
      };
    } catch (err: any) {
      await this.logAudit(context, 'get_tribal_memory', args, null, true, err.message);
      return {
        success: false,
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
      };
    }
  }

  /**
   * 3. list_recent_decisions(workspace_id, since?, include_superseded?)
   * Reads tribal memory entries with tag 'decision', optionally filtered by ISO date 'since'.
   */
  public async listRecentDecisions(
    context: McpToolContext,
    args: { since?: string; workspace_id?: string; include_superseded?: boolean }
  ): Promise<McpToolResult> {
    try {
      const res = await searchEntries({
        workspaceId: context.workspaceId,
        query: '',
        tags: ['decision'],
        includeSuperseded: args.include_superseded,
        limit: 100,
      });

      let decisions = res.entries;
      if (args.since) {
        const sinceDate = new Date(args.since);
        if (!isNaN(sinceDate.getTime())) {
          decisions = decisions.filter(
            (e) => new Date(e.createdAt).getTime() >= sinceDate.getTime()
          );
        }
      }

      const responsePayload = {
        workspaceId: context.workspaceId,
        since: args.since || null,
        total: decisions.length,
        decisions,
      };

      await this.logAudit(context, 'list_recent_decisions', args, responsePayload, false);

      return {
        success: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify(responsePayload, null, 2),
          },
        ],
      };
    } catch (err: any) {
      await this.logAudit(context, 'list_recent_decisions', args, null, true, err.message);
      return {
        success: false,
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
      };
    }
  }

  /**
   * 4. get_file(workspace_id, path)
   * Safe workspace-scoped file retrieval with full path protection.
   */
  public async getFile(
    context: McpToolContext,
    args: { path: string; workspace_id?: string }
  ): Promise<McpToolResult> {
    const filePath = args.path;
    if (!filePath) {
      const err = 'File path is required';
      await this.logAudit(context, 'get_file', args, null, true, err);
      return {
        success: false,
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: err }) }],
      };
    }

    try {
      // Validates safe boundary and throws if traversing outside workspace root
      const safePath = context.storage.resolveSafePath(filePath);
      const exists = await context.storage.fileExists(filePath);

      if (!exists) {
        const err = `File not found: ${filePath}`;
        await this.logAudit(context, 'get_file', args, null, true, err);
        return {
          success: false,
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: err }) }],
        };
      }

      const fs = require('fs');
      const stat = await fs.promises.stat(safePath);
      if (stat.isDirectory()) {
        const err = `Path "${filePath}" is a directory, not a file`;
        await this.logAudit(context, 'get_file', args, null, true, err);
        return {
          success: false,
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ error: err }) }],
        };
      }

      const content = await context.storage.readFile(filePath);
      const responsePayload = {
        workspaceId: context.workspaceId,
        path: filePath,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        content,
      };

      await this.logAudit(context, 'get_file', args, responsePayload, false);

      return {
        success: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify(responsePayload, null, 2),
          },
        ],
      };
    } catch (err: any) {
      await this.logAudit(context, 'get_file', args, null, true, err.message);
      return {
        success: false,
        isError: true,
        content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
      };
    }
  }
}
