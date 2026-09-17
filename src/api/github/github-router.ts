import { Router, Request, Response } from 'express';
import { GitImporter } from '../../modules/storage/git-importer';
import { WorkspaceStorage } from '../../modules/storage/workspace-storage';
import { authMiddleware } from '../../middleware/auth-middleware';

export function createGithubRouter(storageResolver: (workspaceId: string) => WorkspaceStorage): Router {
  const router = Router();

  /**
   * GET /api/github/repos
   * List user's GitHub repositories or sample templates
   */
  router.get('/repos', async (req: Request, res: Response) => {
    try {
      const token = (req.query.token as string) || (req.headers['x-github-token'] as string) || undefined;
      const searchQuery = (req.query.q as string) || (req.query.search as string) || undefined;
      const result = await GitImporter.listRepositories(token, searchQuery);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Failed to list repositories' });
    }
  });

  /**
   * POST /api/workspaces/:id/import/github
   * Import repository files directly into /company_brain
   */
  router.post('/:id/import/github', authMiddleware, async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.id;
      const storage = storageResolver(workspaceId);
      const { fullName, repoUrl, branch, token } = req.body;

      const result = await GitImporter.importRepository(storage, {
        fullName,
        repoUrl,
        branch,
        token,
      });

      return res.json(result);
    } catch (e: any) {
      return res.status(400).json({ error: e.message || 'Failed to import repository' });
    }
  });

  /**
   * POST /api/workspaces/:id/import/files
   * Multi-file batch upload into /company_brain
   */
  router.post('/:id/import/files', authMiddleware, async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.id;
      const storage = storageResolver(workspaceId);
      const { files } = req.body as { files: Array<{ name: string; content: string; path?: string }> };

      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'No files provided' });
      }

      const savedFiles: string[] = [];
      for (const f of files) {
        const targetPath = f.path || `company_brain/uploads/${f.name}`;
        await storage.writeFile(targetPath, f.content);
        savedFiles.push(targetPath);
      }

      return res.json({
        success: true,
        count: savedFiles.length,
        files: savedFiles,
        message: `Successfully uploaded ${savedFiles.length} files into /company_brain`,
      });
    } catch (e: any) {
      return res.status(400).json({ error: e.message || 'Failed to upload files' });
    }
  });

  return router;
}
