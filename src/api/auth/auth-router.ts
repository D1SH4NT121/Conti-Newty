import { Router, Request, Response } from 'express';
import { prisma } from '../../db/client';
import { AuthService } from '../../modules/auth/auth-service';
import { oauthService } from '../../modules/auth/oauth-service';
import { createDefaultUserWithOrg, computePostAuthRoute } from '../../modules/auth/user-organization-service';
import { config } from '../../config';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth-middleware';
import { WorkspaceStorage } from '../../modules/storage/workspace-storage';
import { seedWorkspaceIcmTemplate } from '../../modules/storage/icm-templates';

const DEMO_CORPUS: Array<{ path: string; content: string }> = [
  {
    path: 'company_brain/docs/conti-newty-platform/launch-plan.md',
    content: `# Platform Launch Plan

## Goal
Ship the Company Brain beta for the WeMakeDevs Ship It showcase.

## Current status
- GitHub ingestion and source citations are ready.
- Multiplayer task rooms are in final polish.
- The public demo must require no signup or API keys.

## Owners
- Product: Aisha
- Engineering: Rohan
- Developer experience: Maya
`,
  },
  {
    path: 'company_brain/docs/conti-newty-platform/architecture.md',
    content: `# Company Brain Architecture

The ingestion layer normalizes GitHub, Slack, Jira, Drive, and Tribal Memory into connected memories. Every answer should retain source, author, timestamp, and a linkable citation.

The AI relay uses Researcher, Critic, and Synthesizer roles in a shared multiplayer room.
`,
  },
  {
    path: 'company_brain/docs/conti-newty-platform/README.md',
    content: `# Conti-Newty Platform

Demo repository: Company Brain, source-grounded AI, and human-steered multiplayer agents.
`,
  },
  {
    path: 'connectors/slack/engineering-launch.md',
    content: `# #engineering-launch

**2026-09-18 — Rohan:** GitHub imports are now visible in the Brain. Please verify citations before the demo.

**2026-09-19 — Aisha:** The judge flow should open directly into the seeded workspace. No connector setup during the presentation.

**2026-09-20 — Maya:** I will review the multiplayer room and handoff flow.
`,
  },
  {
    path: 'connectors/slack/product-decisions.md',
    content: `# #product-decisions

**Decision:** Keep Company Brain chat below the source document so the answer stays grounded in context.

**Why:** Reviewers can inspect evidence and ask follow-up questions without leaving the memory surface.
`,
  },
  {
    path: 'connectors/jira/CB-101.md',
    content: `# CB-101: Ship public demo workspace

**Status:** In Progress
**Priority:** Highest
**Assignee:** Aisha

Prepare a seeded, read-only demo workspace with realistic cross-source data and no sign-in flow for judges.
`,
  },
  {
    path: 'connectors/jira/CB-102.md',
    content: `# CB-102: Add multiplayer agent handoff

**Status:** Done
**Priority:** High
**Assignee:** Rohan

Show presence, task-room events, discussion, driver handoff, and correction capture in one session.
`,
  },
  {
    path: 'connectors/drive/company-overview.md',
    content: `# Company Overview

Conti-Newty is a connected Company Brain for teams. It turns work already happening in tools into searchable, cited, reusable memory.

## Principles
1. Evidence before confidence.
2. Humans steer important agent work.
3. Corrections become institutional knowledge.
`,
  },
  {
    path: 'connectors/drive/demo-brief.md',
    content: `# Demo Brief

Ask: “What changed in the launch project, who decided it, and what is blocked?”

Expected answer: cite the GitHub launch plan, Slack decision thread, and Jira issue CB-101.
`,
  },
  {
    path: 'connectors/drive/customer-research.md',
    content: `# Customer Research

Teams want answers that connect a meeting note to the Slack discussion, the Jira action item, and the final playbook. The Company Brain should make those relationships visible.
`,
  },
];

async function ensureDemoCorpus(storage: WorkspaceStorage, workspaceId: string, userId: string): Promise<void> {
  for (const item of DEMO_CORPUS) {
    const existing = await storage.readFile(item.path).catch(() => null);
    if (!existing) await storage.writeFile(item.path, item.content);
  }

  const tribalEntries = [
    {
      title: 'Evidence-first answers',
      content: 'Company Brain answers must cite the source memories used to produce them.',
      tags: ['decision', 'quality'],
    },
    {
      title: 'Human steering is part of the agent loop',
      content: 'A Driver can redirect, pause, or hand off an agent run. Corrections should be captured for future sessions.',
      tags: ['best-practice', 'multiplayer'],
    },
  ];
  for (const entry of tribalEntries) {
    const exists = await prisma.tribalMemoryEntry.findFirst({
      where: { workspaceId, title: entry.title },
      select: { id: true },
    });
    if (!exists) {
      await prisma.tribalMemoryEntry.create({
        data: {
          workspaceId,
          authorId: userId,
          title: entry.title,
          content: entry.content,
          tags: JSON.stringify(entry.tags),
          searchText: `${entry.title} ${entry.content} ${entry.tags.join(' ')}`,
          source: 'manual',
        },
      });
    }
  }
}

export function createAuthRouter(): Router {
  const router = Router();
  const authService = new AuthService();

  router.post('/demo/session', async (_req: Request, res: Response) => {
    try {
      if (process.env.DEMO_ENABLED === 'false') {
        return res.status(404).json({ error: 'Demo access is disabled' });
      }

      const demoEmail = process.env.DEMO_USER_EMAIL || 'demo@conti-newty.local';
      const demoWorkspaceId = process.env.DEMO_WORKSPACE_ID;
      let org = await prisma.organization.findFirst({ where: { name: 'Conti-Newty Demo' } });
      if (!org) {
        org = await prisma.organization.create({
          data: { name: 'Conti-Newty Demo', description: 'Read-only hackathon demonstration environment' }
        });
      }

      let user = await prisma.user.findUnique({ where: { email: demoEmail } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: demoEmail,
            name: 'Hackathon Demo Guest',
            role: 'PUBLIC',
            organizationId: org.id
          }
        });
      } else if (user.role !== 'PUBLIC') {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: 'PUBLIC' }
        });
      }

      let workspace = demoWorkspaceId
        ? await prisma.workspace.findUnique({ where: { id: demoWorkspaceId } })
        : await prisma.workspace.findFirst({ where: { organizationId: org.id, name: 'Company Brain Demo' } });
      if (!workspace) {
        workspace = await prisma.workspace.create({
          data: {
            ...(demoWorkspaceId ? { id: demoWorkspaceId } : {}),
            name: 'Company Brain Demo',
            description: 'Curated Company Brain for the WeMakeDevs Ship It demo',
            organizationId: org.id
          }
        });
      }

      await prisma.workspaceMember.upsert({
        where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
        update: { role: 'member' },
        create: { userId: user.id, workspaceId: workspace.id, role: 'member' }
      });
      await prisma.user.update({ where: { id: user.id }, data: { lastWorkspaceId: workspace.id } });

      const storage = new WorkspaceStorage(workspace.id);
      const files = await storage.listDirectory('');
      if (files.length === 0) {
        await seedWorkspaceIcmTemplate(storage);
        await storage.createFile(
          'docs/demo-brief.md',
          '# Conti-Newty Demo Brief\n\nConti-Newty turns GitHub, Slack, and institutional documents into a permission-aware Company Brain. Ask questions, inspect citations, and collaborate with agents in real time.\n'
        );
      }
      await ensureDemoCorpus(storage, workspace.id, user.id);

      const demoTtlSeconds = Math.max(
        3600,
        parseInt(process.env.DEMO_SESSION_TTL_SECONDS || `${30 * 24 * 60 * 60}`, 10)
      );
      const token = authService.generateToken({
        userId: user.id,
        email: user.email,
        purpose: 'public-demo',
        demoWorkspaceId: workspace.id
      }, demoTtlSeconds);
      return res.json({ token, workspaceId: workspace.id, nextRoute: `/w/${workspace.id}/home` });
    } catch (err: any) {
      return res.status(500).json({ error: `Unable to start demo: ${err.message}` });
    }
  });

  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await prisma.user.findUnique({
        where: { email }
      });

      if (!user || !user.passwordHash) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = authService.verifyPassword(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const token = authService.generateToken({
        userId: user.id,
        email: user.email
      });

      const nextRoute = await computePostAuthRoute(user);

      return res.status(200).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl || null,
          organizationId: user.organizationId
        },
        nextRoute
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'User with this email already exists' });
      }

      const passwordHash = authService.hashPassword(password);
      const user = await createDefaultUserWithOrg({
        email,
        name: name || undefined,
        passwordHash
      });

      const token = authService.generateToken({
        userId: user.id,
        email: user.email
      });

      const nextRoute = await computePostAuthRoute(user);

      return res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl || null,
          organizationId: user.organizationId
        },
        nextRoute
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const nextRoute = await computePostAuthRoute(req.user);
    return res.status(200).json({ user: req.user, nextRoute });
  });

  router.put('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { name, avatarUrl, currentPassword, newPassword } = req.body;
      const user = await prisma.user.findUnique({
        where: { id: req.user.id }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const updateData: { name?: string | null; avatarUrl?: string | null; passwordHash?: string } = {};

      if (typeof name !== 'undefined') {
        updateData.name = name ? String(name).trim() : null;
      }

      if (typeof avatarUrl !== 'undefined') {
        updateData.avatarUrl = avatarUrl ? String(avatarUrl).trim() : null;
      }

      if (newPassword) {
        if (user.passwordHash) {
          if (!currentPassword) {
            return res.status(400).json({ error: 'Current password is required to set a new password' });
          }
          const valid = authService.verifyPassword(currentPassword, user.passwordHash);
          if (!valid) {
            return res.status(400).json({ error: 'Incorrect current password' });
          }
        }
        updateData.passwordHash = authService.hashPassword(newPassword);
      }

      const updated = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData
      });

      return res.status(200).json({
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
          avatarUrl: updated.avatarUrl || null,
          organizationId: updated.organizationId
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ---------- Google OAuth ----------
  router.get('/google', (req: Request, res: Response) => {
    if (!config.googleClientId || !config.googleClientSecret) {
      return res.status(501).json({ error: 'Google OAuth is not configured on the server' });
    }
    const { invite, code } = req.query;
    const statePayload = {
      invite: invite ? String(invite) : undefined,
      code: code ? String(code) : undefined
    };
    const encodedState = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
    return res.redirect(oauthService.googleAuthUrl(encodedState));
  });

  router.get('/google/callback', async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;
      const err = req.query.error as string | undefined;
      if (err) return oauthService.redirectWithError(res, `Google: ${err}`);
      if (!code) return oauthService.redirectWithError(res, 'Google: missing authorization code');

      let inviteToken: string | undefined;
      let joinCode: string | undefined;
      if (state) {
        try {
          const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
          inviteToken = parsed.invite;
          joinCode = parsed.code;
        } catch {
          // Ignore invalid base64 state payload
        }
      }

      const profile = await oauthService.handleGoogleCallback(code);
      const user = await oauthService.findOrCreateOAuthUser('google', profile);
      return oauthService.redirectWithToken(res, user, { inviteToken, joinCode });
    } catch (e: any) {
      return oauthService.redirectWithError(res, e.message || 'Google sign-in failed');
    }
  });

  // ---------- GitHub OAuth ----------
  router.get('/github', (req: Request, res: Response) => {
    if (!config.githubClientId || !config.githubClientSecret) {
      return res.status(501).json({ error: 'GitHub OAuth is not configured on the server' });
    }
    const { invite, code, return_to } = req.query;
    const statePayload = {
      invite: invite ? String(invite) : undefined,
      code: code ? String(code) : undefined,
      return_to: return_to ? String(return_to) : undefined
    };
    const encodedState = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
    return res.redirect(oauthService.githubAuthUrl(encodedState));
  });

  router.get('/github/connect', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    if (!config.githubClientId || !config.githubClientSecret) {
      return res.status(501).json({ error: 'GitHub OAuth is not configured on the server' });
    }
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const workspaceId = typeof req.query.workspace_id === 'string' ? req.query.workspace_id : '';
    if (workspaceId) {
      return prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: req.user.id, workspaceId } }
      }).then((membership) => {
        if (!membership) return res.status(403).json({ error: 'You do not have access to this workspace' });
        const connectToken = authService.generateToken({
          userId: req.user!.id,
          email: req.user!.email,
          purpose: 'github-connect'
        }, 600);
        const statePayload = {
          connectToken,
          return_to: `/onboarding?workspace_id=${encodeURIComponent(workspaceId)}`
        };
        const encodedState = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
        return res.json({ url: oauthService.githubAuthUrl(encodedState) });
      });
    }

    const connectToken = authService.generateToken({
      userId: req.user.id,
      email: req.user.email,
      purpose: 'github-connect'
    }, 600);
    const statePayload = { connectToken, return_to: '/onboarding' };
    const encodedState = Buffer.from(JSON.stringify(statePayload)).toString('base64url');
    return res.json({ url: oauthService.githubAuthUrl(encodedState) });
  });

  router.get('/github/callback', async (req: Request, res: Response) => {
    try {
      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;
      const err = req.query.error as string | undefined;
      if (err) return oauthService.redirectWithError(res, `GitHub: ${err}`);
      if (!code) return oauthService.redirectWithError(res, 'GitHub: missing authorization code');

      let inviteToken: string | undefined;
      let joinCode: string | undefined;
      let returnTo: string | undefined;
      let connectedUserId: string | undefined;
      if (state) {
        try {
          const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
          inviteToken = parsed.invite;
          joinCode = parsed.code;
          returnTo = parsed.return_to;
          if (parsed.connectToken) {
            const connectPayload = authService.verifyToken(parsed.connectToken);
            if (connectPayload?.purpose === 'github-connect') {
              connectedUserId = connectPayload.userId;
            }
          }
        } catch {
          // Ignore invalid base64 state payload
        }
      }

      const profile = await oauthService.handleGithubCallback(code);
      let user;
      if (connectedUserId) {
        const linkedUser = await prisma.user.findFirst({ where: { githubId: profile.providerId } });
        if (linkedUser && linkedUser.id !== connectedUserId) {
          throw new Error('This GitHub account is already linked to another Conti-Newty user');
        }
        user = await prisma.user.update({
          where: { id: connectedUserId },
          data: {
            githubId: profile.providerId,
            avatarUrl: profile.avatarUrl
          }
        });
      } else {
        user = await oauthService.findOrCreateOAuthUser('github', profile);
      }
      return oauthService.redirectWithToken(res, user, {
        inviteToken,
        joinCode,
        githubToken: profile.accessToken,
        returnTo,
        githubConnect: Boolean(connectedUserId)
      });
    } catch (e: any) {
      return oauthService.redirectWithError(res, e.message || 'GitHub sign-in failed');
    }
  });

  return router;
}
