import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../db/client';
import { authMiddleware, requireWorkspaceRole, AuthenticatedRequest } from '../../middleware/auth-middleware';
import { createRateLimiter } from '../../middleware/rate-limiter';
import { AppGeneratorService } from '../../modules/app-generator/generator-service';
import { WorkspaceStorage } from '../../modules/storage/workspace-storage';
import { SandboxRunner } from '../../modules/app-generator/sandbox-runner';

export function createAppRouter(
  storageResolver?: (workspaceId: string) => WorkspaceStorage,
  sandboxRunner?: SandboxRunner
): Router {
  const router = Router({ mergeParams: true });
  const runner = sandboxRunner || new SandboxRunner();

  const getService = (workspaceId: string): AppGeneratorService => {
    const storage = storageResolver ? storageResolver(workspaceId) : new WorkspaceStorage(workspaceId);
    return new AppGeneratorService(storage, runner);
  };

  const generationRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 5,
    message: 'App generation rate limit exceeded. Please wait before generating another application.'
  });

  router.use(authMiddleware);

  // List apps in workspace
  router.get('/', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const service = getService(workspaceId);
      const apps = await service.listApps(workspaceId);
      return res.status(200).json(apps.map(a => ({
        ...a,
        previewUrl: `/api/workspaces/${workspaceId}/apps/${a.id}/preview`,
        shareUrl: a.slug ? `/apps/${a.slug}` : null
      })));
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Generate new app from knowledge (Rate Limited)
  router.post('/', requireWorkspaceRole('member'), generationRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { prompt, appType, appName } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const service = getService(workspaceId);
      const result = await service.generateAppFromKnowledge({
        workspaceId,
        userId: req.user!.id,
        prompt,
        appType,
        appName
      });

      return res.status(201).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Get app details
  router.get('/:appId', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { appId } = req.params;
      const app = await prisma.appWorkspace.findUnique({
        where: { id: appId },
        include: {
          deployments: { orderBy: { deployedAt: 'desc' } },
          accesses: true
        }
      });

      if (!app) {
        return res.status(404).json({ error: 'App not found' });
      }

      const url = runner.getSandboxUrl(appId);
      return res.status(200).json({ ...app, url });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Secure Static Preview Endpoint for Sandboxed Iframe (CSP Protected, Path Traversal Safe)
  router.get(['/:appId/preview', '/:appId/preview/*'], requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { appId } = req.params;

      // 1. Verify Deployment Status
      const deployment = await prisma.appDeployment.findFirst({
        where: { appWorkspaceId: appId },
        orderBy: { deployedAt: 'desc' }
      });

      if (!deployment || deployment.status === 'EXPIRED' || deployment.status === 'FAILED') {
        return res.status(410).json({ error: 'Application deployment is expired or inactive' });
      }

      // 2. Resolve relative path safely
      const storage = storageResolver ? storageResolver(workspaceId) : new WorkspaceStorage(workspaceId);
      const appBaseDir = path.join(storage.workspaceRoot, 'apps', appId);

      const requestedSubPath = req.params[0] || 'index.html';
      const safeRelative = path.normalize(requestedSubPath).replace(/^(\.\.[\/\\])+/, '');
      const targetFilePath = path.resolve(appBaseDir, safeRelative);

      // Deny Path Traversal
      if (!targetFilePath.startsWith(path.resolve(appBaseDir))) {
        return res.status(403).json({ error: 'Access denied: path traversal detected' });
      }

      if (!fs.existsSync(targetFilePath) || !fs.statSync(targetFilePath).isFile()) {
        return res.status(404).json({ error: 'Preview file not found' });
      }

      // 3. Set Restrictive Defense-in-Depth CSP Headers
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline' 'self'; img-src 'self' data:; connect-src 'none'; frame-ancestors 'self'"
      );
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      const ext = path.extname(targetFilePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml'
      };

      res.setHeader('Content-Type', mimeMap[ext] || 'text/plain');
      return fs.createReadStream(targetFilePath).pipe(res);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Expire / Terminate App Deployment (Returns 410 on subsequent preview calls)
  router.post('/:appId/expire', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { appId } = req.params;

      await prisma.appDeployment.updateMany({
        where: { appWorkspaceId: appId },
        data: { status: 'EXPIRED' }
      });

      await runner.stopSandbox(appId);

      return res.status(200).json({
        success: true,
        message: 'Application deployment expired and sandbox terminated'
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Stop sandbox
  router.post('/:appId/stop', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { appId } = req.params;
      await runner.stopSandbox(appId);
      return res.status(200).json({ success: true, message: 'Sandbox stopped' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
