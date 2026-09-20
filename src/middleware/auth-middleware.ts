import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../modules/auth/auth-service';
import { prisma } from '../db/client';
import { randomUUID } from 'crypto';

const authService = new AuthService();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
    role?: string;
    lastWorkspaceId?: string | null;
    organizationId?: string | null;
  };
  workspaceMember?: {
    role: string;
    workspaceId: string;
  };
}

async function getOrCreateAnonymousUser(req: Request) {
  const anonymousIdHeader = req.headers['x-anonymous-id'];
  const anonymousId = typeof anonymousIdHeader === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(anonymousIdHeader)
    ? anonymousIdHeader
    : randomUUID();
  const displayNameHeader = req.headers['x-display-name'];
  const displayName = typeof displayNameHeader === 'string' && displayNameHeader.trim()
    ? displayNameHeader.trim().slice(0, 80)
    : 'Guest';
  const email = `anonymous-${anonymousId}@local.invalid`;

  let organization = await prisma.organization.findFirst({ where: { name: 'Public Hackathon' } });
  if (!organization) {
    organization = await prisma.organization.create({ data: { name: 'Public Hackathon' } });
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { name: displayName, organizationId: organization.id, role: 'PUBLIC' },
    create: { email, name: displayName, role: 'PUBLIC', organizationId: organization.id }
  });
  req.res?.setHeader('x-anonymous-id', anonymousId);
  return user;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const r = req as AuthenticatedRequest;
  try {
    if (r.user) {
      return next();
    }

    const authHeader = req.headers.authorization;
    const directUserId = req.headers['x-user-id'] as string;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      if (token.startsWith('cnty_mcp_')) {
        // Dedicated MCP token handled by mcpAuthMiddleware
        return next();
      }
      const user = await authService.getUserFromToken(token);
      if (user) {
        r.user = {
          id: user.id,
          email: user.email,
          name: user.name || '',
          avatarUrl: user.avatarUrl || null,
          role: user.role || 'USER',
          lastWorkspaceId: user.lastWorkspaceId,
          organizationId: user.organizationId
        };
        return next();
      }
    } else if (directUserId) {
      const user = await prisma.user.findUnique({
        where: { id: directUserId }
      });
      if (user) {
        r.user = {
          id: user.id,
          email: user.email,
          name: user.name || '',
          avatarUrl: user.avatarUrl || null,
          role: user.role || 'USER',
          lastWorkspaceId: user.lastWorkspaceId,
          organizationId: user.organizationId
        };
        return next();
      }
    }

    const user = await getOrCreateAnonymousUser(req);
    r.user = {
      id: user.id,
      email: user.email,
      name: user.name || 'Guest',
      avatarUrl: user.avatarUrl || null,
      role: user.role || 'USER',
      lastWorkspaceId: user.lastWorkspaceId,
      organizationId: user.organizationId
    };
    return next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Authentication internal error: ' + err.message });
  }
}

export function requireWorkspaceRole(minRole: 'viewer' | 'member' | 'admin' = 'viewer') {
  const roleWeights: Record<string, number> = {
    viewer: 1,
    member: 2,
    admin: 3,
    owner: 4
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    const r = req as AuthenticatedRequest;
    try {
      if (!r.user) {
        return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
      }

      const workspaceId =
        req.params.workspaceId ||
        req.params.id ||
        (req as any).workspaceId ||
        (req.headers['x-workspace-id'] as string) ||
        req.body?.workspaceId;
      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }

      const membership = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            workspaceId,
            userId: r.user!.id
          }
        }
      });

      const ensuredMembership = membership || await prisma.workspaceMember.create({
        data: { workspaceId, userId: r.user!.id, role: 'member' }
      });

      const userWeight = roleWeights[ensuredMembership.role.toLowerCase()] || 0;
      const requiredWeight = roleWeights[minRole] || 1;

      if (userWeight < requiredWeight) {
        return res.status(403).json({
          error: `Forbidden: Requires at least '${minRole}' role on this workspace`
        });
      }

      r.workspaceMember = {
        role: ensuredMembership.role,
        workspaceId
      };

      if (!req.params.workspaceId) req.params.workspaceId = workspaceId;
      if (!req.params.id) req.params.id = workspaceId;

      // Update user's last accessed workspace if it changed
      if (r.user?.id && workspaceId && r.user.lastWorkspaceId !== workspaceId) {
        r.user.lastWorkspaceId = workspaceId;
        await prisma.user.update({
          where: { id: r.user.id },
          data: { lastWorkspaceId: workspaceId }
        }).catch((_e) => {
          // Ignore non-critical lastWorkspaceId update failure
        });
      }

      return next();
    } catch (err: any) {
      return res.status(500).json({ error: 'Authorization error: ' + err.message });
    }
  };
}

export function requireExplicitAuthentication(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const hasBearerToken = typeof req.headers.authorization === 'string'
    && req.headers.authorization.startsWith('Bearer ');
  const hasDirectUser = typeof req.headers['x-user-id'] === 'string'
    && req.headers['x-user-id'].length > 0;

  if (!hasBearerToken && !hasDirectUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  return next();
}
