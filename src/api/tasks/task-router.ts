import { Router, Response } from 'express';
import { prisma } from '../../db/client';
import { authMiddleware, requireWorkspaceRole, AuthenticatedRequest } from '../../middleware/auth-middleware';
import { AgentRunner } from '../../modules/brain/agent-runner';
import { BrainTools } from '../../modules/brain/brain-tools';
import { WorkspaceStorage } from '../../modules/storage/workspace-storage';
import { AuthorizationGuard } from '../../modules/auth/authorization-guard';

export function createTaskRouter(storageResolver?: (workspaceId: string) => WorkspaceStorage): Router {
  const router = Router({ mergeParams: true });
  const authGuard = new AuthorizationGuard();
  const brainTools = new BrainTools(authGuard);

  const getStorage = (workspaceId: string): WorkspaceStorage => {
    if (storageResolver) {
      return storageResolver(workspaceId);
    }
    return new WorkspaceStorage(workspaceId);
  };

  router.use(authMiddleware);

  // Create and run AI Agent task
  router.post('/', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { title, prompt } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const task = await prisma.agentTask.create({
        data: {
          title: title || (prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt),
          description: prompt,
          status: 'PENDING',
          workspaceId,
          createdById: req.user!.id
        }
      });

      const storage = getStorage(workspaceId);
      const runner = new AgentRunner(brainTools, storage);

      const result = await runner.runTask({
        taskId: task.id,
        workspaceId,
        userId: req.user!.id,
        userPrompt: prompt
      });

      return res.status(200).json({
        taskId: task.id,
        status: result.status,
        answer: result.answer,
        citations: result.citations,
        verifiedCitations: result.verifiedCitations
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Get task status and events
  router.get('/:taskId', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { taskId } = req.params;
      const task = await prisma.agentTask.findUnique({
        where: { id: taskId },
        include: {
          events: { orderBy: { createdAt: 'asc' } },
          executions: { orderBy: { createdAt: 'asc' } }
        }
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      return res.status(200).json(task);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Cancel task
  router.post('/:taskId/cancel', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { taskId } = req.params;
      const task = await prisma.agentTask.update({
        where: { id: taskId },
        data: { status: 'CANCELLED' }
      });
      return res.status(200).json(task);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
