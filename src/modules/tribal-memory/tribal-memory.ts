/**
 * Tribal Memory — Internal knowledge capture system with Phase 4 Staleness & Supersede Tracking
 *
 * Captures organizational knowledge without external API sync:
 *   - Decisions, best practices, lessons learned
 *   - Full-text searchable
 *   - Version lineage: ACTIVE | SUPERSEDED | ARCHIVED
 *   - Exportable to Brain path for agent access
 *
 * Flow:
 *   1. createEntry() — user captures knowledge
 *   2. supersedeEntry() — create new version, marking previous as SUPERSEDED
 *   3. listEntries() — browse entries (defaults to ACTIVE only)
 *   4. searchEntries() — find by title/content/tags (defaults to ACTIVE only)
 *   5. getEntry() — read single entry
 *   6. getEntryHistory() — trace full lineage tree (ancestors & descendants)
 *   7. updateEntry() — edit entry
 *   8. archiveEntry() — soft archive entry
 *   9. deleteEntry() — remove entry
 *   10. exportToBrain() — write entries to Brain markdown file
 */

import { prisma } from '../../db/client';
import { WorkspaceStorage } from '../storage/workspace-storage';

// ── Entry creation ───────────────────────────────────────────────────────────

export interface CreateEntryParams {
  workspaceId: string;
  userId: string;
  title: string;
  content: string;
  tags?: string[];
  status?: 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';
  supersedesId?: string | null;
  source?: 'manual' | 'auto_distilled';
  sourceCandidateId?: string | null;
}

export interface TribalMemoryEntryPublic {
  id: string;
  title: string;
  content: string;
  tags: string[];
  authorId: string;
  authorName?: string;
  status: 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';
  supersedesId?: string | null;
  source: 'manual' | 'auto_distilled';
  sourceCandidateId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create a new tribal memory entry.
 * Generates searchText by combining title, content, and tags for efficient search.
 */
export async function createEntry(params: CreateEntryParams): Promise<TribalMemoryEntryPublic> {
  const {
    workspaceId,
    userId,
    title,
    content,
    tags = [],
    status = 'ACTIVE',
    supersedesId = null,
    source = 'manual',
    sourceCandidateId = null,
  } = params;

  // Denormalize search text: title + content + tags
  const searchText = [title, content, tags.join(' ')].join(' ').toLowerCase();

  const entry = await prisma.tribalMemoryEntry.create({
    data: {
      workspaceId,
      authorId: userId,
      title,
      content,
      tags: JSON.stringify(tags),
      searchText,
      status,
      supersedesId,
      source,
      sourceCandidateId,
    },
    include: { author: { select: { name: true } } },
  });

  return formatEntry(entry, (entry as any).author?.name ?? undefined);
}

/**
 * Supersede an existing entry with a new version.
 * Marks the old entry as SUPERSEDED and creates the new one with supersedesId linked.
 */
export async function supersedeEntry(
  oldEntryId: string,
  params: Omit<CreateEntryParams, 'supersedesId'>
): Promise<{ newEntry: TribalMemoryEntryPublic; supersededEntry: TribalMemoryEntryPublic }> {
  const oldEntry = await prisma.tribalMemoryEntry.findUnique({
    where: { id: oldEntryId },
    include: { author: { select: { name: true } } },
  });

  if (!oldEntry) {
    throw new Error(`TribalMemoryEntry not found: ${oldEntryId}`);
  }

  // Mark old entry as SUPERSEDED
  const updatedOld = await prisma.tribalMemoryEntry.update({
    where: { id: oldEntryId },
    data: { status: 'SUPERSEDED' },
    include: { author: { select: { name: true } } },
  });

  // Create new active entry pointing to old entry
  const newEntry = await createEntry({
    ...params,
    status: 'ACTIVE',
    supersedesId: oldEntryId,
  });

  return {
    newEntry,
    supersededEntry: formatEntry(updatedOld, updatedOld.author?.name ?? undefined),
  };
}

// ── Entry retrieval ──────────────────────────────────────────────────────────

export interface ListEntriesParams {
  workspaceId: string;
  limit?: number;
  offset?: number;
  orderBy?: 'created' | 'updated'; // Default: created DESC
  status?: string; // Explicit status filter
  includeSuperseded?: boolean; // If true, includes ACTIVE and SUPERSEDED (excludes ARCHIVED)
  includeHistory?: boolean; // If true, includes all statuses
}

/**
 * List entries for a workspace.
 * Defaults to returning only ACTIVE entries unless includeSuperseded or includeHistory is true.
 */
export async function listEntries(params: ListEntriesParams): Promise<{
  entries: TribalMemoryEntryPublic[];
  total: number;
}> {
  const {
    workspaceId,
    limit = 20,
    offset = 0,
    orderBy = 'created',
    status,
    includeSuperseded = false,
    includeHistory = false,
  } = params;

  const orderByField = orderBy === 'updated' ? 'updatedAt' : 'createdAt';

  const where: any = { workspaceId };

  if (status) {
    if (status !== 'ALL') {
      where.status = status;
    }
  } else if (!includeHistory) {
    if (includeSuperseded) {
      where.status = { in: ['ACTIVE', 'SUPERSEDED'] };
    } else {
      where.status = 'ACTIVE';
    }
  }

  const [entries, total] = await Promise.all([
    prisma.tribalMemoryEntry.findMany({
      where,
      orderBy: { [orderByField]: 'desc' },
      take: limit,
      skip: offset,
      include: { author: { select: { name: true } } },
    }),
    prisma.tribalMemoryEntry.count({ where }),
  ]);

  return {
    entries: entries.map((e) => formatEntry(e, e.author.name ?? undefined)),
    total,
  };
}

/**
 * Get a single entry by ID.
 */
export async function getEntry(entryId: string): Promise<TribalMemoryEntryPublic | null> {
  const entry = await prisma.tribalMemoryEntry.findUnique({
    where: { id: entryId },
    include: { author: { select: { name: true } } },
  });

  return entry ? formatEntry(entry, entry.author.name ?? undefined) : null;
}

/**
 * Trace the full version lineage (ancestors and descendants) for an entry.
 */
export async function getEntryHistory(entryId: string): Promise<{
  current: TribalMemoryEntryPublic;
  ancestors: TribalMemoryEntryPublic[];
  descendants: TribalMemoryEntryPublic[];
}> {
  const current = await getEntry(entryId);
  if (!current) {
    throw new Error(`TribalMemoryEntry not found: ${entryId}`);
  }

  const ancestors: TribalMemoryEntryPublic[] = [];
  let currentAncestorId = current.supersedesId;

  while (currentAncestorId) {
    const parent = await getEntry(currentAncestorId);
    if (!parent) break;
    ancestors.push(parent);
    currentAncestorId = parent.supersedesId;
  }

  // Find direct and indirect descendants
  const descendants: TribalMemoryEntryPublic[] = [];
  const queue = [entryId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = await prisma.tribalMemoryEntry.findMany({
      where: { supersedesId: parentId },
      include: { author: { select: { name: true } } },
    });

    for (const child of children) {
      const formatted = formatEntry(child, child.author.name ?? undefined);
      descendants.push(formatted);
      queue.push(child.id);
    }
  }

  return {
    current,
    ancestors,
    descendants,
  };
}

// ── Search ───────────────────────────────────────────────────────────────────

export interface SearchEntriesParams {
  workspaceId: string;
  query: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  status?: string;
  includeSuperseded?: boolean;
  includeHistory?: boolean;
}

/**
 * Search entries by full-text query and/or tags.
 * Defaults to searching ACTIVE entries only.
 */
export async function searchEntries(params: SearchEntriesParams): Promise<{
  entries: TribalMemoryEntryPublic[];
  total: number;
}> {
  const {
    workspaceId,
    query,
    tags,
    limit = 20,
    offset = 0,
    status,
    includeSuperseded = false,
    includeHistory = false,
  } = params;

  const conditions: any[] = [{ workspaceId }];

  // Status filtering (default: ACTIVE)
  if (status) {
    if (status !== 'ALL') {
      conditions.push({ status });
    }
  } else if (!includeHistory) {
    if (includeSuperseded) {
      conditions.push({ status: { in: ['ACTIVE', 'SUPERSEDED'] } });
    } else {
      conditions.push({ status: 'ACTIVE' });
    }
  }

  // Full-text search on denormalized searchText (ignoring '*' wildcard)
  const cleanQuery = query?.trim();
  if (cleanQuery && cleanQuery !== '*') {
    conditions.push({
      OR: [
        { title: { contains: cleanQuery } },
        { content: { contains: cleanQuery } },
        { searchText: { contains: cleanQuery.toLowerCase() } },
      ],
    });
  }

  // Tag filtering
  if (tags?.length) {
    for (const tag of tags) {
      const cleanTag = tag.trim();
      if (cleanTag) {
        conditions.push({
          tags: {
            contains: cleanTag,
          },
        });
      }
    }
  }

  const where = conditions.length > 1 ? { AND: conditions } : conditions[0];

  const [entries, total] = await Promise.all([
    prisma.tribalMemoryEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { author: { select: { name: true } } },
    }),
    prisma.tribalMemoryEntry.count({ where }),
  ]);

  return {
    entries: entries.map((e) => formatEntry(e, e.author.name ?? undefined)),
    total,
  };
}

// ── Entry updates ────────────────────────────────────────────────────────────

export interface UpdateEntryParams {
  entryId: string;
  title?: string;
  content?: string;
  tags?: string[];
  status?: 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';
}

/**
 * Update an entry.
 * Regenerates searchText if title, content, or tags change.
 */
export async function updateEntry(params: UpdateEntryParams): Promise<TribalMemoryEntryPublic> {
  const { entryId, title, content, tags, status } = params;

  const existing = await prisma.tribalMemoryEntry.findUnique({
    where: { id: entryId },
  });

  if (!existing) {
    throw new Error(`TribalMemoryEntry not found: ${entryId}`);
  }

  const newTitle = title ?? existing.title;
  const newContent = content ?? existing.content;
  const newTags = tags ?? JSON.parse(existing.tags);
  const newStatus = status ?? existing.status;

  // Regenerate search text
  const searchText = [newTitle, newContent, newTags.join(' ')].join(' ').toLowerCase();

  const updated = await prisma.tribalMemoryEntry.update({
    where: { id: entryId },
    data: {
      title: newTitle,
      content: newContent,
      tags: JSON.stringify(newTags),
      searchText,
      status: newStatus,
    },
    include: { author: { select: { name: true } } },
  });

  return formatEntry(updated, updated.author.name ?? undefined);
}

/**
 * Soft archive an entry.
 */
export async function archiveEntry(entryId: string): Promise<TribalMemoryEntryPublic> {
  const updated = await prisma.tribalMemoryEntry.update({
    where: { id: entryId },
    data: { status: 'ARCHIVED' },
    include: { author: { select: { name: true } } },
  });

  return formatEntry(updated, updated.author.name ?? undefined);
}

// ── Entry deletion ───────────────────────────────────────────────────────────

/**
 * Delete an entry.
 */
export async function deleteEntry(entryId: string): Promise<void> {
  await prisma.tribalMemoryEntry.delete({
    where: { id: entryId },
  });
}

// ── Brain export ─────────────────────────────────────────────────────────────

export interface ExportToBrainParams {
  workspaceId: string;
  storage: WorkspaceStorage;
  targetPath?: string;
  includeSuperseded?: boolean;
}

export interface ExportToBrainResult {
  success: boolean;
  fileCount: number;
  entriesExported: number;
  targetPath: string;
}

/**
 * Export all active tribal memory entries to Brain as indexed markdown files.
 */
export async function exportToBrain(params: ExportToBrainParams): Promise<ExportToBrainResult> {
  const { workspaceId, storage, targetPath = 'connectors/tribal-memory', includeSuperseded = false } = params;

  const where: any = { workspaceId };
  if (!includeSuperseded) {
    where.status = 'ACTIVE';
  } else {
    where.status = { in: ['ACTIVE', 'SUPERSEDED'] };
  }

  // Fetch active entries
  const entries = await prisma.tribalMemoryEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { name: true } } },
  });

  if (entries.length === 0) {
    return {
      success: true,
      fileCount: 0,
      entriesExported: 0,
      targetPath,
    };
  }

  // Generate individual entry files
  const indexEntries: { [key: string]: Array<{ title: string; date: string; path: string; status: string }> } = {};

  for (const entry of entries) {
    const entryDate = new Date(entry.createdAt).toISOString().split('T')[0]; // YYYY-MM-DD
    const entrySlug = entry.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);
    const entryFileName = `${entryDate}_${entrySlug}.md`;
    const entryPath = `${targetPath}/${entryFileName}`;

    const tags = JSON.parse(entry.tags);
    const tagsText = tags.length ? `\n**Tags:** ${tags.join(', ')}\n` : '';

    const entryMarkdown = [
      `# ${entry.title}`,
      '',
      `**Status:** ${entry.status}`,
      `**Source:** ${entry.source}`,
      `**Author:** ${entry.author.name}`,
      `**Created:** ${new Date(entry.createdAt).toLocaleString()}`,
      `**Updated:** ${new Date(entry.updatedAt).toLocaleString()}`,
      entry.supersedesId ? `**Supersedes Entry ID:** ${entry.supersedesId}` : '',
      tagsText,
      '---',
      '',
      entry.content,
    ].filter(Boolean).join('\n');

    await storage.writeFile(entryPath, entryMarkdown);

    // Categorize by first tag (or "Uncategorized")
    const category = tags.length > 0 ? tags[0] : 'Uncategorized';
    if (!indexEntries[category]) {
      indexEntries[category] = [];
    }
    indexEntries[category].push({
      title: entry.title,
      date: entryDate,
      path: entryFileName,
      status: entry.status,
    });
  }

  // Generate index file
  const indexLines = [
    '# Tribal Memory Index',
    '',
    `Last updated: ${new Date().toISOString().split('T')[0]}`,
    `Total active entries: ${entries.length}`,
    '',
  ];

  for (const [category, categoryEntries] of Object.entries(indexEntries)) {
    indexLines.push(`## ${category} (${categoryEntries.length} ${categoryEntries.length === 1 ? 'entry' : 'entries'})`);
    indexLines.push('');
    for (const entry of categoryEntries) {
      const statusBadge = entry.status === 'SUPERSEDED' ? ' [SUPERSEDED]' : '';
      indexLines.push(`- [${entry.title}](./${entry.path}) — ${entry.date}${statusBadge}`);
    }
    indexLines.push('');
  }

  const indexPath = `${targetPath}/index.md`;
  await storage.writeFile(indexPath, indexLines.join('\n'));

  return {
    success: true,
    fileCount: entries.length + 1, // Individual files + index
    entriesExported: entries.length,
    targetPath,
  };
}

// ── Helper ───────────────────────────────────────────────────────────────────

/**
 * Format entry for API response.
 */
function formatEntry(
  entry: any,
  authorName?: string
): TribalMemoryEntryPublic {
  return {
    id: entry.id,
    title: entry.title,
    content: entry.content,
    tags: typeof entry.tags === 'string' ? JSON.parse(entry.tags) : entry.tags,
    authorId: entry.authorId,
    authorName: authorName || 'Unknown',
    status: entry.status as 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED',
    supersedesId: entry.supersedesId ?? null,
    source: (entry.source as 'manual' | 'auto_distilled') || 'manual',
    sourceCandidateId: entry.sourceCandidateId ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}
