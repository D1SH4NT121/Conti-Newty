import { WorkspaceStorage } from '../../modules/storage/workspace-storage';

export interface ConnectorIngestResult {
  connector: string;
  targetPath: string;
  fileCount: number;
  files: string[];
  status: 'COMPLETED' | 'FAILED';
  detail?: string;
}

// --------------- Google Drive ---------------
export class DriveConnector {
  public static async ingest(
    storage: WorkspaceStorage,
    params: { accessToken: string; folderId?: string; targetPath?: string }
  ): Promise<ConnectorIngestResult> {
    const target = params.targetPath || 'connectors/drive';
    const files: string[] = [];

    const headers: Record<string, string> = {
      Authorization: `Bearer ${params.accessToken}`,
    };

    const q = params.folderId
      ? `'${params.folderId}' in parents and trashed=false`
      : `'root' in parents and trashed=false`;

    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&pageSize=100`;
    const listRes = await fetch(listUrl, { headers });
    if (!listRes.ok) {
      const errBody = await listRes.text();
      return { connector: 'drive', targetPath: target, fileCount: 0, files: [], status: 'FAILED', detail: errBody };
    }

    const listData: any = await listRes.json();
    const driveFiles: Array<{ id: string; name: string; mimeType: string }> = listData.files || [];

    for (const df of driveFiles) {
      if (df.mimeType === 'application/vnd.google-apps.folder') continue;

      let exportUrl: string;
      let fileName = df.name;

      if (df.mimeType.startsWith('application/vnd.google-apps.')) {
        // Export Google Docs as plain text
        exportUrl = `https://www.googleapis.com/drive/v3/files/${df.id}/export?mimeType=text/plain`;
        if (!fileName.endsWith('.txt') && !fileName.endsWith('.md')) fileName += '.md';
      } else {
        exportUrl = `https://www.googleapis.com/drive/v3/files/${df.id}?alt=media`;
      }

      try {
        const contentRes = await fetch(exportUrl, { headers });
        if (contentRes.ok) {
          const content = await contentRes.text();
          const filePath = `${target}/${fileName}`;
          await storage.writeFile(filePath, content);
          files.push(filePath);
        }
      } catch {
        // Skip files that can't be downloaded
      }
    }

    return { connector: 'drive', targetPath: target, fileCount: files.length, files, status: 'COMPLETED' };
  }
}

// --------------- Jira ---------------
export class JiraConnector {
  public static async ingest(
    storage: WorkspaceStorage,
    params: { baseUrl: string; email: string; apiToken: string; jql?: string; targetPath?: string }
  ): Promise<ConnectorIngestResult> {
    const target = params.targetPath || 'connectors/jira';
    const files: string[] = [];

    const authHeader = 'Basic ' + Buffer.from(`${params.email}:${params.apiToken}`).toString('base64');
    const jql = params.jql || 'ORDER BY updated DESC';
    const searchUrl = `${params.baseUrl.replace(/\/+$/, '')}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,description,status,priority,assignee,updated`;

    const res = await fetch(searchUrl, {
      headers: { Authorization: authHeader, Accept: 'application/json' },
    });

    if (!res.ok) {
      const errBody = await res.text();
      return { connector: 'jira', targetPath: target, fileCount: 0, files: [], status: 'FAILED', detail: errBody };
    }

    const data: any = await res.json();
    const issues: any[] = data.issues || [];

    for (const issue of issues) {
      const key = issue.key;
      const fields = issue.fields || {};
      const descriptionText = fields.description?.content
        ?.map((block: any) => block.content?.map((c: any) => c.text || '').join('') || '')
        .join('\n') || fields.description || 'No description';

      const markdown = [
        `# ${key}: ${fields.summary || 'Untitled'}`,
        '',
        `**Status:** ${fields.status?.name || 'Unknown'}`,
        `**Priority:** ${fields.priority?.name || 'None'}`,
        `**Assignee:** ${fields.assignee?.displayName || 'Unassigned'}`,
        `**Updated:** ${fields.updated || ''}`,
        '',
        '## Description',
        '',
        typeof descriptionText === 'string' ? descriptionText : JSON.stringify(descriptionText),
      ].join('\n');

      const filePath = `${target}/${key}.md`;
      await storage.writeFile(filePath, markdown);
      files.push(filePath);
    }

    return { connector: 'jira', targetPath: target, fileCount: files.length, files, status: 'COMPLETED' };
  }
}

// --------------- Slack ---------------
export class SlackConnector {
  public static async ingest(
    storage: WorkspaceStorage,
    params: { botToken: string; channelIds: string[]; targetPath?: string; limit?: number }
  ): Promise<ConnectorIngestResult> {
    const target = params.targetPath || 'connectors/slack';
    const files: string[] = [];
    const limit = params.limit || 200;

    for (const channelId of params.channelIds) {
      // Fetch channel info
      const infoRes = await fetch(`https://slack.com/api/conversations.info?channel=${channelId}`, {
        headers: { Authorization: `Bearer ${params.botToken}` },
      });
      const infoData: any = infoRes.ok ? await infoRes.json() : {};
      const channelName = infoData.channel?.name || channelId;

      // Fetch history
      const historyRes = await fetch(
        `https://slack.com/api/conversations.history?channel=${channelId}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${params.botToken}` } }
      );

      if (!historyRes.ok) continue;
      const historyData: any = await historyRes.json();
      if (!historyData.ok) continue;

      const messages: any[] = historyData.messages || [];
      const lines: string[] = [`# #${channelName}`, '', `_${messages.length} messages imported_`, ''];

      for (const msg of messages.reverse()) {
        const ts = new Date(parseFloat(msg.ts) * 1000).toISOString();
        const user = msg.user || 'bot';
        lines.push(`**[${ts}] ${user}:** ${msg.text || ''}`);
      }

      const filePath = `${target}/${channelName}.md`;
      await storage.writeFile(filePath, lines.join('\n'));
      files.push(filePath);
    }

    return { connector: 'slack', targetPath: target, fileCount: files.length, files, status: 'COMPLETED' };
  }
}

// --------------- Tribal Memory ---------------
export class TribalMemoryConnector {
  public static async ingest(
    storage: WorkspaceStorage,
    params: { entries: Array<{ title: string; content: string; author?: string; tags?: string[] }>; targetPath?: string }
  ): Promise<ConnectorIngestResult> {
    const target = params.targetPath || 'tribal';
    const files: string[] = [];

    for (const entry of params.entries) {
      const slug = entry.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const markdown = [
        `# ${entry.title}`,
        '',
        entry.author ? `**Author:** ${entry.author}` : '',
        entry.tags?.length ? `**Tags:** ${entry.tags.join(', ')}` : '',
        '',
        entry.content,
        '',
        `_Captured: ${new Date().toISOString()}_`,
      ].filter(Boolean).join('\n');

      const filePath = `${target}/${slug}.md`;
      await storage.writeFile(filePath, markdown);
      files.push(filePath);
    }

    return { connector: 'tribal', targetPath: target, fileCount: files.length, files, status: 'COMPLETED' };
  }
}
