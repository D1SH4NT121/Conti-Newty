import { Router, Response } from 'express';
import { prisma } from '../../db/client';
import { authMiddleware, requireWorkspaceRole, AuthenticatedRequest } from '../../middleware/auth-middleware';
import { WorkspaceStorage } from '../../modules/storage/workspace-storage';
import {
  DriveConnector,
  JiraConnector,
  SlackConnector,
  TribalMemoryConnector,
  ConnectorIngestResult
} from '../../modules/connectors/connector-services';
import {
  driveAuthUrl,
  exchangeCode,
  connectFiles,
  syncWorkspaceConnections,
  listConnections,
  PickerFile
} from '../../modules/connectors/drive-connector';
import {
  jiraAuthUrl,
  exchangeCode as jiraExchangeCode,
  connectJira,
  syncJiraConnection,
  syncWorkspaceJiraConnections,
  listJiraConnections,
  disconnectJiraConnection
} from '../../modules/connectors/jira-connector';
import {
  slackAuthUrl,
  exchangeCode as slackExchangeCode,
  connectSlack,
  syncSlackConnection,
  syncWorkspaceSlackConnections,
  listSlackConnections,
  disconnectSlackConnection
} from '../../modules/connectors/slack-connector';
import { config } from '../../config';
import {
  getOptInStatus,
  setOptIn,
  syncWorkspace,
  getSyncHistory,
} from '../../modules/connectors/connector-scheduler';

export function createConnectorRouter(storageResolver?: (workspaceId: string) => WorkspaceStorage): Router {
  const router = Router({ mergeParams: true });

  const getStorage = (workspaceId: string): WorkspaceStorage => {
    if (storageResolver) return storageResolver(workspaceId);
    return new WorkspaceStorage(workspaceId);
  };

  const getWorkspaceId = (req: AuthenticatedRequest): string => {
    return (
      req.workspaceMember?.workspaceId ||
      req.params.id ||
      req.params.workspaceId ||
      (req as any).workspaceId ||
      (req.headers['x-workspace-id'] as string) ||
      req.body?.workspaceId ||
      ''
    );
  };

  router.use(authMiddleware);

  // List past sync records
  router.get('/', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = getWorkspaceId(req);
      const syncs = await prisma.connectorSync.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      return res.json(syncs);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── Drive: OAuth URL (drive.file scope) ─────────────────────────────────

  /**
   * GET /drive/auth-url
   * Returns the Google consent URL the frontend should redirect to.
   * State encodes workspaceId + userId so the callback can identify the context.
   */
  router.get('/drive/auth-url', requireWorkspaceRole('member'), (req: AuthenticatedRequest, res: Response) => {
    if (!config.googleClientId || !config.googleClientSecret) {
      return res.status(501).json({ error: 'Google OAuth is not configured' });
    }
    const workspaceId = req.params.id || req.params.workspaceId;
    const state = Buffer.from(JSON.stringify({ workspaceId, userId: req.user!.id })).toString('base64url');
    return res.json({ url: driveAuthUrl({ state }) });
  });

  /**
   * POST /drive/connect
   * Body: { code: string, pickerFiles: PickerFile[], targetDir?: string }
   *
   * Exchanges the OAuth code for tokens, then for each Picker-selected file:
   *   - fetches content from Drive
   *   - writes to Brain
   *   - persists a SourceConnection row
   */
  router.post('/drive/connect', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { code, pickerFiles, targetDir } = req.body as {
        code?: string;
        pickerFiles?: PickerFile[];
        targetDir?: string;
      };

      if (!code) return res.status(400).json({ error: 'code is required' });
      if (!pickerFiles?.length) return res.status(400).json({ error: 'pickerFiles (non-empty array) is required' });

      const tokens = await exchangeCode(code);
      const storage = getStorage(workspaceId);

      const result = await connectFiles({
        workspaceId,
        userId: req.user!.id,
        storage,
        tokens,
        pickerFiles,
        targetDir,
      });

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /drive/sync
   * Re-fetches all active Drive SourceConnections for the workspace.
   * Skips files whose modifiedTime hasn't changed.
   * Auto-refreshes tokens; marks status='reconnect_required' on permanent failure.
   */
  router.post('/drive/sync', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const activeConnections = await prisma.sourceConnection.count({
        where: { workspaceId, status: 'active' }
      });
      if (activeConnections === 0) {
        return res.status(400).json({ error: 'No active Drive connections found' });
      }
      const storage = getStorage(workspaceId);
      const result = await syncWorkspaceConnections(workspaceId, storage);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /drive/connections
   * Lists all Drive SourceConnections for the workspace (no tokens returned).
   */
  router.get('/drive/connections', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const connections = await listConnections(workspaceId);
      return res.json(connections);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── Legacy bulk Drive sync (kept for backward compat) ───────────────────

  router.post('/drive/sync-legacy', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { accessToken, folderId, targetPath } = req.body;
      if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

      const storage = getStorage(workspaceId);
      const result = await DriveConnector.ingest(storage, { accessToken, folderId, targetPath });
      await recordSync(workspaceId, result, req.user!.id);

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── Jira: OAuth + persistent connections ───────────────────────────────

  /**
   * GET /jira/auth-url
   * Returns the Atlassian OAuth2 authorization URL.
   * State encodes workspaceId + userId for callback routing.
   */
  router.get('/jira/auth-url', requireWorkspaceRole('member'), (req: AuthenticatedRequest, res: Response) => {
    if (!config.jiraClientId || !config.jiraClientSecret) {
      return res.status(501).json({ error: 'Jira OAuth is not configured' });
    }
    const workspaceId = req.params.id || req.params.workspaceId;
    const state = Buffer.from(JSON.stringify({ workspaceId, userId: req.user!.id })).toString('base64url');
    return res.json({ url: jiraAuthUrl({ state }) });
  });

  /**
   * POST /jira/connect
   * Body: { code: string, baseUrl: string, email: string, jql?: string, targetPath?: string }
   *
   * Exchanges the OAuth code for access token, then:
   *   - Validates Jira access
   *   - Creates JiraConnection row
   *   - Performs initial sync (fetches issues, writes markdown)
   */
  router.post('/jira/connect', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { code, baseUrl, email, jql, targetPath } = req.body as {
        code?: string;
        baseUrl?: string;
        email?: string;
        jql?: string;
        targetPath?: string;
      };

      if (!code) return res.status(400).json({ error: 'code is required' });
      if (!baseUrl) return res.status(400).json({ error: 'baseUrl is required' });
      if (!email) return res.status(400).json({ error: 'email is required' });

      const accessToken = await jiraExchangeCode(code);
      const storage = getStorage(workspaceId);

      const result = await connectJira({
        workspaceId,
        userId: req.user!.id,
        storage,
        accessToken,
        baseUrl,
        email,
        jql,
        targetPath,
      });

      return res.json(result);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  });

  /**
   * POST /jira/sync
   * Re-fetches all active Jira connections for the workspace.
   * Optional body: { connectionId?: string } to sync specific connection.
   */
  router.post('/jira/sync', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { connectionId } = req.body as { connectionId?: string };

      const storage = getStorage(workspaceId);

      if (connectionId) {
        // Sync specific connection
        const result = await syncJiraConnection(connectionId, storage);
        return res.json(result);
      } else {
        const activeConnections = await prisma.jiraConnection.count({
          where: { workspaceId, syncStatus: 'active' }
        });
        if (activeConnections === 0) {
          const { baseUrl, email, apiToken } = req.body as { baseUrl?: string; email?: string; apiToken?: string };
          if (!baseUrl || !email || !apiToken) {
            return res.status(400).json({ error: 'No active Jira connections found or missing baseUrl/email/apiToken' });
          }
        }
        // Sync all connections
        const result = await syncWorkspaceJiraConnections(workspaceId, storage);
        return res.json(result);
      }
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /jira/connections
   * Lists all Jira connections for the workspace (no tokens returned).
   */
  router.get('/jira/connections', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const connections = await listJiraConnections(workspaceId);
      return res.json(connections);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  /**
   * DELETE /jira/connections/:connectionId
   * Disconnect (delete) a Jira connection.
   */
  router.delete('/jira/connections/:connectionId', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { connectionId } = req.params;
      
      // Verify connection belongs to this workspace
      const conn = await prisma.jiraConnection.findUnique({ where: { id: connectionId } });
      if (!conn) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      const workspaceId = getWorkspaceId(req);
      if (conn.workspaceId !== workspaceId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await disconnectJiraConnection(connectionId);
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── Legacy Jira sync (request-based, not persistent) ───────────────────

  router.post('/jira/sync-legacy', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { baseUrl, email, apiToken, jql, targetPath } = req.body;
      if (!baseUrl || !email || !apiToken) return res.status(400).json({ error: 'baseUrl, email, apiToken required' });

      const storage = getStorage(workspaceId);
      const result = await JiraConnector.ingest(storage, { baseUrl, email, apiToken, jql, targetPath });
      await recordSync(workspaceId, result, req.user!.id);

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── Slack: OAuth + persistent connections ──────────────────────────────

  /**
   * GET /slack/auth-url
   * Returns the Slack OAuth2 authorization URL.
   * State encodes workspaceId + userId for callback routing.
   */
  router.get('/slack/auth-url', requireWorkspaceRole('member'), (req: AuthenticatedRequest, res: Response) => {
    if (!config.slackClientId || !config.slackClientSecret) {
      return res.status(501).json({ error: 'Slack OAuth is not configured' });
    }
    const workspaceId = req.params.id || req.params.workspaceId;
    const state = Buffer.from(JSON.stringify({ workspaceId, userId: req.user!.id })).toString('base64url');
    return res.json({ url: slackAuthUrl({ state }) });
  });

  /**
   * POST /slack/connect
   * Body: { code: string, slackWorkspaceId: string, slackTeamName: string, channels: string[], archiveFormat?: string, targetPath?: string }
   *
   * Exchanges the OAuth code for access token, then:
   *   - Validates Slack access
   *   - Creates SlackConnection row
   *   - Performs initial sync (fetches messages, writes markdown)
   */
  router.post('/slack/connect', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { code, slackWorkspaceId, slackTeamName, channels, archiveFormat, targetPath } = req.body as {
        code?: string;
        slackWorkspaceId?: string;
        slackTeamName?: string;
        channels?: string[];
        archiveFormat?: string;
        targetPath?: string;
      };

      if (!code) return res.status(400).json({ error: 'code is required' });
      if (!slackWorkspaceId) return res.status(400).json({ error: 'slackWorkspaceId is required' });
      if (!slackTeamName) return res.status(400).json({ error: 'slackTeamName is required' });
      if (!channels?.length) return res.status(400).json({ error: 'channels (non-empty array) is required' });

      const accessToken = await slackExchangeCode(code);
      const storage = getStorage(workspaceId);

      const result = await connectSlack({
        workspaceId,
        userId: req.user!.id,
        storage,
        accessToken,
        slackWorkspaceId,
        slackTeamName,
        channels,
        archiveFormat,
        targetPath,
      });

      return res.json(result);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  });

  /**
   * POST /slack/sync
   * Re-fetches all active Slack connections for the workspace.
   * Optional body: { connectionId?: string } to sync specific connection.
   */
  router.post('/slack/sync', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { connectionId } = req.body as { connectionId?: string };

      const storage = getStorage(workspaceId);

      if (connectionId) {
        // Sync specific connection
        const result = await syncSlackConnection(connectionId, storage);
        return res.json(result);
      } else {
        const activeConnections = await prisma.slackConnection.count({
          where: { workspaceId, syncStatus: 'active' }
        });
        if (activeConnections === 0) {
          const { botToken, channelIds } = req.body as { botToken?: string; channelIds?: string[] };
          if (!botToken || !channelIds?.length) {
            return res.status(400).json({ error: 'No active Slack connections found or missing botToken/channelIds' });
          }
        }
        // Sync all connections
        const result = await syncWorkspaceSlackConnections(workspaceId, storage);
        return res.json(result);
      }
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /slack/connections
   * Lists all Slack connections for the workspace (no tokens returned).
   */
  router.get('/slack/connections', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const connections = await listSlackConnections(workspaceId);
      return res.json(connections);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  /**
   * DELETE /slack/connections/:connectionId
   * Disconnect (delete) a Slack connection.
   */
  router.delete('/slack/connections/:connectionId', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { connectionId } = req.params;
      
      // Verify connection belongs to this workspace
      const conn = await prisma.slackConnection.findUnique({ where: { id: connectionId } });
      if (!conn) {
        return res.status(404).json({ error: 'Connection not found' });
      }

      const workspaceId = getWorkspaceId(req);
      if (conn.workspaceId !== workspaceId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await disconnectSlackConnection(connectionId);
      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── Legacy Slack sync (request-based, not persistent) ───────────────────

  router.post('/slack/sync-legacy', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { botToken, channelIds, targetPath, limit } = req.body;
      if (!botToken || !channelIds?.length) return res.status(400).json({ error: 'botToken, channelIds required' });

      const storage = getStorage(workspaceId);
      const result = await SlackConnector.ingest(storage, { botToken, channelIds, targetPath, limit });
      await recordSync(workspaceId, result, req.user!.id);

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // Tribal Memory capture
  router.post('/tribal/sync', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { entries, targetPath } = req.body;
      if (!entries?.length) return res.status(400).json({ error: 'entries (array) required' });

      const storage = getStorage(workspaceId);
      const result = await TribalMemoryConnector.ingest(storage, { entries, targetPath });
      await recordSync(workspaceId, result, req.user!.id);

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── Auto-sync opt-in ──────────────────────────────────────────

  /**
   * GET /auto-sync
   * Returns the auto-sync opt-in status for the workspace.
   */
  router.get(
    '/auto-sync',
    requireWorkspaceRole('viewer'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const workspaceId = getWorkspaceId(req);
        const status = await getOptInStatus(workspaceId);
        return res.json(status);
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }
  );

  /**
   * POST /auto-sync
   * Toggle auto-sync on or off for this workspace.
   * Body: { enabled: boolean, intervalMin?: number }
   * Requires admin role — explicit consent gate.
   */
  router.post(
    '/auto-sync',
    requireWorkspaceRole('admin'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const workspaceId = getWorkspaceId(req);
        const userId = req.user?.id || 'system';
        const { enabled, intervalMin } = req.body as { enabled: boolean; intervalMin?: number };

        if (typeof enabled !== 'boolean') {
          return res.status(400).json({ error: 'enabled (boolean) is required' });
        }

        const status = await setOptIn(workspaceId, enabled, userId, intervalMin);
        return res.json(status);
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }
  );

  /**
   * GET /auto-sync/history
   * Returns recent auto-sync run history (last 20 entries by default).
   * Query param: limit (max 100)
   */
  router.get(
    '/auto-sync/history',
    requireWorkspaceRole('viewer'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const workspaceId = getWorkspaceId(req);
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        const history = await getSyncHistory(workspaceId, limit);
        return res.json(history);
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }
  );

  /**
   * POST /auto-sync/run
   * Manually trigger an immediate sync cycle (admin only).
   * Performs the full sync synchronously and returns the result.
   */
  router.post(
    '/auto-sync/run',
    requireWorkspaceRole('admin'),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const workspaceId = getWorkspaceId(req);
        const result = await syncWorkspace(workspaceId);
        return res.json(result);
      } catch (e: any) {
        return res.status(500).json({ error: e.message });
      }
    }
  );

  return router;
}

async function recordSync(workspaceId: string, result: ConnectorIngestResult, userId: string) {
  await prisma.connectorSync.create({
    data: {
      connector: result.connector,
      workspaceId,
      targetPath: result.targetPath,
      fileCount: result.fileCount,
      status: result.status,
      detail: result.detail || null,
      createdById: userId,
    }
  });
}
