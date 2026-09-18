import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import { WorkspaceStorage } from '../modules/storage/workspace-storage';
import { SandboxRunner } from '../modules/app-generator/sandbox-runner';
import { createAuthRouter } from './auth/auth-router';
import { createOrgRouter } from './orgs/org-router';
import { createWorkspaceRouter } from './workspaces/workspace-router';
import { createFileRouter } from './files/file-router';
import { createThreadRouter } from './threads/thread-router';
import { createTaskRouter } from './tasks/task-router';
import { createChangeRouter } from './changes/change-router';
import { createAppRouter } from './apps/app-router';
import { createInviteRouter } from './invites/invite-router';
import { createGithubRouter } from './github/github-router';
import { createCredentialRouter } from './credentials/credential-router';
import { createConnectorRouter } from './connectors/connector-router';
import { createIcmRouter } from './icm/icm-router';
import { config } from '../config';

export function createApp(customStorageBaseDir?: string, customSandboxRunner?: SandboxRunner): Express {
  const app = express();
  const sandboxRunner = customSandboxRunner || new SandboxRunner();

  const storageResolver = (workspaceId: string): WorkspaceStorage => {
    const root = customStorageBaseDir
      ? path.join(customStorageBaseDir, workspaceId)
      : path.join(process.cwd(), 'workspaces', workspaceId);
    return new WorkspaceStorage(workspaceId, root);
  };

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/api/health', (_req: Request, res: Response) => {
    return res.status(200).json({
      status: 'ok',
      provider: config.aiProvider,
      archiveStorage: process.env.ARCHIVE_BUCKET ? 's3' : 'unconfigured'
    });
  });

  // CORS
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && config.allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Serve compiled React SPA assets and public folder
  const clientDistDir = path.resolve(process.cwd(), 'dist', 'client');
  if (require('fs').existsSync(clientDistDir)) {
    app.use('/assets', express.static(path.join(clientDistDir, 'assets')));
    app.use(express.static(clientDistDir));
  }
  const publicDir = path.resolve(process.cwd(), 'public');
  app.use(express.static(publicDir));


  // REST API Routes
  app.use('/api/auth', createAuthRouter());
  app.use('/api/orgs', createOrgRouter());
  app.use('/api', createInviteRouter());
  app.use('/api/github', createGithubRouter(storageResolver));
  app.use('/api/workspaces', createGithubRouter(storageResolver));
  app.use('/api/workspaces', createWorkspaceRouter(storageResolver));
  app.use('/api/workspaces/:id/files', createFileRouter(storageResolver));
  app.use('/api/workspaces/:id/threads', createThreadRouter());
  app.use('/api/workspaces/:id/tasks', createTaskRouter(storageResolver));
  app.use('/api/workspaces/:id/changes', createChangeRouter(storageResolver));
  app.use('/api/workspaces/:id/apps', createAppRouter(storageResolver, sandboxRunner));
  app.use('/api/credentials', createCredentialRouter());
  app.use('/api/workspaces/:id/connectors', createConnectorRouter(storageResolver));
  app.use('/api/icm', createIcmRouter(storageResolver));

  // Public shareable app route — no auth required
  app.get('/apps/:slug', async (req: Request, res: Response) => {
    try {
      const { prisma } = await import('../db/client');
      const app_ws = await prisma.appWorkspace.findUnique({
        where: { slug: req.params.slug },
        include: { deployments: { orderBy: { deployedAt: 'desc' }, take: 1 } }
      });
      if (!app_ws || !app_ws.deployments[0] || app_ws.deployments[0].status !== 'DEPLOYED') {
        return res.status(404).send('<h1>App not found or not deployed</h1>');
      }
      const fs = await import('fs');
      const pathMod = await import('path');
      const storage = storageResolver(app_ws.workspaceId);
      const appDir = pathMod.join(storage.workspaceRoot, 'apps', app_ws.id);
      const indexPath = pathMod.join(appDir, 'index.html');
      if (!fs.existsSync(indexPath)) {
        return res.status(404).send('<h1>App files not found</h1>');
      }
      res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline' 'self'; img-src 'self' data:");
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return fs.createReadStream(indexPath).pipe(res);
    } catch (err: any) {
      return res.status(500).send('<h1>Error loading app</h1>');
    }
  });

  // SPA fallback for HTML5 history API routes (Landing, /auth, /enter, /onboarding, /w/*)
  if (require('fs').existsSync(clientDistDir)) {
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error'
    });
  });

  return app;
}
