import { Router, Response } from 'express';
import { WorkspaceStorage } from '../../modules/storage/workspace-storage';
import { McpServer } from '../../modules/mcp-server/mcp-server';
import {
  mcpAuthMiddleware,
  McpAuthenticatedRequest,
  generateWorkspaceMcpToken,
  listWorkspaceMcpTokens,
  revokeMcpToken,
} from '../../modules/mcp-server/mcp-auth';
import {
  authMiddleware,
  requireWorkspaceRole,
  AuthenticatedRequest,
} from '../../middleware/auth-middleware';

export function createMcpRouter(
  storageResolver?: (workspaceId: string) => WorkspaceStorage
): Router {
  const router = Router({ mergeParams: true });
  const mcpServer = new McpServer();

  const getStorage = (workspaceId: string): WorkspaceStorage => {
    if (storageResolver) {
      return storageResolver(workspaceId);
    }
    return new WorkspaceStorage(workspaceId);
  };

  // ── JSON-RPC 2.0 MCP Transport Endpoint ──────────────────────────────────
  // Used by Claude Code, Cursor, Claude Desktop, and external AI agents
  router.post('/', mcpAuthMiddleware, async (req: McpAuthenticatedRequest, res: Response) => {
    try {
      res.setHeader('MCP-Protocol-Version', '2024-11-05');
      res.setHeader('Cache-Control', 'no-store');
      const workspaceId =
        req.mcp?.workspaceId || req.params.workspaceId || req.params.id;
      const userId = req.mcp?.userId || req.user?.id || 'anonymous-mcp';

      if (!workspaceId) {
        return res.status(400).json({
          jsonrpc: '2.0',
          id: req.body?.id ?? null,
          error: { code: -32602, message: 'Workspace context could not be determined' },
        });
      }

      const storage = getStorage(workspaceId);
      const response = await mcpServer.handleRequest(req.body, {
        workspaceId,
        userId,
        storage,
      });

      if (!response) {
        // Notification ack
        return res.status(204).end();
      }

      return res.status(200).json(response);
    } catch (err: any) {
      return res.status(500).json({
        jsonrpc: '2.0',
        id: req.body?.id ?? null,
        error: { code: -32603, message: err.message || 'Internal MCP server error' },
      });
    }
  });

  // ── Token Management Endpoints (Internal Workbench UI) ────────────────────

  // Generate a new workspace MCP token
  router.post(
    '/token',
    authMiddleware,
    requireWorkspaceRole('member'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const workspaceId = req.params.workspaceId || req.params.id;
        const userId = req.user!.id;
        const { label } = req.body || {};

        const tokenRecord = await generateWorkspaceMcpToken(
          workspaceId,
          userId,
          label
        );

        return res.status(201).json(tokenRecord);
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // List existing MCP tokens for this workspace (metadata only)
  router.get(
    '/tokens',
    authMiddleware,
    requireWorkspaceRole('viewer'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const workspaceId = req.params.workspaceId || req.params.id;
        const tokens = await listWorkspaceMcpTokens(workspaceId);
        return res.status(200).json(tokens);
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // Revoke an MCP token
  router.delete(
    '/tokens/:tokenId',
    authMiddleware,
    requireWorkspaceRole('member'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const workspaceId = req.params.workspaceId || req.params.id;
        const { tokenId } = req.params;

        const success = await revokeMcpToken(tokenId, workspaceId);
        if (!success) {
          return res.status(404).json({ error: 'Token not found or already revoked' });
        }

        return res.status(200).json({ success: true, message: 'MCP token revoked' });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  // Helper endpoint returning setup instructions and config templates
  router.get(
    '/config',
    authMiddleware,
    requireWorkspaceRole('viewer'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const workspaceId = req.params.workspaceId || req.params.id;
        const host = req.get('host') || 'localhost:3000';
        const protocol = req.protocol || 'http';
        const endpointUrl = `${protocol}://${host}/api/workspaces/${workspaceId}/mcp`;

        return res.status(200).json({
          workspaceId,
          endpointUrl,
          claudeCodeCommand: `claude mcp add conti-newty ${endpointUrl} --header "Authorization: Bearer <YOUR_MCP_TOKEN>"`,
          cursorConfig: {
            mcpServers: {
              'conti-newty-brain': {
                url: endpointUrl,
                headers: {
                  Authorization: 'Bearer <YOUR_MCP_TOKEN>',
                },
              },
            },
          },
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }
  );

  return router;
}
