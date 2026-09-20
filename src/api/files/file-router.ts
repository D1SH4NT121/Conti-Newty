import { Router, Response } from 'express';
import { WorkspaceStorage } from '../../modules/storage/workspace-storage';
import { authMiddleware, requireWorkspaceRole, AuthenticatedRequest } from '../../middleware/auth-middleware';

export function createFileRouter(storageResolver?: (workspaceId: string) => WorkspaceStorage): Router {
  const router = Router({ mergeParams: true });

  const getStorage = (workspaceId: string): WorkspaceStorage => {
    if (storageResolver) {
      return storageResolver(workspaceId);
    }
    return new WorkspaceStorage(workspaceId);
  };

  router.use(authMiddleware);

  // List files or read root directory
  router.get('/', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const storage = getStorage(workspaceId);
      const files = req.query.recursive === 'true'
        ? await storage.listFilesRecursive('')
        : await storage.listDirectory('');
      return res.status(200).json({ files });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Read file or list subdirectory
  router.get('/*', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const storage = getStorage(workspaceId);
      const relativePath = req.params[0] || '';

      if (!relativePath) {
        const files = req.query.recursive === 'true'
          ? await storage.listFilesRecursive('')
          : await storage.listDirectory('');
        return res.status(200).json({ files });
      }

      const safePath = storage.resolveSafePath(relativePath);
      const exists = await storage.fileExists(relativePath);
      if (!exists) {
        return res.status(404).json({ error: `Path "${relativePath}" not found` });
      }

      // Check if directory
      const stat = await require('fs').promises.stat(safePath);
      if (stat.isDirectory()) {
        const files = await storage.listDirectory(relativePath);
        return res.status(200).json({ files });
      }

      const content = await storage.readFile(relativePath);
      if (req.query.download === 'true') {
        const pathModule = require('path');
        res.setHeader('Content-Disposition', `attachment; filename="${pathModule.basename(safePath)}"`);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(content);
      }
      return res.status(200).json({ path: relativePath, content });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Create or update file
  router.put('/*', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const storage = getStorage(workspaceId);
      const relativePath = req.params[0] || '';
      const { content = '' } = req.body;

      if (!relativePath) {
        return res.status(400).json({ error: 'File path is required' });
      }

      await storage.writeFile(relativePath, content);
      const io = req.app.get('io');
      if (io) {
        const { EventBroadcaster } = require('../../realtime/event-broadcaster');
        EventBroadcaster.broadcastFileChanged(io, workspaceId, {
          filePath: relativePath,
          action: 'updated',
          updatedBy: { id: req.user!.id, name: req.user!.name }
        });
      }
      return res.status(200).json({ success: true, path: relativePath });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Delete file
  router.delete('/*', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const storage = getStorage(workspaceId);
      const relativePath = req.params[0] || '';

      if (!relativePath) {
        return res.status(400).json({ error: 'File path is required' });
      }

      await storage.deleteFile(relativePath);
      const io = req.app.get('io');
      if (io) {
        const { EventBroadcaster } = require('../../realtime/event-broadcaster');
        EventBroadcaster.broadcastFileChanged(io, workspaceId, {
          filePath: relativePath,
          action: 'deleted',
          updatedBy: { id: req.user!.id, name: req.user!.name }
        });
      }
      return res.status(200).json({ success: true, message: `Deleted ${relativePath}` });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
