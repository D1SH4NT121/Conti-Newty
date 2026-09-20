import { Router, Response } from 'express';
import { prisma } from '../../db/client';
import { authMiddleware, requireWorkspaceRole, AuthenticatedRequest } from '../../middleware/auth-middleware';
import { WorkspaceStorage } from '../../modules/storage/workspace-storage';
import {
  createSession,
  getSession,
  joinSession,
  requestDriver,
  approveDriverRequest,
  handoffDriver,
  assertCanRedirect,
  getSessionEvents
} from '../../modules/sessions/session-service';
import { SessionRunner } from '../../modules/sessions/session-runner';
import { distillRedirect, createCandidate, retrieveConfirmedSkills } from '../../modules/skills/skill-service';

export function createSessionRouter(storageResolver?: (workspaceId: string) => WorkspaceStorage): Router {
  const router = Router({ mergeParams: true });

  const getStorage = (workspaceId: string): WorkspaceStorage => {
    if (storageResolver) {
      return storageResolver(workspaceId);
    }
    return new WorkspaceStorage(workspaceId);
  };

  router.use(authMiddleware);

  // List sessions in workspace
  router.get('/', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const sessions = await prisma.liveSession.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        include: {
          participants: true,
          _count: { select: { events: true } }
        }
      });
      return res.json(sessions);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Create new session
  router.post('/', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { title, goal, agents } = req.body;

      if (!title || !goal) {
        return res.status(400).json({ error: 'Title and goal are required' });
      }

      const session = await createSession({
        workspaceId,
        userId: req.user!.id,
        title,
        goal,
        agents
      });

      return res.status(202).json({
        sessionId: session.id,
        status: session.status,
        currentDriverId: session.currentDriverId
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Get session details
  router.get('/:sessionId', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { sessionId } = req.params;

      const session = await getSession(workspaceId, sessionId, req.user!.id);
      const appliedSkills = await retrieveConfirmedSkills(workspaceId, session.goal);

      return res.json({
        session,
        participants: session.participants,
        appliedSkills,
        events: session.events
      });
    } catch (err: any) {
      if (err.message.includes('not found')) {
        return res.status(404).json({ error: err.message });
      }
      return res.status(403).json({ error: err.message });
    }
  });

  // Join session
  router.post('/:sessionId/join', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { sessionId } = req.params;

      const participant = await joinSession(workspaceId, sessionId, req.user!.id);
      return res.json(participant);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Start session execution
  router.post('/:sessionId/start', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { sessionId } = req.params;

      const session = await getSession(workspaceId, sessionId, req.user!.id);
      if (session.currentDriverId !== req.user!.id) {
        return res.status(403).json({ error: 'Only the current Driver may start session execution' });
      }

      const storage = getStorage(workspaceId);
      const io = req.app.get('io');

      await SessionRunner.start(sessionId, workspaceId, req.user!.id, storage, io);

      return res.status(202).json({ sessionId, status: 'RUNNING' });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Redirect agent execution
  router.post('/:sessionId/redirect', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { sessionId } = req.params;
      const { instruction, evidence, force } = req.body;

      if (!instruction) {
        return res.status(400).json({ error: 'Instruction is required for redirect' });
      }

      const session = await getSession(workspaceId, sessionId, req.user!.id);
      assertCanRedirect(session, req.user!.id, Boolean(force));

      const { redirectId } = await SessionRunner.submitRedirect(sessionId, {
        userId: req.user!.id,
        instruction,
        evidence,
        force: Boolean(force)
      });

      return res.json({ success: true, redirectId });
    } catch (err: any) {
      return res.status(403).json({ error: err.message });
    }
  });

  // Request driver role
  router.post('/:sessionId/request-driver', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { sessionId } = req.params;

      await requestDriver(workspaceId, sessionId, req.user!.id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Approve driver request
  router.post('/:sessionId/approve-driver', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { sessionId } = req.params;
      const { driverId, requesterId } = req.body;
      const targetDriverId = driverId || requesterId;

      if (!targetDriverId) {
        return res.status(400).json({ error: 'driverId or requesterId is required' });
      }

      await approveDriverRequest(workspaceId, sessionId, targetDriverId, req.user!.id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Direct handoff
  router.post('/:sessionId/handoff', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { sessionId } = req.params;
      const { nextDriverId } = req.body;

      if (!nextDriverId) {
        return res.status(400).json({ error: 'nextDriverId is required' });
      }

      await handoffDriver(workspaceId, sessionId, req.user!.id, nextDriverId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Pause session
  router.post('/:sessionId/pause', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      await SessionRunner.pause(sessionId, req.user!.id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Cancel session
  router.post('/:sessionId/cancel', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { sessionId } = req.params;
      await SessionRunner.cancel(sessionId, req.user!.id);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Distill redirect into candidate skill
  router.post('/:sessionId/skills/distill', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { sessionId } = req.params;
      const { redirectId, reviewerContext } = req.body;

      let targetRedirectId = redirectId;
      if (!targetRedirectId) {
        const latestRedirect = await prisma.agentRedirect.findFirst({
          where: { sessionId },
          orderBy: { createdAt: 'desc' }
        });
        if (!latestRedirect) {
          return res.status(400).json({ error: 'No redirects found for this session to distill' });
        }
        targetRedirectId = latestRedirect.id;
      }

      const candidate = await distillRedirect(targetRedirectId, reviewerContext);
      const skill = await createCandidate(workspaceId, { ...candidate, sourceSessionId: sessionId }, req.user!.id);

      return res.status(201).json(skill);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Replay events
  router.get('/:sessionId/replay', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { sessionId } = req.params;

      const events = await getSessionEvents(workspaceId, sessionId, req.user!.id);
      return res.json({ sessionId, events });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  });

  return router;
}
