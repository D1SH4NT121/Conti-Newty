import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../modules/auth/auth-service';
import { prisma } from '../db/client';

const authService = new AuthService();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
    role?: string;
  };
  workspaceMember?: {
    role: string;
    workspaceId: string;
  };
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const r = req as AuthenticatedRequest;
  try {
    const authHeader = req.headers.authorization;
    const directUserId = req.headers['x-user-id'] as string;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const user = await authService.getUserFromToken(token);
      if (user) {
        r.user = {
          id: user.id,
          email: user.email,
          name: user.name || '',
          avatarUrl: user.avatarUrl || null,
          role: user.role || 'USER'
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
          role: user.role || 'USER'
        };
        return next();
      }
    }

    return res.status(401).json({
      error: 'Unauthorized: Valid authentication token or credentials required'
    });
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

      const workspaceId = req.params.workspaceId || req.params.id || req.body?.workspaceId;
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

      if (!membership) {
        return res.status(403).json({
          error: 'Forbidden: You do not have access to this workspace'
        });
      }

      const userWeight = roleWeights[membership.role.toLowerCase()] || 0;
      const requiredWeight = roleWeights[minRole] || 1;

      if (userWeight < requiredWeight) {
        return res.status(403).json({
          error: `Forbidden: Requires at least '${minRole}' role on this workspace`
        });
      }

      r.workspaceMember = {
        role: membership.role,
        workspaceId
      };

      // Automatically update user's last accessed workspace on every workspace interaction
      if (r.user?.id && workspaceId) {
        prisma.user.update({
          where: { id: r.user.id },
          data: { lastWorkspaceId: workspaceId }
        }).catch(() => {});
      }

      return next();
    } catch (err: any) {
      return res.status(500).json({ error: 'Authorization error: ' + err.message });
    }
  };
}
