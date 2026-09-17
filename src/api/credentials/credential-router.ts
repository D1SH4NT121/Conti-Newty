import { Router, Response } from 'express';
import { prisma } from '../../db/client';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth-middleware';
import { CredentialVault } from '../../modules/auth/credential-vault';

export function createCredentialRouter(): Router {
  const router = Router();
  router.use(authMiddleware);

  // List active credentials (masked)
  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const workspaceId = req.query.workspaceId as string | undefined;

      const whereClause: any = {
        status: 'ACTIVE',
        OR: [{ userId }]
      };

      if (workspaceId) {
        whereClause.OR.push({ workspaceId });
      }

      const creds = await prisma.providerCredential.findMany({
        where: whereClause,
        select: {
          id: true,
          kind: true,
          provider: true,
          label: true,
          userId: true,
          workspaceId: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return res.json(creds);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // Store new credential
  router.post('/', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { provider, secret, kind = 'BYOK', label, workspaceId } = req.body;

      if (!provider || !secret) {
        return res.status(400).json({ error: 'Provider and secret are required' });
      }

      const secretEnc = CredentialVault.encrypt(secret);

      const cred = await prisma.providerCredential.create({
        data: {
          kind,
          provider: provider.toLowerCase(),
          label: label || `${provider.toUpperCase()} Key`,
          secretEnc,
          userId: kind === 'BYOK' ? userId : null,
          workspaceId: kind === 'CLI_OAUTH' ? workspaceId : null,
          createdById: userId
        },
        select: {
          id: true,
          kind: true,
          provider: true,
          label: true,
          createdAt: true
        }
      });

      return res.status(201).json(cred);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // Revoke credential
  router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const cred = await prisma.providerCredential.findUnique({ where: { id } });
      if (!cred) {
        return res.status(404).json({ error: 'Credential not found' });
      }

      // Check ownership
      if (cred.userId !== userId && cred.createdById !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await prisma.providerCredential.update({
        where: { id },
        data: { status: 'REVOKED' }
      });

      return res.json({ success: true, message: 'Credential revoked' });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  return router;
}
