import { Router, Response } from 'express';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth-middleware';
import { WorkspaceStorage } from '../../modules/storage/workspace-storage';
import { ICM_TEMPLATE_REGISTRY, seedIcmTemplateById } from '../../modules/storage/icm-registry';

export function createIcmRouter(storageResolver?: (workspaceId: string) => WorkspaceStorage): Router {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

  const getStorage = (workspaceId: string): WorkspaceStorage => {
    if (storageResolver) return storageResolver(workspaceId);
    return new WorkspaceStorage(workspaceId);
  };

  // List available ICM templates
  router.get('/templates', (_req: AuthenticatedRequest, res: Response) => {
    const templates: Array<{
      id: string;
      name: string;
      description: string;
      fileCount: number;
      folders: string[];
    }> = ICM_TEMPLATE_REGISTRY.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      fileCount: t.files.length,
      folders: [...new Set(t.files.map(f => f.path.split('/')[0]))]
    }));

    return res.json(templates);
  });

  // Get single template detail
  router.get('/templates/:templateId', (_req: AuthenticatedRequest, res: Response) => {
    const tpl = ICM_TEMPLATE_REGISTRY.find(t => t.id === _req.params.templateId);
    if (!tpl) return res.status(404).json({ error: 'Template not found' });

    return res.json({
      id: tpl.id,
      name: tpl.name,
      description: tpl.description,
      files: tpl.files.map(f => ({ path: f.path, preview: f.content.substring(0, 200) }))
    });
  });

  // Apply a template to a workspace
  router.post('/apply', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { workspaceId, templateId } = req.body;
      if (!workspaceId || !templateId) {
        return res.status(400).json({ error: 'workspaceId and templateId are required' });
      }

      const storage = getStorage(workspaceId);
      const createdFiles = await seedIcmTemplateById(storage, templateId);
      if (!createdFiles) {
        return res.status(404).json({ error: 'Template not found' });
      }

      return res.json({
        success: true,
        templateId,
        workspaceId,
        fileCount: createdFiles.length,
        files: createdFiles
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  return router;
}
