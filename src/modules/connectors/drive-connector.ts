/**
 * Google Drive Connector — minimum real version
 *
 * Scope: drive.file (user-initiated Picker selection only, no blanket Drive access)
 *
 * Flow:
 *   1. driveAuthUrl()          → redirect user to Google consent screen
 *   2. exchangeCode()          → trade auth code for access + refresh tokens
 *   3. connectFiles()          → for each Picker-selected file, fetch content,
 *                                write to Brain, persist SourceConnection row
 *   4. syncWorkspaceConnections() → re-fetch each file, skip if modifiedTime unchanged,
 *                                write updated content + bump lastSyncedAt if changed
 *
 * Token refresh is handled transparently inside fetchWithRefresh().
 * On permanent refresh failure the connection is marked status='reconnect_required'.
 */

import { prisma } from '../../db/client';
import { CredentialVault } from '../auth/credential-vault';
import { WorkspaceStorage } from '../storage/workspace-storage';
import { config } from '../../config';

// ── OAuth constants ──────────────────────────────────────────────────────────

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

function driveCallbackUrl(): string {
  return `${config.frontendUrl}/w/drive/callback`;
}

export interface DriveAuthUrlOptions {
  /** Opaque state blob to round-trip (workspaceId + userId encoded) */
  state: string;
}

/** Returns the Google OAuth2 consent URL requesting only the drive.file scope. */
export function driveAuthUrl(options: DriveAuthUrlOptions): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.googleClientId);
  url.searchParams.set('redirect_uri', driveCallbackUrl());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', DRIVE_SCOPE);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');   // force refresh_token issuance
  url.searchParams.set('state', options.state);
  return url.toString();
}

// ── Token exchange ───────────────────────────────────────────────────────────

export interface DriveTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export async function exchangeCode(code: string): Promise<DriveTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: driveCallbackUrl(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive token exchange failed: ${body}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

// ── Refresh ──────────────────────────────────────────────────────────────────

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive token refresh failed: ${body}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ── Drive API helpers ────────────────────────────────────────────────────────

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

async function getFileMeta(fileId: string, accessToken: string): Promise<DriveFileMeta> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive metadata fetch failed (${res.status}): ${body}`);
  }
  return res.json() as Promise<DriveFileMeta>;
}

/** Convert a Google Docs / Sheets / etc. to plain text/markdown via export. */
async function fetchFileContent(meta: DriveFileMeta, accessToken: string): Promise<string> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  if (meta.mimeType.startsWith('application/vnd.google-apps.')) {
    // Export Google Docs as plain text; Sheets as CSV; everything else as plain text
    const exportMime =
      meta.mimeType === 'application/vnd.google-apps.spreadsheet'
        ? 'text/csv'
        : 'text/plain';
    const url = `https://www.googleapis.com/drive/v3/files/${meta.id}/export?mimeType=${encodeURIComponent(exportMime)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Drive export failed (${res.status})`);
    }
    return res.text();
  }

  // Binary / native file — download raw and return as text (works for .txt, .md, .csv)
  const url = `https://www.googleapis.com/drive/v3/files/${meta.id}?alt=media`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Drive download failed (${res.status})`);
  }
  return res.text();
}

/** Safe Brain path derived from file name */
function toBrainPath(fileName: string, targetDir: string): string {
  const slug = fileName
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  // Ensure .md extension for Google Docs; keep original extension otherwise
  const hasExt = /\.\w+$/.test(slug);
  const finalName = hasExt ? slug : `${slug}.md`;
  return `${targetDir}/${finalName}`;
}

// ── fetchWithRefresh — wraps a Drive API call, refreshes on 401 ──────────────

type FetchFn = (accessToken: string) => Promise<Response>;

async function fetchWithRefresh(
  connectionId: string,
  encryptedAccessToken: string,
  encryptedRefreshToken: string | null,
  fn: FetchFn
): Promise<{ response: Response; newAccessTokenEnc?: string }> {
  const accessToken = CredentialVault.decrypt(encryptedAccessToken);
  let response = await fn(accessToken);

  if (response.status === 401 && encryptedRefreshToken) {
    // Try refreshing
    const refreshToken = CredentialVault.decrypt(encryptedRefreshToken);
    let newAccessToken: string;
    try {
      newAccessToken = await refreshAccessToken(refreshToken);
    } catch {
      // Permanent failure — mark reconnect_required
      await prisma.sourceConnection.update({
        where: { id: connectionId },
        data: { status: 'reconnect_required' },
      });
      throw new Error(`Drive connection ${connectionId} requires reconnect — token refresh failed`);
    }

    const newEnc = CredentialVault.encrypt(newAccessToken);
    await prisma.sourceConnection.update({
      where: { id: connectionId },
      data: { accessTokenEnc: newEnc },
    });

    response = await fn(newAccessToken);
    return { response, newAccessTokenEnc: newEnc };
  }

  return { response };
}

// ── Picker-selected file connection ─────────────────────────────────────────

export interface PickerFile {
  id: string;
  name: string;
  mimeType: string;
}

export interface ConnectFilesParams {
  workspaceId: string;
  userId: string;
  storage: WorkspaceStorage;
  tokens: DriveTokens;
  pickerFiles: PickerFile[];
  /** Subfolder inside Brain to write files to (default: "connectors/drive") */
  targetDir?: string;
}

export interface ConnectFilesResult {
  connected: Array<{ connectionId: string; brainPath: string; externalName: string }>;
  errors: Array<{ fileId: string; name: string; error: string }>;
}

/**
 * For each Picker-selected file:
 *   - fetch metadata + content from Drive
 *   - write content into workspace Brain
 *   - persist a SourceConnection row
 */
export async function connectFiles(params: ConnectFilesParams): Promise<ConnectFilesResult> {
  const { workspaceId, userId, storage, tokens, pickerFiles } = params;
  const targetDir = params.targetDir ?? 'connectors/drive';

  const accessTokenEnc = CredentialVault.encrypt(tokens.accessToken);
  const refreshTokenEnc = tokens.refreshToken
    ? CredentialVault.encrypt(tokens.refreshToken)
    : null;

  const connected: ConnectFilesResult['connected'] = [];
  const errors: ConnectFilesResult['errors'] = [];

  for (const pf of pickerFiles) {
    try {
      const meta = await getFileMeta(pf.id, tokens.accessToken);
      const content = await fetchFileContent(meta, tokens.accessToken);
      const brainPath = toBrainPath(meta.name, targetDir);

      await storage.writeFile(brainPath, content);

      // Upsert — if user re-connects the same file, update tokens + content
      const existing = await prisma.sourceConnection.findFirst({
        where: { externalFileId: pf.id, workspaceId },
      });

      let connectionId: string;
      if (existing) {
        await prisma.sourceConnection.update({
          where: { id: existing.id },
          data: {
            accessTokenEnc,
            refreshTokenEnc,
            lastSyncedAt: new Date(),
            remoteModifiedAt: new Date(meta.modifiedTime),
            status: 'active',
            externalName: meta.name,
            mimeType: meta.mimeType,
          },
        });
        connectionId = existing.id;
      } else {
        const conn = await prisma.sourceConnection.create({
          data: {
            provider: 'drive',
            externalFileId: pf.id,
            externalName: meta.name,
            mimeType: meta.mimeType,
            brainPath,
            workspaceId,
            userId,
            accessTokenEnc,
            refreshTokenEnc,
            lastSyncedAt: new Date(),
            remoteModifiedAt: new Date(meta.modifiedTime),
            status: 'active',
          },
        });
        connectionId = conn.id;
      }

      connected.push({ connectionId, brainPath, externalName: meta.name });
    } catch (err: any) {
      errors.push({ fileId: pf.id, name: pf.name, error: err.message });
    }
  }

  return { connected, errors };
}

// ── Sync ─────────────────────────────────────────────────────────────────────

export interface SyncResult {
  updated: number;
  skipped: number;
  failed: number;
  reconnectRequired: number;
  details: Array<{ connectionId: string; brainPath: string; outcome: 'updated' | 'skipped' | 'failed' | 'reconnect_required'; error?: string }>;
}

/**
 * Re-syncs all active Drive SourceConnections for a workspace.
 *
 * For each connection:
 *   - fetch current modifiedTime from Drive
 *   - if unchanged → skip (no write)
 *   - if changed   → fetch content, write to Brain, update lastSyncedAt + remoteModifiedAt
 *   - on 401 + successful refresh → retry; on permanent refresh failure → mark reconnect_required
 */
export async function syncWorkspaceConnections(
  workspaceId: string,
  storage: WorkspaceStorage
): Promise<SyncResult> {
  const connections = await prisma.sourceConnection.findMany({
    where: { workspaceId, provider: 'drive', status: 'active' },
  });

  const result: SyncResult = {
    updated: 0,
    skipped: 0,
    failed: 0,
    reconnectRequired: 0,
    details: [],
  };

  for (const conn of connections) {
    try {
      // Fetch metadata with auto-refresh
      let meta: DriveFileMeta | null = null;

      const metaFetch: FetchFn = (accessToken) =>
        fetch(
          `https://www.googleapis.com/drive/v3/files/${conn.externalFileId}?fields=id,name,mimeType,modifiedTime`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

      const { response: metaRes } = await fetchWithRefresh(
        conn.id,
        conn.accessTokenEnc,
        conn.refreshTokenEnc ?? null,
        metaFetch
      );

      if (!metaRes.ok) {
        throw new Error(`Metadata fetch failed (${metaRes.status})`);
      }
      meta = (await metaRes.json()) as DriveFileMeta;

      const remoteModified = new Date(meta.modifiedTime);
      const storedModified = conn.remoteModifiedAt;

      // Skip if unchanged
      if (storedModified && remoteModified <= storedModified) {
        result.skipped++;
        result.details.push({ connectionId: conn.id, brainPath: conn.brainPath, outcome: 'skipped' });
        continue;
      }

      // Content changed — re-fetch (re-read current token from DB in case it was refreshed above)
      const freshConn = await prisma.sourceConnection.findUnique({ where: { id: conn.id } });
      if (!freshConn || freshConn.status === 'reconnect_required') {
        result.reconnectRequired++;
        result.details.push({ connectionId: conn.id, brainPath: conn.brainPath, outcome: 'reconnect_required' });
        continue;
      }

      const contentFetch: FetchFn = (accessToken) => {
        if (meta!.mimeType.startsWith('application/vnd.google-apps.')) {
          const exportMime =
            meta!.mimeType === 'application/vnd.google-apps.spreadsheet'
              ? 'text/csv'
              : 'text/plain';
          return fetch(
            `https://www.googleapis.com/drive/v3/files/${conn.externalFileId}/export?mimeType=${encodeURIComponent(exportMime)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
        }
        return fetch(
          `https://www.googleapis.com/drive/v3/files/${conn.externalFileId}?alt=media`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
      };

      const { response: contentRes } = await fetchWithRefresh(
        conn.id,
        freshConn.accessTokenEnc,
        freshConn.refreshTokenEnc ?? null,
        contentFetch
      );

      if (!contentRes.ok) {
        throw new Error(`Content fetch failed (${contentRes.status})`);
      }

      const content = await contentRes.text();
      await storage.writeFile(conn.brainPath, content);

      await prisma.sourceConnection.update({
        where: { id: conn.id },
        data: {
          lastSyncedAt: new Date(),
          remoteModifiedAt: remoteModified,
        },
      });

      result.updated++;
      result.details.push({ connectionId: conn.id, brainPath: conn.brainPath, outcome: 'updated' });
    } catch (err: any) {
      // Check if it was flagged reconnect_required by fetchWithRefresh
      const recheck = await prisma.sourceConnection.findUnique({ where: { id: conn.id } });
      if (recheck?.status === 'reconnect_required') {
        result.reconnectRequired++;
        result.details.push({ connectionId: conn.id, brainPath: conn.brainPath, outcome: 'reconnect_required', error: err.message });
      } else {
        result.failed++;
        result.details.push({ connectionId: conn.id, brainPath: conn.brainPath, outcome: 'failed', error: err.message });
      }
    }
  }

  return result;
}

/** List all Drive SourceConnections for a workspace (status summary only — no tokens). */
export async function listConnections(workspaceId: string) {
  const rows = await prisma.sourceConnection.findMany({
    where: { workspaceId, provider: 'drive' },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      externalFileId: true,
      externalName: true,
      mimeType: true,
      brainPath: true,
      lastSyncedAt: true,
      remoteModifiedAt: true,
      status: true,
      createdAt: true,
    },
  });
  return rows;
}
