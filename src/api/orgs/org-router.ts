import { Router, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../db/client';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth-middleware';

export function createOrgRouter(): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgs = await prisma.organization.findMany({
        include: { _count: { select: { workspaces: true, users: true } } }
      });
      return res.status(200).json(orgs);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { name, description } = req.body;
      if (!name) {
        return res.status(400).json({ error: 'Name is required' });
      }

      const org = await prisma.organization.create({
        data: { name, description }
      });

      // Link user membership as OWNER
      await prisma.membership.create({
        data: {
          organizationId: org.id,
          userId: req.user!.id,
          role: 'OWNER'
        }
      });

      return res.status(201).json(org);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Get all members of an organization
  router.get('/:id/members', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.params.id;
      const members = await prisma.membership.findMany({
        where: { organizationId: orgId },
        include: { user: { select: { id: true, email: true, name: true, role: true } } }
      });
      return res.status(200).json(members);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Get all workspaces under an organization (multi-workbench)
  router.get('/:id/workspaces', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.params.id;
      const workspaces = await prisma.workspace.findMany({
        where: { organizationId: orgId },
        include: { _count: { select: { members: true, threads: true, appWorkspaces: true } } }
      });
      return res.status(200).json(workspaces);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Create an invite link/token for a specific email
  router.post('/:id/members/invite', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.params.id;
      const { email, role = 'MEMBER', workspaceId, expiresInDays = 7 } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      // Check permission
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: req.user!.id,
            organizationId: orgId
          }
        }
      });
      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this organization' });
      }

      // Generate 256-bit cryptographically secure unguessable invite token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      const invite = await prisma.orgInvite.create({
        data: {
          token,
          email: email.trim().toLowerCase(),
          role: role.toUpperCase(),
          organizationId: orgId,
          workspaceId: workspaceId || null,
          invitedById: req.user!.id,
          expiresAt
        }
      });

      return res.status(201).json({
        invite: {
          id: invite.id,
          token: invite.token,
          email: invite.email,
          role: invite.role,
          organizationId: invite.organizationId,
          workspaceId: invite.workspaceId,
          expiresAt: invite.expiresAt,
          inviteUrl: `/enter?invite=${invite.token}`
        }
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Generate a shareable join code for organization
  router.post('/:id/join-codes', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.params.id;
      const { role = 'MEMBER', workspaceId, expiresInHours, maxUses } = req.body;

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: req.user!.id,
            organizationId: orgId
          }
        }
      });
      if (!membership) {
        return res.status(403).json({ error: 'You are not a member of this organization' });
      }

      // Generate cryptographically random shareable join code (e.g. CN-A1B2C3D4)
      const randomSegment = crypto.randomBytes(4).toString('hex').toUpperCase();
      const code = `CN-${randomSegment}`;

      const expiresAt = expiresInHours
        ? new Date(Date.now() + Number(expiresInHours) * 60 * 60 * 1000)
        : null;

      const joinCode = await prisma.orgJoinCode.create({
        data: {
          code,
          organizationId: orgId,
          workspaceId: workspaceId || null,
          role: role.toUpperCase(),
          expiresAt,
          maxUses: maxUses ? parseInt(maxUses, 10) : null,
          createdById: req.user!.id
        }
      });

      return res.status(201).json({ joinCode });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // List join codes for organization
  router.get('/:id/join-codes', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.params.id;
      const joinCodes = await prisma.orgJoinCode.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' }
      });
      return res.status(200).json(joinCodes);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Revoke a join code
  router.delete('/:id/join-codes/:codeId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: orgId, codeId } = req.params;
      await prisma.orgJoinCode.updateMany({
        where: { id: codeId, organizationId: orgId },
        data: { revoked: true }
      });
      return res.status(200).json({ success: true, message: 'Join code revoked' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Bulk invite users to organization
  router.post('/:id/invites', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.params.id;
      const { invites } = req.body;
      const { AuthService } = require('../../modules/auth/auth-service');
      const authService = new AuthService();

      if (!Array.isArray(invites) || invites.length === 0) {
        return res.status(400).json({ error: 'Array of user invites is required' });
      }

      const invitedUsers = [];

      for (const inv of invites) {
        if (!inv.email) continue;
        const normalizedEmail = inv.email.trim().toLowerCase();
        let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

        if (!user) {
          const tempPassword = 'UserInviteTemp123!';
          const passwordHash = authService.hashPassword(tempPassword);
          user = await prisma.user.create({
            data: {
              email: normalizedEmail,
              name: inv.name || normalizedEmail.split('@')[0],
              passwordHash,
              organizationId: orgId
            }
          });
        }

        // Upsert organization membership
        const role = inv.role?.toUpperCase() || 'MEMBER';
        await prisma.membership.upsert({
          where: {
            userId_organizationId: {
              userId: user.id,
              organizationId: orgId
            }
          },
          create: {
            userId: user.id,
            organizationId: orgId,
            role
          },
          update: { role }
        });

        invitedUsers.push({ id: user.id, email: user.email, name: user.name, role });
      }

      return res.status(200).json({
        success: true,
        invitedCount: invitedUsers.length,
        users: invitedUsers
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
