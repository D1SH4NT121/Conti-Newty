import { Router, Response } from 'express';
import { authMiddleware, requireWorkspaceRole, AuthenticatedRequest } from '../../middleware/auth-middleware';
import { ChangeService } from '../../modules/changes/change-service';
import { WorkspaceStorage } from '../../modules/storage/workspace-storage';

export function createChangeRouter(
  storageResolver?: (workspaceId: string) => WorkspaceStorage,
  serviceResolver?: (workspaceId: string) => ChangeService
): Router {
  const router = Router({ mergeParams: true });
  const serviceMap = new Map<string, ChangeService>();

  const getService = (workspaceId: string): ChangeService => {
    if (serviceResolver) {
      return serviceResolver(workspaceId);
    }
    if (!serviceMap.has(workspaceId)) {
      const storage = storageResolver ? storageResolver(workspaceId) : new WorkspaceStorage(workspaceId);
      serviceMap.set(workspaceId, new ChangeService(storage));
    }
    return serviceMap.get(workspaceId)!;
  };

  router.use(authMiddleware);

  // List proposed changes
  router.get('/', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const service = getService(workspaceId);
      const changes = await service.listProposedChanges(workspaceId);
      return res.status(200).json(changes);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Get specific proposed change
  router.get('/:changeId', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { changeId } = req.params;
      const service = getService(workspaceId);
      const change = await service.getProposedChange(workspaceId, changeId);
      if (!change) {
        return res.status(404).json({ error: 'Proposed change not found' });
      }
      return res.status(200).json(change);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Create proposed change
  router.post('/', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { filePath, proposedContent, description } = req.body;

      if (!filePath || proposedContent === undefined) {
        return res.status(400).json({ error: 'filePath and proposedContent are required' });
      }

      const service = getService(workspaceId);
      const change = await service.createProposedChange({
        workspaceId,
        filePath,
        proposedBy: req.user!.id,
        proposedContent,
        description
      });

      return res.status(201).json(change);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Approve proposed change
  router.post('/:changeId/approve', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { changeId } = req.params;
      const service = getService(workspaceId);

      const result = await service.approveChange({
        workspaceId,
        changeId,
        reviewedBy: req.user!.id
      });

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Reject proposed change
  router.post('/:changeId/reject', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { changeId } = req.params;
      const { reason } = req.body;
      const service = getService(workspaceId);

      const result = await service.rejectChange({
        workspaceId,
        changeId,
        reviewedBy: req.user!.id,
        reason
      });

      return res.status(200).json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
