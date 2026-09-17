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

  // CORS
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
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
