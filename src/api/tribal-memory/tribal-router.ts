/**
 * Tribal Memory Router
 *
 * Routes:
 *   POST   /tribal/entries              — create entry
 *   GET    /tribal/entries              — list entries (active only by default)
 *   GET    /tribal/entries/search       — search entries (active only by default)
 *   GET    /tribal/entries/:id/history  — get version history/lineage
 *   GET    /tribal/entries/:id          — get single entry
 *   PUT    /tribal/entries/:id          — update entry
 *   DELETE /tribal/entries/:id          — delete entry
 *   POST   /tribal/export               — export to Brain
 */

import { Router, Response } from 'express';
import { prisma } from '../../db/client';
import { authMiddleware, requireWorkspaceRole, AuthenticatedRequest } from '../../middleware/auth-middleware';
import { WorkspaceStorage } from '../../modules/storage/workspace-storage';
import {
  createEntry,
  listEntries,
  searchEntries,
  getEntry,
  getEntryHistory,
  updateEntry,
  deleteEntry,
  exportToBrain,
} from '../../modules/tribal-memory/tribal-memory';

export function createTribalRouter(storageResolver?: (workspaceId: string) => WorkspaceStorage): Router {
  const router = Router({ mergeParams: true });

  const getStorage = (workspaceId: string): WorkspaceStorage => {
    if (storageResolver) return storageResolver(workspaceId);
    return new WorkspaceStorage(workspaceId);
  };

  router.use(authMiddleware);

  // ── Create entry ──────────────────────────────────────────────────────────

  /**
   * POST /tribal/entries
   * Create a new tribal memory entry.
   * Body: { title: string, content: string, tags?: string[] }
   */
  router.post('/entries', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { title, content, tags } = req.body;

      if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
      if (!content?.trim()) return res.status(400).json({ error: 'content is required' });

      const entry = await createEntry({
        workspaceId,
        userId: req.user!.id,
        title: title.trim(),
        content: content.trim(),
        tags: tags || [],
      });

      return res.status(201).json(entry);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── List entries ──────────────────────────────────────────────────────────

  /**
   * GET /tribal/entries
   * List all entries for workspace.
   * Query params: limit (default 20), offset (default 0), orderBy (created|updated), includeSuperseded (boolean), status
   */
  router.get('/entries', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const orderBy = (req.query.orderBy as string) || 'created';
      const includeSuperseded = req.query.includeSuperseded === 'true';
      const status = req.query.status as string | undefined;

      const result = await listEntries({
        workspaceId,
        limit,
        offset,
        orderBy: orderBy === 'updated' ? 'updated' : 'created',
        includeSuperseded,
        status,
      });

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── Search entries ────────────────────────────────────────────────────────

  /**
   * GET /tribal/entries/search
   * Search entries by query and/or tags.
   * Query params: q (required), tags (comma-separated), limit, offset, includeSuperseded
   */
  router.get('/entries/search', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const query = (req.query.q as string) || '';
      const tagsParam = (req.query.tags as string) || '';
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const includeSuperseded = req.query.includeSuperseded === 'true';

      if (!query.trim()) {
        return res.status(400).json({ error: 'q (query) parameter is required' });
      }

      const tags = tagsParam ? tagsParam.split(',').map((t) => t.trim()) : undefined;

      const result = await searchEntries({
        workspaceId,
        query: query.trim(),
        tags,
        limit,
        offset,
        includeSuperseded,
      });

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── Get entry history (version lineage) ───────────────────────────────────

  /**
   * GET /tribal/entries/:entryId/history
   * Get version history for entry (ancestors and descendants).
   */
  router.get('/entries/:entryId/history', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { entryId } = req.params;
      const history = await getEntryHistory(entryId);
      return res.json(history);
    } catch (e: any) {
      return res.status(404).json({ error: e.message });
    }
  });

  // ── Get single entry ──────────────────────────────────────────────────────

  /**
   * GET /tribal/entries/:entryId
   * Get a single entry.
   */
  router.get('/entries/:entryId', requireWorkspaceRole('viewer'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { entryId } = req.params;

      const entry = await getEntry(entryId);

      if (!entry) {
        return res.status(404).json({ error: 'Entry not found' });
      }

      // Verify entry belongs to workspace
      const dbEntry = await prisma.tribalMemoryEntry.findUnique({
        where: { id: entryId },
      });

      if (!dbEntry || dbEntry.workspaceId !== (req.params.id || req.params.workspaceId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      return res.json(entry);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── Update entry ──────────────────────────────────────────────────────────

  /**
   * PUT /tribal/entries/:entryId
   * Update an entry.
   * Body: { title?: string, content?: string, tags?: string[] }
   */
  router.put('/entries/:entryId', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { entryId } = req.params;
      const { title, content, tags } = req.body;

      // Verify entry belongs to workspace
      const dbEntry = await prisma.tribalMemoryEntry.findUnique({
        where: { id: entryId },
      });

      if (!dbEntry || dbEntry.workspaceId !== (req.params.id || req.params.workspaceId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Verify user is author or workspace owner
      if (dbEntry.authorId !== req.user!.id) {
        const membership = await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId: req.user!.id,
              workspaceId: dbEntry.workspaceId,
            },
          },
        });
        if (!membership || membership.role !== 'OWNER') {
          return res.status(403).json({ error: 'Only author or workspace owner can edit' });
        }
      }

      const updated = await updateEntry({
        entryId,
        title,
        content,
        tags,
      });

      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── Delete entry ──────────────────────────────────────────────────────────

  /**
   * DELETE /tribal/entries/:entryId
   * Delete an entry.
   */
  router.delete('/entries/:entryId', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { entryId } = req.params;

      // Verify entry belongs to workspace
      const dbEntry = await prisma.tribalMemoryEntry.findUnique({
        where: { id: entryId },
      });

      if (!dbEntry || dbEntry.workspaceId !== (req.params.id || req.params.workspaceId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Verify user is author or workspace owner
      if (dbEntry.authorId !== req.user!.id) {
        const membership = await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId: req.user!.id,
              workspaceId: dbEntry.workspaceId,
            },
          },
        });
        if (!membership || membership.role !== 'OWNER') {
          return res.status(403).json({ error: 'Only author or workspace owner can delete' });
        }
      }

      await deleteEntry(entryId);

      return res.json({ success: true });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // ── Export to Brain ───────────────────────────────────────────────────────

  /**
   * POST /tribal/export
   * Export all tribal memory entries to Brain.
   * Body: { targetPath?: string }
   */
  router.post('/export', requireWorkspaceRole('member'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workspaceId = req.params.id || req.params.workspaceId;
      const { targetPath } = req.body;

      const storage = getStorage(workspaceId);

      const result = await exportToBrain({
        workspaceId,
        storage,
        targetPath,
      });

      return res.json(result);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  return router;
}
