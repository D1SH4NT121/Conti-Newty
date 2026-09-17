import { Router, Request, Response } from 'express';
import { prisma } from '../../db/client';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth-middleware';

export function createInviteRouter(): Router {
  const router = Router();

  // ---------- Public / Pre-auth Inspection Endpoints ----------

  // Validate / Inspect an invite token
  router.get('/invites/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const invite = await prisma.orgInvite.findUnique({
        where: { token },
        include: {
          organization: { select: { id: true, name: true } },
          workspace: { select: { id: true, name: true } }
        }
      });

      if (!invite) {
        return res.status(404).json({ error: 'Invite not found or invalid' });
      }

      if (invite.consumedAt) {
        return res.status(400).json({ error: 'This invitation has already been used' });
      }

      if (new Date() > new Date(invite.expiresAt)) {
        return res.status(400).json({ error: 'This invitation has expired' });
      }

      return res.status(200).json({
        valid: true,
        invite: {
          id: invite.id,
          token: invite.token,
          email: invite.email,
          role: invite.role,
          organizationId: invite.organizationId,
          organizationName: invite.organization.name,
          workspaceId: invite.workspaceId,
          workspaceName: invite.workspace?.name || null,
          expiresAt: invite.expiresAt
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Validate / Inspect a join code
  router.get('/join-codes/:code/validate', async (req: Request, res: Response) => {
    try {
      const codeParam = req.params.code.trim().toUpperCase();
      const joinCode = await prisma.orgJoinCode.findUnique({
        where: { code: codeParam },
        include: {
          organization: { select: { id: true, name: true } },
          workspace: { select: { id: true, name: true } }
        }
      });

      if (!joinCode) {
        return res.status(404).json({ error: 'Join code not found or invalid' });
      }

      if (joinCode.revoked) {
        return res.status(400).json({ error: 'This join code has been revoked' });
      }

      if (joinCode.expiresAt && new Date() > new Date(joinCode.expiresAt)) {
        return res.status(400).json({ error: 'This join code has expired' });
      }

      if (joinCode.maxUses && joinCode.useCount >= joinCode.maxUses) {
        return res.status(400).json({ error: 'This join code has reached its maximum number of uses' });
      }

      return res.status(200).json({
        valid: true,
        organizationId: joinCode.organizationId,
        organizationName: joinCode.organization.name,
        workspaceId: joinCode.workspaceId,
        workspaceName: joinCode.workspace?.name || null,
        role: joinCode.role
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // ---------- Authenticated Join / Redeem Actions ----------

  // Accept an invite token
  router.post('/invites/:token/accept', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { token } = req.params;
      const user = req.user!;

      const invite = await prisma.orgInvite.findUnique({
        where: { token },
        include: {
          organization: true,
          workspace: true
        }
      });

      if (!invite) {
        return res.status(404).json({ error: 'Invite not found or invalid' });
      }

      if (invite.consumedAt) {
        return res.status(400).json({ error: 'This invitation has already been used' });
      }

      if (new Date() > new Date(invite.expiresAt)) {
        return res.status(400).json({ error: 'This invitation has expired' });
      }

      // Execute membership creation and mark consumed in transaction with atomic check
      await prisma.$transaction(async (tx) => {
        // Atomic compare-and-consume to prevent race condition
        const updateResult = await tx.orgInvite.updateMany({
          where: {
            id: invite.id,
            consumedAt: null
          },
          data: {
            consumedAt: new Date()
          }
        });

        if (updateResult.count === 0) {
          throw new Error('This invitation has already been used');
        }

        // 1. Ensure user has membership in the organization
        const existingMembership = await tx.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: invite.organizationId
            }
          }
        });

        if (!existingMembership) {
          await tx.membership.create({
            data: {
              userId: user.id,
              organizationId: invite.organizationId,
              role: invite.role || 'MEMBER'
            }
          });
        }

        // 2. If invite is tied to a workspace, add user to WorkspaceMember
        if (invite.workspaceId) {
          const existingWsMember = await tx.workspaceMember.findUnique({
            where: {
              userId_workspaceId: {
                userId: user.id,
                workspaceId: invite.workspaceId
              }
            }
          });

          if (!existingWsMember) {
            await tx.workspaceMember.create({
              data: {
                userId: user.id,
                workspaceId: invite.workspaceId,
                role: invite.role.toLowerCase() === 'owner' ? 'admin' : 'member'
              }
            });
          }

          // Track lastWorkspaceId
          await tx.user.update({
            where: { id: user.id },
            data: { lastWorkspaceId: invite.workspaceId }
          });
        }
      });

      const nextRoute = invite.workspaceId ? `/w/${invite.workspaceId}/home` : '/onboarding';

      return res.status(200).json({
        success: true,
        message: `Successfully joined ${invite.organization.name}`,
        organizationId: invite.organizationId,
        workspaceId: invite.workspaceId,
        nextRoute
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Decline an invite token
  router.post('/invites/:token/decline', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { token } = req.params;
      const user = req.user!;
      const { computePostAuthRoute } = require('../../modules/auth/user-organization-service');

      const invite = await prisma.orgInvite.findUnique({
        where: { token }
      });

      if (!invite) {
        return res.status(404).json({ error: 'Invite not found or invalid' });
      }

      // Mark consumed/declined for audit
      await prisma.orgInvite.updateMany({
        where: { id: invite.id },
        data: { consumedAt: new Date() }
      });

      const nextRoute = await computePostAuthRoute(user);

      return res.status(200).json({
        success: true,
        message: 'Invitation declined',
        nextRoute
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Redeem a join code
  router.post('/join-codes/redeem', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'Join code is required' });
      }

      const codeParam = code.trim().toUpperCase();
      const user = req.user!;

      const joinCode = await prisma.orgJoinCode.findUnique({
        where: { code: codeParam },
        include: {
          organization: true,
          workspace: true
        }
      });

      if (!joinCode) {
        return res.status(404).json({ error: 'Invalid join code' });
      }

      if (joinCode.revoked) {
        return res.status(400).json({ error: 'This join code has been revoked' });
      }

      if (joinCode.expiresAt && new Date() > new Date(joinCode.expiresAt)) {
        return res.status(400).json({ error: 'This join code has expired' });
      }

      if (joinCode.maxUses && joinCode.useCount >= joinCode.maxUses) {
        return res.status(400).json({ error: 'This join code has reached its maximum number of uses' });
      }

      // Execute redemption in transaction with atomic increment and cap enforcement
      await prisma.$transaction(async (tx) => {
        // Atomic compare-and-increment
        const updateWhere: any = {
          id: joinCode.id,
          revoked: false
        };
        if (joinCode.maxUses) {
          updateWhere.useCount = { lt: joinCode.maxUses };
        }

        const updateResult = await tx.orgJoinCode.updateMany({
          where: updateWhere,
          data: {
            useCount: { increment: 1 }
          }
        });

        if (updateResult.count === 0) {
          throw new Error('This join code has reached its maximum number of uses or is invalid');
        }

        // 1. Ensure Membership in organization
        const existingMembership = await tx.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: joinCode.organizationId
            }
          }
        });

        if (!existingMembership) {
          await tx.membership.create({
            data: {
              userId: user.id,
              organizationId: joinCode.organizationId,
              role: joinCode.role || 'MEMBER'
            }
          });
        }

        // 2. If code has workspaceId, ensure WorkspaceMember
        if (joinCode.workspaceId) {
          const existingWsMember = await tx.workspaceMember.findUnique({
            where: {
              userId_workspaceId: {
                userId: user.id,
                workspaceId: joinCode.workspaceId
              }
            }
          });

          if (!existingWsMember) {
            await tx.workspaceMember.create({
              data: {
                userId: user.id,
                workspaceId: joinCode.workspaceId,
                role: joinCode.role.toLowerCase() === 'owner' ? 'admin' : 'member'
              }
            });
          }

          // Track lastWorkspaceId
          await tx.user.update({
            where: { id: user.id },
            data: { lastWorkspaceId: joinCode.workspaceId }
          });
        }
      });

      const nextRoute = joinCode.workspaceId ? `/w/${joinCode.workspaceId}/home` : '/onboarding';

      return res.status(200).json({
        success: true,
        message: `Successfully joined ${joinCode.organization.name}`,
        organizationId: joinCode.organizationId,
        workspaceId: joinCode.workspaceId,
        nextRoute
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
}
