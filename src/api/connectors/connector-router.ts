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

  // Google Drive sync
  router.post('/drive/sync', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
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
