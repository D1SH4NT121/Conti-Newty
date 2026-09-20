/**
 * Jira Connector — OAuth + persistent connections with auto-refresh
 *
 * Scope: read:jira-work write:jira-work read:me (OAuth scopes)
 *
 * Flow:
 *   1. jiraAuthUrl()           → redirect user to Atlassian consent screen
 *   2. exchangeCode()          → trade auth code for access token
 *   3. fetchCloudInstanceId()  → get user's Jira site ID (needed for API calls)
 *   4. connectJira()           → validate instance, create JiraConnection row
 *   5. syncJiraConnection()    → fetch issues via JQL, write to Brain
 *   6. syncWorkspaceJiraConnections() → sync all connections in workspace
 *
 * Token refresh: Jira access tokens don't expire (unlike Google refresh tokens),
 * but we validate on each sync and mark auth_failed if credentials are revoked.
 */

import { prisma } from '../../db/client';
import { CredentialVault } from '../auth/credential-vault';
import { WorkspaceStorage } from '../storage/workspace-storage';
import { config } from '../../config';

// ── OAuth constants ──────────────────────────────────────────────────────────

const JIRA_AUTH_URL = 'https://auth.atlassian.com/oauth/authorize';
const JIRA_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const JIRA_API_BASE = 'https://api.atlassian.com';

function jiraCallbackUrl(): string {
  return `${config.frontendUrl}/w/jira/callback`;
}

export interface JiraAuthUrlOptions {
  /** State parameter to round-trip (workspaceId + userId encoded) */
  state: string;
}

/** Returns the Atlassian OAuth2 authorization URL for Jira. */
export function jiraAuthUrl(options: JiraAuthUrlOptions): string {
  const url = new URL(JIRA_AUTH_URL);
  url.searchParams.set('client_id', config.jiraClientId);
  url.searchParams.set('redirect_uri', jiraCallbackUrl());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'read:jira-work write:jira-work read:me');
  url.searchParams.set('state', options.state);
  url.searchParams.set('prompt', 'consent');
  return url.toString();
}

// ── Token exchange ───────────────────────────────────────────────────────────

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(JIRA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: config.jiraClientId,
      client_secret: config.jiraClientSecret,
      code,
      redirect_uri: jiraCallbackUrl(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira token exchange failed: ${body}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

// ── Cloud instance lookup ────────────────────────────────────────────────────

export async function fetchCloudInstanceId(accessToken: string): Promise<string> {
  const res = await fetch(`${JIRA_API_BASE}/oauth/token/accessible-resources`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to fetch Jira instance ID: ${body}`);
  }

  const data = (await res.json()) as Array<{ id: string; name: string; url: string }>;
  if (!data.length) {
    throw new Error('No accessible Jira instances found for this token');
  }

  return data[0].id; // Use first accessible instance
}

// ── Jira API helpers ─────────────────────────────────────────────────────────

export interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description?: any;
    status: { name: string };
    priority?: { name: string };
    assignee?: { displayName: string };
    updated: string;
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
}

/**
 * Fetch issues from Jira using JQL query.
 * Validates token by making an authenticated API call.
 */
export async function searchIssues(
  baseUrl: string,
  accessToken: string,
  jql: string,
  maxResults = 50
): Promise<JiraIssue[]> {
  const url = new URL(`${baseUrl}/rest/api/3/search`);
  url.searchParams.set('jql', jql);
  url.searchParams.set('maxResults', maxResults.toString());
  url.searchParams.set('fields', 'summary,description,status,priority,assignee,updated');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Jira authentication failed: invalid or revoked token');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira search failed: ${body}`);
  }

  const data = (await res.json()) as JiraSearchResult;
  return data.issues || [];
}

/**
 * Convert Jira issue to markdown format.
 */
function issueToDoomMarkdown(issue: JiraIssue): string {
  const fields = issue.fields;
  const descriptionText =
    typeof fields.description === 'string'
      ? fields.description
      : fields.description?.content
        ? (fields.description.content as any[])
            .map((block: any) =>
              block.content ? (block.content as any[]).map((c: any) => c.text || '').join('') : ''
            )
            .join('\n')
        : 'No description';

  return [
    `# ${issue.key}: ${fields.summary || 'Untitled'}`,
    '',
    `**Status:** ${fields.status?.name || 'Unknown'}`,
    `**Priority:** ${fields.priority?.name || 'None'}`,
    `**Assignee:** ${fields.assignee?.displayName || 'Unassigned'}`,
    `**Updated:** ${fields.updated || 'Unknown'}`,
    '',
    '## Description',
    '',
    descriptionText,
  ].join('\n');
}

// ── Connection management ────────────────────────────────────────────────────

export interface ConnectJiraParams {
  workspaceId: string;
  userId: string;
  storage: WorkspaceStorage;
  accessToken: string;
  baseUrl: string;
  email: string;
  jql?: string;
  targetPath?: string;
}

export interface ConnectJiraResult {
  connectionId: string;
  issueCount: number;
  fileCount: number;
}

/**
 * Connect to a Jira instance:
 *   1. Validate token by fetching myself
 *   2. Create JiraConnection row
 *   3. Perform initial sync
 */
export async function connectJira(params: ConnectJiraParams): Promise<ConnectJiraResult> {
  const { workspaceId, userId, storage, accessToken, baseUrl, email, jql, targetPath } = params;

  // Validate access token
  const validateRes = await fetch(`${baseUrl}/rest/api/3/myself`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!validateRes.ok) {
    throw new Error(`Failed to validate Jira access: ${validateRes.statusText}`);
  }

  // Encrypt token
  const apiTokenEnc = CredentialVault.encrypt(accessToken);

  // Create or update connection
  const existing = await prisma.jiraConnection.findFirst({
    where: { workspaceId, baseUrl, email },
  });

  let connectionId: string;
  if (existing) {
    await prisma.jiraConnection.update({
      where: { id: existing.id },
      data: {
        apiTokenEnc,
        syncStatus: 'active',
        lastError: null,
      },
    });
    connectionId = existing.id;
  } else {
    const conn = await prisma.jiraConnection.create({
      data: {
        workspaceId,
        userId,
        baseUrl,
        email,
        apiTokenEnc,
        jql: jql || 'ORDER BY updated DESC',
        targetPath: targetPath || 'connectors/jira',
        syncStatus: 'active',
      },
    });
    connectionId = conn.id;
  }

  // Perform initial sync
  const syncResult = await syncJiraConnection(connectionId, storage);

  return {
    connectionId,
    issueCount: syncResult.fileCount,
    fileCount: syncResult.fileCount,
  };
}

// ── Sync logic ───────────────────────────────────────────────────────────────

export interface SyncJiraResult {
  updated: number;
  skipped: number;
  failed: number;
  fileCount: number;
  errors: Array<{ issueKey: string; error: string }>;
}

/**
 * Sync a single Jira connection:
 *   1. Fetch issues via JQL
 *   2. Convert each to markdown
 *   3. Write to workspace
 */
export async function syncJiraConnection(
  connectionId: string,
  storage: WorkspaceStorage
): Promise<SyncJiraResult> {
  const conn = await prisma.jiraConnection.findUnique({
    where: { id: connectionId },
  });

  if (!conn) {
    throw new Error(`JiraConnection not found: ${connectionId}`);
  }

  const apiToken = CredentialVault.decrypt(conn.apiTokenEnc);
  const errors: Array<{ issueKey: string; error: string }> = [];
  let fileCount = 0;

  try {
    const issues = await searchIssues(conn.baseUrl, apiToken, conn.jql, 100);

    for (const issue of issues) {
      try {
        const markdown = issueToDoomMarkdown(issue);
        const filePath = `${conn.targetPath}/${issue.key}.md`;
        await storage.writeFile(filePath, markdown);
        fileCount++;
      } catch (err: any) {
        errors.push({ issueKey: issue.key, error: err.message });
      }
    }

    // Update connection: success
    await prisma.jiraConnection.update({
      where: { id: connectionId },
      data: {
        lastSyncedAt: new Date(),
        syncStatus: 'active',
        lastError: null,
      },
    });

    return {
      updated: fileCount,
      skipped: 0,
      failed: errors.length,
      fileCount,
      errors,
    };
  } catch (err: any) {
    // Determine error type
    const errorMsg = err.message;
    const syncStatus = errorMsg.includes('authentication failed') ? 'auth_failed' : 'sync_failed';

    // Update connection: failure
    await prisma.jiraConnection.update({
      where: { id: connectionId },
      data: {
        syncStatus,
        lastError: errorMsg,
      },
    });

    throw err;
  }
}

// ── Workspace-level operations ───────────────────────────────────────────────

export interface SyncAllResult {
  totalUpdated: number;
  connectionsSynced: number;
  connectionsFailed: number;
  details: Array<{
    connectionId: string;
    baseUrl: string;
    email: string;
    outcome: 'success' | 'failed';
    fileCount?: number;
    error?: string;
  }>;
}

/**
 * Sync all active Jira connections for a workspace.
 */
export async function syncWorkspaceJiraConnections(
  workspaceId: string,
  storage: WorkspaceStorage
): Promise<SyncAllResult> {
  const connections = await prisma.jiraConnection.findMany({
    where: { workspaceId, syncStatus: 'active' },
  });

  let totalUpdated = 0;
  let connectionsSynced = 0;
  let connectionsFailed = 0;
  const details: SyncAllResult['details'] = [];

  for (const conn of connections) {
    try {
      const result = await syncJiraConnection(conn.id, storage);
      totalUpdated += result.fileCount;
      connectionsSynced++;
      details.push({
        connectionId: conn.id,
        baseUrl: conn.baseUrl,
        email: conn.email,
        outcome: 'success',
        fileCount: result.fileCount,
      });
    } catch (err: any) {
      connectionsFailed++;
      details.push({
        connectionId: conn.id,
        baseUrl: conn.baseUrl,
        email: conn.email,
        outcome: 'failed',
        error: err.message,
      });
    }
  }

  return {
    totalUpdated,
    connectionsSynced,
    connectionsFailed,
    details,
  };
}

// ── Connection listing ───────────────────────────────────────────────────────

export interface JiraConnectionPublic {
  id: string;
  baseUrl: string;
  email: string;
  jql: string;
  lastSyncedAt: Date | null;
  syncStatus: string;
  lastError: string | null;
}

export async function listJiraConnections(workspaceId: string): Promise<JiraConnectionPublic[]> {
  const connections = await prisma.jiraConnection.findMany({
    where: { workspaceId },
    select: {
      id: true,
      baseUrl: true,
      email: true,
      jql: true,
      lastSyncedAt: true,
      syncStatus: true,
      lastError: true,
    },
  });

  return connections as JiraConnectionPublic[];
}

// ── Disconnection ────────────────────────────────────────────────────────────

export async function disconnectJiraConnection(connectionId: string): Promise<void> {
  await prisma.jiraConnection.delete({
    where: { id: connectionId },
  });
}
