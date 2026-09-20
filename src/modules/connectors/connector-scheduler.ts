/**
 * Connector Scheduler — Phase 2: Continuous Live Ingestion
 *
 * Architecture:
 *   - Single global interval loop (setInterval) started once at server boot.
 *   - Each tick queries all workspaces that have ConnectorOptIn.enabled = true.
 *   - Per-workspace cadence is respected via ConnectorOptIn.intervalMin.
 *   - Delta sync: content is hashed (SHA-256); IngestedItem row is skipped if
 *     contentHash unchanged, preventing duplicate Brain writes.
 *   - Every sync is audit-logged to AuditLog (action: CONNECTOR_AUTO_SYNC).
 *   - Every sync result (success or failure) is written to ConnectorSync.
 *   - Errors are isolated per-workspace; one failure never blocks others.
 *   - Scheduler can be stopped cleanly via stopScheduler() (used in tests).
 */

import crypto from 'crypto';
import { prisma } from '../../db/client';
import { WorkspaceStorage } from '../storage/workspace-storage';
import { syncWorkspaceConnections } from './drive-connector';
import { syncWorkspaceJiraConnections } from './jira-connector';
import { syncWorkspaceSlackConnections } from './slack-connector';
import path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SchedulerConfig {
  /** Polling interval in ms to check which workspaces need syncing. Default: 60 000 */
  pollIntervalMs?: number;
  /** Base directory for workspace storage (used in tests to inject temp dirs) */
  storageBaseDir?: string;
}

export interface WorkspaceSyncResult {
  workspaceId: string;
  drive: { updated: number; skipped: number; failed: number } | null;
  jira: { totalUpdated: number; connectionsSynced: number; connectionsFailed: number } | null;
  slack: { totalUpdated: number; connectionsSynced: number; connectionsFailed: number } | null;
  errors: string[];
  durationMs: number;
}

// ── Content hash ──────────────────────────────────────────────────────────────

/**
 * SHA-256 of content string. Used to detect unchanged files and skip redundant
 * Brain writes and IngestedItem updates.
 */
export function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// ── IngestedItem upsert ───────────────────────────────────────────────────────

/**
 * Upsert an IngestedItem row. Returns metadata about whether it was new or changed.
 * The Brain write itself is done by the connector sync functions (storage.writeFile).
 * This function records the metadata so future syncs can detect unchanged content.
 */
export async function upsertIngestedItem(params: {
  workspaceId: string;
  connector: string;
  externalId: string;
  brainPath: string;
  content: string;
}): Promise<{ isNew: boolean; hashChanged: boolean }> {
  const { workspaceId, connector, externalId, brainPath, content } = params;
  const contentHash = hashContent(content);
  const byteSize = Buffer.byteLength(content, 'utf8');

  const existing = await prisma.ingestedItem.findUnique({
    where: { workspaceId_connector_externalId: { workspaceId, connector, externalId } },
  });

  if (!existing) {
    await prisma.ingestedItem.create({
      data: { workspaceId, connector, externalId, brainPath, contentHash, byteSize },
    });
    return { isNew: true, hashChanged: true };
  }

  if (existing.contentHash === contentHash) {
    return { isNew: false, hashChanged: false };
  }

  await prisma.ingestedItem.update({
    where: { id: existing.id },
    data: { brainPath, contentHash, byteSize, updatedAt: new Date() },
  });

  return { isNew: false, hashChanged: true };
}

// ── Storage factory ────────────────────────────────────────────────────────────

function buildStorage(workspaceId: string, baseDir?: string): WorkspaceStorage {
  const root = baseDir
    ? path.join(baseDir, workspaceId)
    : path.join(process.cwd(), 'workspaces', workspaceId);
  return new WorkspaceStorage(workspaceId, root);
}

// ── Single workspace sync ─────────────────────────────────────────────────────

/**
 * Run a full sync cycle for one workspace across all three connector types.
 * Individual connector failures are caught and reported; the others continue.
 */
export async function syncWorkspace(
  workspaceId: string,
  storageBaseDir?: string
): Promise<WorkspaceSyncResult> {
  const start = Date.now();
  const errors: string[] = [];
  const storage = buildStorage(workspaceId, storageBaseDir);

  let driveResult: WorkspaceSyncResult['drive'] = null;
  let jiraResult: WorkspaceSyncResult['jira'] = null;
  let slackResult: WorkspaceSyncResult['slack'] = null;

  // ── Drive ──
  try {
    const r = await syncWorkspaceConnections(workspaceId, storage);
    driveResult = { updated: r.updated, skipped: r.skipped, failed: r.failed };
  } catch (err: any) {
    errors.push(`drive: ${err.message}`);
  }

  // ── Jira ──
  try {
    const r = await syncWorkspaceJiraConnections(workspaceId, storage);
    jiraResult = {
      totalUpdated: r.totalUpdated,
      connectionsSynced: r.connectionsSynced,
      connectionsFailed: r.connectionsFailed,
    };
  } catch (err: any) {
    errors.push(`jira: ${err.message}`);
  }

  // ── Slack ──
  try {
    const r = await syncWorkspaceSlackConnections(workspaceId, storage);
    slackResult = {
      totalUpdated: r.totalUpdated,
      connectionsSynced: r.connectionsSynced,
      connectionsFailed: r.connectionsFailed,
    };
  } catch (err: any) {
    errors.push(`slack: ${err.message}`);
  }

  const durationMs = Date.now() - start;
  const totalUpdated =
    (driveResult?.updated ?? 0) +
    (jiraResult?.totalUpdated ?? 0) +
    (slackResult?.totalUpdated ?? 0);
  const anyFailed = errors.length > 0;

  // ── Persist ConnectorSync record ──
  try {
    await prisma.connectorSync.create({
      data: {
        connector: 'auto',
        workspaceId,
        targetPath: 'auto',
        fileCount: totalUpdated,
        status: anyFailed && totalUpdated === 0 ? 'FAILED' : 'COMPLETED',
        detail: anyFailed
          ? errors.join('; ')
          : `drive=${driveResult?.updated ?? 0} jira=${jiraResult?.totalUpdated ?? 0} slack=${slackResult?.totalUpdated ?? 0}`,
      },
    });
  } catch {
    // Non-fatal: ConnectorSync write failure should not crash the workspace sync
  }

  // ── AuditLog ──
  try {
    await prisma.auditLog.create({
      data: {
        action: 'CONNECTOR_AUTO_SYNC',
        workspaceId,
        details: JSON.stringify({
          durationMs,
          drive: driveResult,
          jira: jiraResult,
          slack: slackResult,
          errors,
        }),
      },
    });
  } catch {
    // Non-fatal
  }

  return { workspaceId, drive: driveResult, jira: jiraResult, slack: slackResult, errors, durationMs };
}

// ── Scheduler loop ────────────────────────────────────────────────────────────

let _timer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the global background scheduler. Safe to call multiple times — only
 * one timer runs at a time. Should be called once at server startup.
 *
 * Each tick:
 *   1. Fetch all ConnectorOptIn rows where enabled = true.
 *   2. For each, check if (now - lastSync) >= intervalMin.
 *   3. If so, run syncWorkspace() for that workspace.
 */
export function startScheduler(config: SchedulerConfig = {}): void {
  if (_timer) return; // Already running

  const pollMs = config.pollIntervalMs ?? 60_000; // Default: check every minute

  _timer = setInterval(async () => {
    let optIns: Array<{ workspaceId: string; intervalMin: number }>;

    try {
      optIns = await prisma.connectorOptIn.findMany({
        where: { enabled: true },
        select: { workspaceId: true, intervalMin: true },
      });
    } catch {
      return; // DB not ready yet; skip this tick
    }

    const now = Date.now();

    for (const optIn of optIns) {
      try {
        const lastSync = await prisma.connectorSync.findFirst({
          where: { workspaceId: optIn.workspaceId, connector: 'auto' },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        const lastSyncMs = lastSync ? lastSync.createdAt.getTime() : 0;
        const intervalMs = optIn.intervalMin * 60 * 1000;

        if (now - lastSyncMs >= intervalMs) {
          syncWorkspace(optIn.workspaceId, config.storageBaseDir).catch(() => {
            // Already logged inside syncWorkspace
          });
        }
      } catch {
        // Per-workspace error; continue with others
      }
    }
  }, pollMs);

  _timer.unref();
}

/**
 * Stop the scheduler cleanly. Primarily used in tests and graceful shutdown.
 */
export function stopScheduler(): void {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
}

// ── Opt-in helpers ────────────────────────────────────────────────────────────

export interface ConnectorOptInStatus {
  enabled: boolean;
  intervalMin: number;
  enabledBy: string | null;
  updatedAt: Date;
}

/**
 * Get or create the ConnectorOptIn record for a workspace.
 * Default state is disabled (explicit consent required).
 */
export async function getOptInStatus(workspaceId: string): Promise<ConnectorOptInStatus> {
  const record = await prisma.connectorOptIn.findUnique({ where: { workspaceId } });
  if (!record) {
    return { enabled: false, intervalMin: 60, enabledBy: null, updatedAt: new Date(0) };
  }
  return {
    enabled: record.enabled,
    intervalMin: record.intervalMin,
    enabledBy: record.enabledBy,
    updatedAt: record.updatedAt,
  };
}

/**
 * Toggle automatic scanning on or off for a workspace.
 * Creates the ConnectorOptIn row if it does not exist.
 */
export async function setOptIn(
  workspaceId: string,
  enabled: boolean,
  userId: string,
  intervalMin?: number
): Promise<ConnectorOptInStatus> {
  const record = await prisma.connectorOptIn.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      enabled,
      enabledBy: userId,
      intervalMin: intervalMin ?? 60,
    },
    update: {
      enabled,
      enabledBy: userId,
      ...(intervalMin !== undefined ? { intervalMin } : {}),
    },
  });

  await prisma.auditLog.create({
    data: {
      action: enabled ? 'CONNECTOR_AUTO_SYNC_ENABLED' : 'CONNECTOR_AUTO_SYNC_DISABLED',
      workspaceId,
      userId,
      details: JSON.stringify({ intervalMin: record.intervalMin }),
    },
  });

  return {
    enabled: record.enabled,
    intervalMin: record.intervalMin,
    enabledBy: record.enabledBy,
    updatedAt: record.updatedAt,
  };
}

/**
 * Return recent auto-sync history for a workspace (last N ConnectorSync entries
 * where connector = 'auto').
 */
export async function getSyncHistory(
  workspaceId: string,
  limit = 20
): Promise<
  Array<{ id: string; status: string; fileCount: number; detail: string | null; createdAt: Date }>
> {
  return prisma.connectorSync.findMany({
    where: { workspaceId, connector: 'auto' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, status: true, fileCount: true, detail: true, createdAt: true },
  });
}
