import { Router, Response } from 'express';
import { prisma } from '../../db/client';
import { authMiddleware, requireWorkspaceRole, AuthenticatedRequest } from '../../middleware/auth-middleware';

export function createThreadRouter(): Router {
  const router = Router({ mergeParams: true });

  router.use(authMiddleware);

  // List threads in workspace
  router.get('/', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const threads = await prisma.thread.findMany({
        where: { workspaceId },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          _count: { select: { messages: true } }
        },
        orderBy: { updatedAt: 'desc' }
      });
      return res.status(200).json(threads);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Create thread
  router.post('/', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const thread = await prisma.thread.create({
        data: {
          title,
          workspaceId,
          createdById: req.user!.id
        }
      });
      return res.status(201).json(thread);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Get messages for a thread
  router.get('/:threadId/messages', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { threadId } = req.params;
      const messages = await prisma.message.findMany({
        where: { threadId },
        include: {
          author: { select: { id: true, name: true, email: true } }
        },
        orderBy: { createdAt: 'asc' }
      });
      return res.status(200).json(messages);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Add message to thread
  router.post('/:threadId/messages', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { threadId } = req.params;
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Message content is required' });
      }

      const message = await prisma.message.create({
        data: {
          content,
          threadId,
          authorId: req.user!.id
        },
        include: {
          author: { select: { id: true, name: true, email: true } }
        }
      });

      // Update thread updatedAt
      await prisma.thread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() }
      });

      const io = req.app.get('io');
      if (io) io.to(`workspace:${workspaceId}`).emit('message.created', message);

      return res.status(201).json(message);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
