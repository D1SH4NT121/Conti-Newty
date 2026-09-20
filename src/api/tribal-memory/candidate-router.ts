/**
 * Knowledge Candidate Router — Review Queue and Ingestion Distillation API
 *
 * Routes:
 *   GET  /api/workspaces/:id/knowledge-candidates                — list candidates
 *   GET  /api/workspaces/:id/knowledge-candidates/:candidateId   — get single candidate
 *   POST /api/workspaces/:id/knowledge-candidates/distill        — trigger manual distillation pass
 *   POST /api/workspaces/:id/knowledge-candidates/:candidateId/confirm — confirm & promote to Tribal Memory
 *   POST /api/workspaces/:id/knowledge-candidates/:candidateId/reject  — reject candidate
 */

import { Router, Response } from 'express';
import { authMiddleware, requireWorkspaceRole, AuthenticatedRequest } from '../../middleware/auth-middleware';
import {
  listCandidates,
  getCandidate,
  confirmCandidate,
  rejectCandidate,
} from '../../modules/tribal-memory/knowledge-candidate-service';
import { distillIngestedItems } from '../../modules/tribal-memory/knowledge-distiller';

export function createCandidateRouter(): Router {
  const router = Router({ mergeParams: true });

  router.use(authMiddleware);

  /**
   * GET /
   * List candidates for workspace.
   */
  router.get('/', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const status = (req.query.status as any) || 'TENTATIVE';
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await listCandidates({
        workspaceId,
        status,
        limit,
        offset,
      });

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /:candidateId
   * Get single candidate.
   */
  router.get('/:candidateId', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { candidateId } = req.params;
      const candidate = await getCandidate(candidateId);

      if (!candidate) {
        return res.status(404).json({ error: 'Candidate not found' });
      }

      const workspaceId = req.params.id || req.params.workspaceId;
      if (candidate.workspaceId !== workspaceId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      return res.json(candidate);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /distill
   * Trigger manual distillation pass on un-synthesized items.
   */
  router.post('/distill', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { sourceItemIds, limit } = req.body || {};

      const result = await distillIngestedItems({
        workspaceId,
        userId: req.user!.id,
        sourceItemIds,
        limit: limit ? parseInt(limit) : 20,
      });

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /:candidateId/confirm
   * Promote candidate to Tribal Memory.
   */
  router.post('/:candidateId/confirm', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { candidateId } = req.params;

      const result = await confirmCandidate(workspaceId, candidateId, req.user!.id);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  /**
   * POST /:candidateId/reject
   * Reject candidate.
   */
  router.post('/:candidateId/reject', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { candidateId } = req.params;
      const { reason } = req.body || {};

      const result = await rejectCandidate(workspaceId, candidateId, req.user!.id, reason);
      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  return router;
}
