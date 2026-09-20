import { Router, Request, Response } from 'express';
import { prisma } from '../../db/client';
import { AuthService } from '../../modules/auth/auth-service';
import { oauthService } from '../../modules/auth/oauth-service';
import { createDefaultUserWithOrg, computePostAuthRoute } from '../../modules/auth/user-organization-service';
import { config } from '../../config';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth-middleware';

export function createAuthRouter(): Router {
  const router = Router();
  const authService = new AuthService();

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
      if (state) {
        try {
          const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
          inviteToken = parsed.invite;
          joinCode = parsed.code;
          returnTo = parsed.return_to;
        } catch {
          // Ignore invalid base64 state payload
        }
      }

      const profile = await oauthService.handleGithubCallback(code);
      const user = await oauthService.findOrCreateOAuthUser('github', profile);
      return oauthService.redirectWithToken(res, user, {
        inviteToken,
        joinCode,
        githubToken: profile.accessToken,
        returnTo
      });
    } catch (e: any) {
      return oauthService.redirectWithError(res, e.message || 'GitHub sign-in failed');
    }
  });

  return router;
}
