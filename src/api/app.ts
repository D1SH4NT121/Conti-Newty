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
import { createConnectorRouter } from './connectors/connector-router';
import { createTribalRouter } from './tribal-memory/tribal-router';
import { createIcmRouter } from './icm/icm-router';
import { createSessionRouter } from './sessions/session-router';
import { createSkillRouter } from './skills/skill-router';
import { createMcpRouter } from './mcp/mcp-router';
import { createCandidateRouter } from './tribal-memory/candidate-router';
import { createCredentialRouter } from './credentials/credential-router';

import { config } from '../config';
import { startScheduler } from '../modules/connectors/connector-scheduler';

export function createApp(
  customStorageBaseDir?: string,
  customSandboxRunner?: SandboxRunner
): Express {
  const app = express();

  const sandboxRunner =
    customSandboxRunner || new SandboxRunner();

  const storageResolver = (
    workspaceId: string
  ): WorkspaceStorage => {
    const root = customStorageBaseDir
      ? path.join(customStorageBaseDir, workspaceId)
      : path.join(
          process.cwd(),
          'workspaces',
          workspaceId
        );

    return new WorkspaceStorage(workspaceId, root);
  };

  // ============================================================
  // Middleware
  // ============================================================

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ============================================================
  // Health Check
  // ============================================================

  app.get('/api/health', (_req: Request, res: Response) => {
    return res.status(200).json({
      status: 'ok',
      provider: config.aiProvider,
      archiveStorage: process.env.ARCHIVE_BUCKET
        ? 's3'
        : 'unconfigured'
    });
  });

  // ============================================================
  // CORS
  // ============================================================

  app.use(
    (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      const origin = req.headers.origin;

      if (
        origin &&
        config.allowedOrigins.includes(origin)
      ) {
        res.header(
          'Access-Control-Allow-Origin',
          origin
        );
      }

      res.header(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, PATCH, OPTIONS'
      );

      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id, x-anonymous-id, x-display-name'
      );

      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }

      next();
    }
  );

  // ============================================================
  // React Frontend
  // ============================================================

  const clientDistDir = path.resolve(
    process.cwd(),
    'dist',
    'client'
  );

  const fs = require('fs');

  if (fs.existsSync(clientDistDir)) {
    // React/Vite assets
    app.use(
      '/assets',
      express.static(
        path.join(clientDistDir, 'assets')
      )
    );

    // Serve files from the React build.
    //
    // IMPORTANT:
    // index: false prevents this middleware from automatically
    // serving public/index.html or dist/client/index.html for "/".
    //
    // The SPA fallback below handles HTML routes explicitly.
    app.use(
      express.static(clientDistDir, {
        index: false
      })
    );
  }

  // ============================================================
  // Legacy Public Static Files
  // ============================================================

  const publicDir = path.resolve(
    process.cwd(),
    'public'
  );

  app.use(
    express.static(publicDir, {
      index: false
    })
  );

  // ============================================================
  // REST API Routes
  // ============================================================

  app.use(
    '/api/auth',
    createAuthRouter()
  );

  app.use(
    '/api/credentials',
    createCredentialRouter()
  );

  app.use(
    '/api/orgs',
    createOrgRouter()
  );

  app.use(
    '/api',
    createInviteRouter()
  );

  app.use(
    '/api/workspaces/:id/mcp',
    createMcpRouter(storageResolver)
  );

  app.use(
    '/api/mcp',
    createMcpRouter(storageResolver)
  );

  app.use(
    '/api/github',
    createGithubRouter(storageResolver)
  );

  app.use(
    '/api/workspaces',
    createGithubRouter(storageResolver)
  );

  app.use(
    '/api/workspaces',
    createWorkspaceRouter(storageResolver)
  );

  app.use(
    '/api/workspaces/:id/files',
    createFileRouter(storageResolver)
  );

  app.use(
    '/api/workspaces/:id/threads',
    createThreadRouter()
  );

  app.use(
    '/api/workspaces/:id/tasks',
    createTaskRouter(storageResolver)
  );

  app.use(
    '/api/workspaces/:id/changes',
    createChangeRouter(storageResolver)
  );

  app.use(
    '/api/workspaces/:id/apps',
    createAppRouter(
      storageResolver,
      sandboxRunner
    )
  );

  app.use(
    '/api/workspaces/:id/connectors',
    createConnectorRouter(
      storageResolver
    )
  );

  app.use(
    '/api/workspaces/:id/tribal',
    createTribalRouter(
      storageResolver
    )
  );

  app.use(
    '/api/icm',
    createIcmRouter(
      storageResolver
    )
  );

  app.use(
    '/api/workspaces/:id/sessions',
    createSessionRouter(
      storageResolver
    )
  );

  app.use(
    '/api/workspaces/:id/skills',
    createSkillRouter()
  );

  app.use(
    '/api/workspaces/:id/knowledge-candidates',
    createCandidateRouter()
  );

  // ============================================================
  // Public Shareable Generated App
  // ============================================================

  app.get(
    '/apps/:slug',
    async (
      req: Request,
      res: Response
    ) => {
      try {
        const { prisma } =
          await import('../db/client');

        const app_ws =
          await prisma.appWorkspace.findUnique(
            {
              where: {
                slug: req.params.slug
              },
              include: {
                deployments: {
                  orderBy: {
                    deployedAt: 'desc'
                  },
                  take: 1
                }
              }
            }
          );

        if (
          !app_ws ||
          !app_ws.deployments[0] ||
          app_ws.deployments[0].status !==
            'DEPLOYED'
        ) {
          return res
            .status(404)
            .send(
              '<h1>App not found or not deployed</h1>'
            );
        }

        const fsModule =
          await import('fs');

        const pathModule =
          await import('path');

        const storage =
          storageResolver(
            app_ws.workspaceId
          );

        const appDir =
          pathModule.join(
            storage.workspaceRoot,
            'apps',
            app_ws.id
          );

        const indexPath =
          pathModule.join(
            appDir,
            'index.html'
          );

        if (
          !fsModule.existsSync(indexPath)
        ) {
          return res
            .status(404)
            .send(
              '<h1>App files not found</h1>'
            );
        }

        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; script-src 'unsafe-inline' 'self'; style-src 'unsafe-inline' 'self'; img-src 'self' data:"
        );

        res.setHeader(
          'Content-Type',
          'text/html; charset=utf-8'
        );

        return fsModule
          .createReadStream(indexPath)
          .pipe(res);
      } catch (err: any) {
        console.error(
          'Error loading generated app:',
          err
        );

        return res
          .status(500)
          .send(
            '<h1>Error loading app</h1>'
          );
      }
    }
  );

  // ============================================================
  // React SPA Fallback
  // ============================================================
  //
  // This MUST come after:
  // - static assets
  // - legacy public files
  // - API routes
  // - generated /apps/:slug route
  //
  // Any remaining GET request is treated as a React Router
  // client-side route.
  //
  // Examples:
  //
  //   /                  -> React index.html
  //   /workbench         -> React index.html
  //   /auth              -> React index.html
  //   /enter             -> React index.html
  //   /onboarding        -> React index.html
  //   /w/123             -> React index.html
  //
  // API and generated-app routes are excluded.
  // ============================================================

  if (fs.existsSync(clientDistDir)) {
    app.use(
      (
        req: Request,
        res: Response,
        next: NextFunction
      ) => {
        // Only GET requests should reach the
        // HTML SPA fallback.
        if (req.method !== 'GET') {
          return next();
        }

        // Never intercept API routes.
        if (
          req.path.startsWith('/api')
        ) {
          return next();
        }

        // Never intercept Socket.IO.
        if (
          req.path.startsWith(
            '/socket.io'
          )
        ) {
          return next();
        }

        // Never intercept generated applications.
        if (
          req.path.startsWith('/apps/')
        ) {
          return next();
        }

        // React/Vite frontend entry point.
        return res.sendFile(
          path.join(
            clientDistDir,
            'index.html'
          ),
          (err) => {
            if (err) {
              next(err);
            }
          }
        );
      }
    );
  }

  // ============================================================
  // Global Error Handler
  // ============================================================

  app.use(
    (
      err: any,
      _req: Request,
      res: Response,
      _next: NextFunction
    ) => {
      console.error(
        'Server error:',
        err
      );

      res.status(
        err.status || 500
      ).json({
        error:
          err.message ||
          'Internal Server Error'
      });
    }
  );

  // ============================================================
  // Background: Connector Scheduler (Phase 2 — auto-sync)
  // ============================================================
  // Starts the interval-based sync loop. Only workspaces with
  // ConnectorOptIn.enabled = true will be synced. Safe to call in
  // tests because stopScheduler() is exported from the module.
  startScheduler({
    pollIntervalMs: 60_000,
    storageBaseDir: customStorageBaseDir,
  });

  return app;
}