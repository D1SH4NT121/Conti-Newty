import { Router, Response } from 'express';
import path from 'path';
import { prisma } from '../../db/client';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth-middleware';
import { WorkspaceStorage } from '../../modules/storage/workspace-storage';
import { seedIcmTemplateById } from '../../modules/storage/icm-registry';
import { WorkspaceArchiveManager } from '../../modules/storage/workspace-archive';
import { DataAnonymizer } from '../../modules/brain/anonymizer';

export function createWorkspaceRouter(storageResolver?: (workspaceId: string) => WorkspaceStorage): Router {
  const router = Router();

  router.use(authMiddleware);

  // List workspaces for the current user
  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const memberships = await prisma.workspaceMember.findMany({
        where: { userId: req.user!.id },
        include: {
          workspace: {
            include: { _count: { select: { members: true, threads: true, appWorkspaces: true } } }
          }
        }
      });
      return res.status(200).json(memberships.map(m => ({ ...m.workspace, role: m.role })));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Create workspace
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description, template, organizationId } = req.body;
      if (!name) return res.status(400).json({ error: 'Name is required' });

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
        select: { organizationId: true }
      });

      const orgId = organizationId || user?.organizationId;
      if (!orgId) return res.status(400).json({ error: 'Public organization is unavailable' });

      if (!user?.organizationId && orgId) {
        await prisma.user.update({
          where: { id: req.user!.id },
          data: { organizationId: orgId }
        }).catch((_e) => {
          // Ignore non-critical organizationId sync failure
        });
      }

      const workspace = await prisma.workspace.create({
        data: { name, description, organizationId: orgId }
      });

      await prisma.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: req.user!.id, role: 'admin' }
      });

      await prisma.user.update({
        where: { id: req.user!.id },
        data: { lastWorkspaceId: workspace.id }
      }).catch((_e) => {
        // Ignore non-critical lastWorkspaceId update failure
      });

      const storage = storageResolver
        ? storageResolver(workspace.id)
        : new WorkspaceStorage(workspace.id, path.join(process.cwd(), 'workspaces', workspace.id));

      // Seed ICM template if requested
      if (template) {
        await seedIcmTemplateById(storage, template).catch(console.error);
      }

      return res.status(201).json(workspace);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Seed ICM template into existing workspace
  router.post('/:id/seed', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { template = 'founder' } = req.body;
      const storage = storageResolver
        ? storageResolver(req.params.id)
        : new WorkspaceStorage(req.params.id, path.join(process.cwd(), 'workspaces', req.params.id));
      const files = await seedIcmTemplateById(storage, template);
      if (!files) return res.status(404).json({ error: 'Template not found' });
      return res.status(200).json({ success: true, fileCount: files.length, files });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Get single workspace
  router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspace = await prisma.workspace.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { members: true, threads: true, appWorkspaces: true } } }
      });
      if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

      await prisma.workspaceMember.upsert({
        where: { userId_workspaceId: { userId: req.user!.id, workspaceId: req.params.id } },
        update: {},
        create: { userId: req.user!.id, workspaceId: req.params.id, role: 'member' }
      });

      if (req.user?.id && req.params.id) {
        req.user.lastWorkspaceId = req.params.id;
        await prisma.user.update({
          where: { id: req.user.id },
          data: { lastWorkspaceId: req.params.id }
        }).catch((_e) => {
          // Ignore non-critical lastWorkspaceId update failure
        });
      }

      return res.status(200).json(workspace);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Update workspace
  router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description } = req.body;
      const workspace = await prisma.workspace.update({
        where: { id: req.params.id },
        data: { ...(name && { name }), ...(description !== undefined && { description }) }
      });
      return res.status(200).json(workspace);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Delete workspace
  router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      await prisma.workspace.delete({ where: { id: req.params.id } });
      return res.status(200).json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // List workspace members
  router.get('/:id/members', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const members = await prisma.workspaceMember.findMany({
        where: { workspaceId: req.params.id },
        include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } }
      });
      return res.status(200).json(members);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Export workspace as ZIP archive
  router.get('/:id/download', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const storage = storageResolver
        ? storageResolver(req.params.id)
        : new WorkspaceStorage(req.params.id, path.join(process.cwd(), 'workspaces', req.params.id));
      const archiveManager = new WorkspaceArchiveManager(storage);
      const url = await archiveManager.exportZip();
      return res.status(200).json({ url });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Import ZIP archive into workspace
  router.post('/:id/upload', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { zipBase64, url } = req.body;
      if (!zipBase64 && !url) {
        return res.status(400).json({ error: 'zipBase64 or url is required' });
      }
      const storage = storageResolver
        ? storageResolver(req.params.id)
        : new WorkspaceStorage(req.params.id, path.join(process.cwd(), 'workspaces', req.params.id));
      const archiveManager = new WorkspaceArchiveManager(storage);
      const source = zipBase64 ? Buffer.from(zipBase64, 'base64') : url;
      const result = await archiveManager.importZip(source);
      return res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Anonymize content or file
  router.post('/:id/anonymize', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { text, filePath, customEntities, maskFinancials } = req.body;
      let rawText = text;
      if (!rawText && filePath) {
        const storage = storageResolver
          ? storageResolver(req.params.id)
          : new WorkspaceStorage(req.params.id, path.join(process.cwd(), 'workspaces', req.params.id));
        rawText = await storage.readFile(filePath);
      }
      if (rawText === undefined) {
        return res.status(400).json({ error: 'text or filePath is required' });
      }
      const result = DataAnonymizer.anonymize(rawText, { customEntities, maskFinancials });
      return res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
