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
import { config } from '../../config';

export function createConnectorRouter(storageResolver?: (workspaceId: string) => WorkspaceStorage): Router {
  const router = Router({ mergeParams: true });

  const getStorage = (workspaceId: string): WorkspaceStorage => {
    if (storageResolver) return storageResolver(workspaceId);
    return new WorkspaceStorage(workspaceId);
  };

  router.use(authMiddleware);

  // List past sync records
  router.get('/', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
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

  // Jira sync
  router.post('/jira/sync', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
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

  // Slack sync
  router.post('/slack/sync', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
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
