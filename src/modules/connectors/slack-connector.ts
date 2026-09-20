/**
 * Slack Connector — OAuth + persistent connections with archive-based sync
 *
 * Scope: channels:read groups:read im:read mpim:read users:read chat:write (OAuth scopes)
 *
 * Flow:
 *   1. slackAuthUrl()           → redirect user to Slack consent screen
 *   2. exchangeCode()           → trade auth code for access token
 *   3. fetchSlackWorkspaceInfo() → get workspace ID and team name
 *   4. listChannels()           → list accessible channels
 *   5. connectSlack()           → validate workspace, create SlackConnection row
 *   6. syncSlackConnection()    → fetch messages from channels, write to Brain
 *   7. syncWorkspaceSlackConnections() → sync all connections in workspace
 *
 * Archive format: "raw" (all messages in one file) or "threaded" (organize by thread)
 * Token refresh: Slack tokens don't expire but we validate on each sync and mark auth_failed if revoked.
 */

import { prisma } from '../../db/client';
import { CredentialVault } from '../auth/credential-vault';
import { WorkspaceStorage } from '../storage/workspace-storage';
import { config } from '../../config';

// ── OAuth constants ──────────────────────────────────────────────────────────

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_API_BASE = 'https://slack.com/api';

function slackCallbackUrl(): string {
  return `${config.frontendUrl}/w/slack/callback`;
}

export interface SlackAuthUrlOptions {
  /** State parameter to round-trip (workspaceId + userId encoded) */
  state: string;
}

/** Returns the Slack OAuth2 authorization URL. */
export function slackAuthUrl(options: SlackAuthUrlOptions): string {
  const url = new URL(SLACK_AUTH_URL);
  url.searchParams.set('client_id', config.slackClientId);
  url.searchParams.set('redirect_uri', slackCallbackUrl());
  url.searchParams.set('scope', 'channels:read groups:read im:read mpim:read users:read chat:write');
  url.searchParams.set('state', options.state);
  return url.toString();
}

// ── Token exchange ───────────────────────────────────────────────────────────

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(SLACK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.slackClientId,
      client_secret: config.slackClientSecret,
      code,
      redirect_uri: slackCallbackUrl(),
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack token exchange failed: ${body}`);
  }

  const data = (await res.json()) as { ok: boolean; access_token: string; team?: { id: string; name: string } };
  if (!data.ok) {
    throw new Error(`Slack API error: ${data}`);
  }

  return data.access_token;
}

// ── Slack API helpers ────────────────────────────────────────────────────────

export interface SlackUser {
  id: string;
  real_name: string;
  profile: { email: string };
}

export interface SlackWorkspaceInfo {
  workspaceId: string;
  teamName: string;
}

/**
 * Fetch workspace info (team ID and name) from Slack.
 * Validates token by making an authenticated API call.
 */
export async function fetchSlackWorkspaceInfo(accessToken: string): Promise<SlackWorkspaceInfo> {
  const res = await fetch(`${SLACK_API_BASE}/auth.test`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Slack workspace info: ${res.statusText}`);
  }

  const data = (await res.json()) as {
    ok: boolean;
    user_id: string;
    team_name: string;
    team_id: string;
  };

  if (!data.ok) {
    throw new Error(`Slack workspace fetch failed: ${data}`);
  }

  return {
    workspaceId: data.team_id,
    teamName: data.team_name,
  };
}

// ── Channel listing ──────────────────────────────────────────────────────────

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_general: boolean;
  num_members?: number;
}

export interface SlackChannelsResult {
  ok: boolean;
  channels?: SlackChannel[];
  groups?: SlackChannel[];
}

/**
 * List all accessible channels and groups in Slack workspace.
 */
export async function listChannels(accessToken: string): Promise<SlackChannel[]> {
  const channels: SlackChannel[] = [];

  // Fetch public channels
  const pubRes = await fetch(`${SLACK_API_BASE}/conversations.list?types=public_channel&limit=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (pubRes.ok) {
    const data = (await pubRes.json()) as SlackChannelsResult;
    if (data.ok && data.channels) {
      channels.push(...data.channels);
    }
  }

  // Fetch private channels (groups)
  const privRes = await fetch(`${SLACK_API_BASE}/conversations.list?types=private_channel&limit=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (privRes.ok) {
    const data = (await privRes.json()) as SlackChannelsResult;
    if (data.ok && data.channels) {
      channels.push(...data.channels);
    }
  }

  return channels;
}

// ── Message fetching ────────────────────────────────────────────────────────

export interface SlackMessage {
  type: string;
  user?: string;
  text: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
}

export interface SlackMessagesResult {
  ok: boolean;
  messages?: SlackMessage[];
  has_more?: boolean;
}

/**
 * Fetch messages from a channel.
 * If oldest is not specified, fetches from the last 7 days.
 * If oldest is provided (ISO string), fetches from that timestamp onward.
 * This enables incremental sync: pass connection.lastSyncedAt to fetch only new messages.
 */
export async function searchMessages(
  accessToken: string,
  channelId: string,
  oldest?: string
): Promise<SlackMessage[]> {
  const url = new URL(`${SLACK_API_BASE}/conversations.history`);
  url.searchParams.set('channel', channelId);
  url.searchParams.set('limit', '100');

  // Determine oldest timestamp to fetch
  let oldestTs: string;
  if (oldest) {
    // oldest is ISO string (from lastSyncedAt); convert to Unix timestamp
    oldestTs = Math.floor(new Date(oldest).getTime() / 1000).toString();
  } else {
    // Default: last 7 days
    oldestTs = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000).toString();
  }

  url.searchParams.set('oldest', oldestTs);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('Slack authentication failed: invalid or revoked token');
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack message fetch failed: ${body}`);
  }

  const data = (await res.json()) as SlackMessagesResult;
  if (!data.ok) {
    throw new Error(`Slack API error: ${data}`);
  }

  return data.messages || [];
}

/**
 * Fetch user display name from Slack.
 */
export async function getSlackUserInfo(accessToken: string, userId: string): Promise<string> {
  const res = await fetch(`${SLACK_API_BASE}/users.info?user=${userId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    return userId; // Fallback to user ID if fetch fails
  }

  const data = (await res.json()) as { ok: boolean; user?: SlackUser };
  if (data.ok && data.user) {
    return data.user.real_name || data.user.profile?.email || userId;
  }

  return userId;
}

// ── Message formatting ───────────────────────────────────────────────────────

function messageToDoomMarkdown(
  message: SlackMessage,
  userName: string,
  context?: { channelId: string; slackWorkspaceId: string }
): string {
  const timestamp = new Date(parseFloat(message.ts) * 1000).toISOString();

  // Generate Slack message permalink if context provided
  const slackUrl = context
    ? `https://${context.slackWorkspaceId}.slack.com/archives/${context.channelId}/p${message.ts.replace('.', '')}`
    : '';

  const permalink = slackUrl ? ` — [view in Slack](${slackUrl})` : '';

  return [
    `**${userName}** (${timestamp})${permalink}`,
    '',
    message.text || '(no text)',
    '',
  ].join('\n');
}

/**
 * Convert channel messages to markdown format (raw or threaded).
 * Context parameter enables Slack message permalinks for citation verification.
 */
export function channelToMarkdown(
  channelName: string,
  messages: SlackMessage[],
  userMap: Map<string, string>,
  archiveFormat = 'raw',
  context?: { channelId: string; slackWorkspaceId: string }
): string {
  const lines: string[] = [`# #${channelName}`, '', 'Messages:', ''];

  if (archiveFormat === 'threaded') {
    // Group messages by thread
    const threads = new Map<string, SlackMessage[]>();
    const rootMessages: SlackMessage[] = [];

    for (const msg of messages) {
      if (msg.thread_ts) {
        if (!threads.has(msg.thread_ts)) {
          threads.set(msg.thread_ts, []);
        }
        threads.get(msg.thread_ts)!.push(msg);
      } else {
        rootMessages.push(msg);
      }
    }

    // Output root messages and their threads
    for (const msg of rootMessages) {
      const userName = userMap.get(msg.user || 'unknown') || 'Unknown';
      lines.push(messageToDoomMarkdown(msg, userName, context));

      if (msg.ts && threads.has(msg.ts)) {
        lines.push('**Thread:**');
        lines.push('');
        for (const reply of threads.get(msg.ts)!) {
          const replyUserName = userMap.get(reply.user || 'unknown') || 'Unknown';
          lines.push(messageToDoomMarkdown(reply, replyUserName, context));
        }
        lines.push('---');
        lines.push('');
      }
    }
  } else {
    // Raw format: all messages chronologically
    for (const msg of messages) {
      const userName = userMap.get(msg.user || 'unknown') || 'Unknown';
      lines.push(messageToDoomMarkdown(msg, userName, context));
    }
  }

  return lines.join('\n');
}

// ── Connection management ────────────────────────────────────────────────────

export interface ConnectSlackParams {
  workspaceId: string;
  userId: string;
  storage: WorkspaceStorage;
  accessToken: string;
  slackWorkspaceId: string;
  slackTeamName: string;
  channels: string[]; // Channel IDs to sync
  archiveFormat?: string; // raw | threaded
  targetPath?: string;
}

export interface ConnectSlackResult {
  connectionId: string;
  messageCount: number;
  fileCount: number;
}

/**
 * Connect to a Slack workspace:
 *   1. Validate token by fetching workspace info
 *   2. Create SlackConnection row
 *   3. Perform initial sync
 */
export async function connectSlack(params: ConnectSlackParams): Promise<ConnectSlackResult> {
  const {
    workspaceId,
    userId,
    storage,
    accessToken,
    slackWorkspaceId,
    slackTeamName,
    channels,
    archiveFormat,
    targetPath,
  } = params;

  // Validate access token
  const validateRes = await fetch(`${SLACK_API_BASE}/auth.test`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!validateRes.ok) {
    throw new Error(`Failed to validate Slack access: ${validateRes.statusText}`);
  }

  const validateData = (await validateRes.json()) as { ok: boolean };
  if (!validateData.ok) {
    throw new Error('Slack token validation failed');
  }

  // Encrypt token
  const accessTokenEnc = CredentialVault.encrypt(accessToken);

  // Create or update connection
  const existing = await prisma.slackConnection.findFirst({
    where: { workspaceId, slackWorkspaceId },
  });

  let connectionId: string;
  if (existing) {
    await prisma.slackConnection.update({
      where: { id: existing.id },
      data: {
        accessTokenEnc,
        channels: JSON.stringify(channels),
        archiveFormat: archiveFormat || 'raw',
        syncStatus: 'active',
        lastError: null,
      },
    });
    connectionId = existing.id;
  } else {
    const conn = await prisma.slackConnection.create({
      data: {
        workspaceId,
        userId,
        slackWorkspaceId,
        slackTeamName,
        accessTokenEnc,
        channels: JSON.stringify(channels),
        archiveFormat: archiveFormat || 'raw',
        targetPath: targetPath || 'connectors/slack',
        syncStatus: 'active',
      },
    });
    connectionId = conn.id;
  }

  // Perform initial sync
  const syncResult = await syncSlackConnection(connectionId, storage);

  return {
    connectionId,
    messageCount: syncResult.messageCount,
    fileCount: syncResult.fileCount,
  };
}

// ── Sync logic ───────────────────────────────────────────────────────────────

export interface SyncSlackResult {
  updated: number;
  skipped: number;
  failed: number;
  fileCount: number;
  messageCount: number;
  errors: Array<{ channelId: string; error: string }>;
}

/**
 * Sync a single Slack connection:
 *   1. Fetch messages from each connected channel
 *   2. Convert to markdown
 *   3. Write to workspace
 */
export async function syncSlackConnection(
  connectionId: string,
  storage: WorkspaceStorage
): Promise<SyncSlackResult> {
  const conn = await prisma.slackConnection.findUnique({
    where: { id: connectionId },
  });

  if (!conn) {
    throw new Error(`SlackConnection not found: ${connectionId}`);
  }

  const accessToken = CredentialVault.decrypt(conn.accessTokenEnc);
  const channelIds = JSON.parse(conn.channels) as string[];
  const errors: Array<{ channelId: string; error: string }> = [];
  let fileCount = 0;
  let messageCount = 0;

  try {
    // Pre-fetch user map for this connection
    const userMap = new Map<string, string>();
    userMap.set('unknown', 'Unknown');

    for (const channelId of channelIds) {
      try {
        // Fetch messages since last sync (incremental), or last 7 days if first sync
        const messages = await searchMessages(
          accessToken,
          channelId,
          conn.lastSyncedAt?.toISOString() // Pass lastSyncedAt for incremental fetch
        );
        messageCount += messages.length;

        // Resolve user IDs to names
        for (const msg of messages) {
          if (msg.user && !userMap.has(msg.user)) {
            const userName = await getSlackUserInfo(accessToken, msg.user);
            userMap.set(msg.user, userName);
          }
        }

        // Convert to markdown
        const markdown = channelToMarkdown(
          `channel-${channelId}`,
          messages,
          userMap,
          conn.archiveFormat,
          {
            channelId,
            slackWorkspaceId: conn.slackWorkspaceId,
          }
        );
        const filePath = `${conn.targetPath}/channel-${channelId}.md`;
        await storage.writeFile(filePath, markdown);
        fileCount++;
      } catch (err: any) {
        if (err.message && err.message.includes('authentication failed')) {
          throw err;
        }
        errors.push({ channelId, error: err.message });
      }
    }

    // Update connection: success
    await prisma.slackConnection.update({
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
      messageCount,
      errors,
    };
  } catch (err: any) {
    // Determine error type
    const errorMsg = err.message;
    const syncStatus = errorMsg.includes('authentication failed') ? 'auth_failed' : 'sync_failed';

    // Update connection: failure
    await prisma.slackConnection.update({
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

export interface SyncAllSlackResult {
  totalUpdated: number;
  connectionsSynced: number;
  connectionsFailed: number;
  details: Array<{
    connectionId: string;
    slackTeamName: string;
    outcome: 'success' | 'failed';
    fileCount?: number;
    error?: string;
  }>;
}

/**
 * Sync all active Slack connections for a workspace.
 */
export async function syncWorkspaceSlackConnections(
  workspaceId: string,
  storage: WorkspaceStorage
): Promise<SyncAllSlackResult> {
  const connections = await prisma.slackConnection.findMany({
    where: { workspaceId, syncStatus: 'active' },
  });

  let totalUpdated = 0;
  let connectionsSynced = 0;
  let connectionsFailed = 0;
  const details: SyncAllSlackResult['details'] = [];

  for (const conn of connections) {
    try {
      const result = await syncSlackConnection(conn.id, storage);
      totalUpdated += result.fileCount;
      connectionsSynced++;
      details.push({
        connectionId: conn.id,
        slackTeamName: conn.slackTeamName,
        outcome: 'success',
        fileCount: result.fileCount,
      });
    } catch (err: any) {
      connectionsFailed++;
      details.push({
        connectionId: conn.id,
        slackTeamName: conn.slackTeamName,
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

export interface SlackConnectionPublic {
  id: string;
  slackWorkspaceId: string;
  slackTeamName: string;
  channels: string[];
  archiveFormat: string;
  lastSyncedAt: Date | null;
  syncStatus: string;
  lastError: string | null;
}

export async function listSlackConnections(workspaceId: string): Promise<SlackConnectionPublic[]> {
  const connections = await prisma.slackConnection.findMany({
    where: { workspaceId },
    select: {
      id: true,
      slackWorkspaceId: true,
      slackTeamName: true,
      channels: true,
      archiveFormat: true,
      lastSyncedAt: true,
      syncStatus: true,
      lastError: true,
    },
  });

  return connections.map((c) => ({
    ...c,
    channels: JSON.parse(c.channels),
  })) as SlackConnectionPublic[];
}

// ── Disconnection ────────────────────────────────────────────────────────────

export async function disconnectSlackConnection(connectionId: string): Promise<void> {
  await prisma.slackConnection.delete({
    where: { id: connectionId },
  });
}
