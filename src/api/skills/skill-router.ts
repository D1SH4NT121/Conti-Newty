import { Router, Response } from 'express';
import { authMiddleware, requireWorkspaceRole, AuthenticatedRequest } from '../../middleware/auth-middleware';
import {
  listSkills,
  getSkill,
  createCandidate,
  updateCandidate,
  confirmSkill,
  rejectSkill,
  supersedeSkill,
  SkillStatus
} from '../../modules/skills/skill-service';

export function createSkillRouter(): Router {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

  // List skills
  router.get('/', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const status = req.query.status as SkillStatus | undefined;
      const skills = await listSkills(workspaceId, status);
      return res.json(skills);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Get skill by id
  router.get('/:skillId', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { skillId } = req.params;
      const skill = await getSkill(workspaceId, skillId);
      return res.json(skill);
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  });

  // Create candidate skill
  router.post('/', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const candidate = req.body;
      const skill = await createCandidate(workspaceId, candidate, req.user!.id);
      return res.status(201).json(skill);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Update candidate skill
  router.put('/:skillId', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { skillId } = req.params;
      const updated = await updateCandidate(workspaceId, skillId, req.body, req.user!.id);
      return res.json(updated);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Confirm skill
  router.post('/:skillId/confirm', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { skillId } = req.params;
      const confirmed = await confirmSkill(workspaceId, skillId, req.user!.id);
      return res.json(confirmed);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Reject skill
  router.post('/:skillId/reject', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { skillId } = req.params;
      const rejected = await rejectSkill(workspaceId, skillId, req.user!.id);
      return res.json(rejected);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // Supersede skill
  router.post('/:skillId/supersede', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { skillId } = req.params;
      const newVersion = await supersedeSkill(workspaceId, skillId, req.body, req.user!.id);
      return res.json(newVersion);
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
}
