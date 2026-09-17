import crypto from 'crypto';

export interface SourceCitation {
  filePath: string;
  startLine?: number;
  endLine?: number;
  snippet?: string;
  title?: string;
  contentHash?: string;
  retrievedAt?: string;
  workspaceId?: string;
  taskId?: string;
}

export interface VerifiedSourceCitation {
  filePath: string;
  startLine: number;
  endLine: number;
  contentHash: string;
  retrievedAt: string;
  workspaceId: string;
  taskId: string;
  snippet: string;
}

export interface SourceRecordMetadata {
  workspaceId?: string;
  taskId?: string;
  retrievedAt?: string;
}

export function computeContentHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function extractSnippet(content: string, startLine: number, endLine: number): string {
  const lines = content.split('\n');
  const start = Math.max(0, startLine - 1);
  const end = Math.min(lines.length, endLine);
  return lines.slice(start, end).join('\n');
}

export function createVerifiedCitation(params: {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string;
  workspaceId: string;
  taskId: string;
  retrievedAt?: string;
}): VerifiedSourceCitation {
  return {
    filePath: params.filePath,
    startLine: params.startLine,
    endLine: params.endLine,
    contentHash: computeContentHash(params.snippet),
    retrievedAt: params.retrievedAt || new Date().toISOString(),
    workspaceId: params.workspaceId,
    taskId: params.taskId,
    snippet: params.snippet
  };
}

export interface ExtractCitationOptions {
  sourceTracker?: SourceTracker;
  workspaceId?: string;
  taskId?: string;
}

export function extractCitations(text: string, options?: ExtractCitationOptions): SourceCitation[] {
  const citations: SourceCitation[] = [];
  // Matches [source: path/file.ext:start-end] or [source: path/file.ext]
  const pattern = /\[source:\s*([^:\]\s]+)(?::(\d+)(?:-(\d+))?)?\]/gi;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const filePath = match[1];
    const startLine = match[2] ? parseInt(match[2], 10) : undefined;
    const endLine = match[3] ? parseInt(match[3], 10) : startLine;

    // Reject hallucinated citations: If sourceTracker is provided, the file MUST have been accessed
    if (options?.sourceTracker) {
      const accessRecord = options.sourceTracker.getRecord(filePath);
      if (!accessRecord) {
        // Hallucinated citation — skip and do not expose to user
        continue;
      }

      const retrievedAt = accessRecord.retrievedAt;
      const workspaceId = options?.workspaceId || accessRecord.workspaceId;
      const taskId = options?.taskId || accessRecord.taskId;

      let snippet: string | undefined;
      let contentHash: string | undefined;

      if (accessRecord.fullContent) {
        const sLine = startLine !== undefined ? startLine : 1;
        const eLine = endLine !== undefined ? endLine : accessRecord.fullContent.split('\n').length;
        snippet = extractSnippet(accessRecord.fullContent, sLine, eLine);
        contentHash = computeContentHash(snippet);
      } else if (accessRecord.snippet) {
        snippet = accessRecord.snippet;
        contentHash = computeContentHash(snippet);
      }

      citations.push({
        filePath,
        startLine,
        endLine,
        snippet,
        contentHash,
        retrievedAt,
        workspaceId,
        taskId
      });
    } else {
      citations.push({
        filePath,
        startLine,
        endLine,
        workspaceId: options?.workspaceId,
        taskId: options?.taskId
      });
    }
  }

  return citations;
}

export function sanitizeHallucinatedCitations(text: string, sourceTracker?: SourceTracker): string {
  if (!sourceTracker) return text;
  const pattern = /\[source:\s*([^:\]\s]+)(?::(\d+)(?:-(\d+))?)?\]/gi;
  return text.replace(pattern, (match, filePath) => {
    const accessRecord = sourceTracker.getRecord(filePath);
    if (!accessRecord) {
      // Strip hallucinated citation from text
      return '';
    }
    return match;
  }).replace(/\s{2,}/g, ' ').trim();
}

export function extractVerifiedCitations(text: string, options: ExtractCitationOptions): VerifiedSourceCitation[] {
  const regularCitations = extractCitations(text, options);
  const verifiedList: VerifiedSourceCitation[] = [];

  for (const c of regularCitations) {
    let snippet = c.snippet || '';
    let startLine = c.startLine !== undefined ? c.startLine : 1;
    let endLine = c.endLine !== undefined ? c.endLine : 1;

    if (options.sourceTracker) {
      const rec = options.sourceTracker.getRecord(c.filePath);
      if (!rec) continue;

      if (rec.fullContent) {
        const totalLines = rec.fullContent.split('\n').length;
        if (c.startLine === undefined) {
          startLine = 1;
          endLine = totalLines;
        }
        snippet = extractSnippet(rec.fullContent, startLine, endLine);
      }
    }

    if (snippet) {
      verifiedList.push(createVerifiedCitation({
        filePath: c.filePath,
        startLine,
        endLine,
        snippet,
        workspaceId: options.workspaceId || c.workspaceId || '',
        taskId: options.taskId || c.taskId || '',
        retrievedAt: c.retrievedAt
      }));
    }
  }

  return verifiedList;
}

export async function verifyCitationAgainstDisk(
  citation: VerifiedSourceCitation,
  storage: { readFile: (path: string) => Promise<string> }
): Promise<{ valid: boolean; diskHash?: string; expectedHash: string }> {
  try {
    const fullContent = await storage.readFile(citation.filePath);
    const diskSnippet = extractSnippet(fullContent, citation.startLine, citation.endLine);
    const diskHash = computeContentHash(diskSnippet);
    return {
      valid: diskHash === citation.contentHash,
      diskHash,
      expectedHash: citation.contentHash
    };
  } catch (err) {
    return {
      valid: false,
      expectedHash: citation.contentHash
    };
  }
}

export function formatCitation(citation: SourceCitation): string {
  if (citation.startLine !== undefined) {
    if (citation.endLine !== undefined && citation.endLine !== citation.startLine) {
      return `[source: ${citation.filePath}:${citation.startLine}-${citation.endLine}]`;
    }
    return `[source: ${citation.filePath}:${citation.startLine}]`;
  }
  return `[source: ${citation.filePath}]`;
}

export interface TrackedAccessRecord {
  filePath: string;
  fullContent?: string;
  startLine?: number;
  endLine?: number;
  snippet?: string;
  workspaceId?: string;
  taskId?: string;
  retrievedAt: string;
}

export class SourceTracker {
  private sources: Map<string, SourceCitation> = new Map();
  private records: Map<string, TrackedAccessRecord> = new Map();

  public recordAccess(
    filePath: string,
    content?: string,
    startLine?: number,
    endLine?: number,
    metadata?: SourceRecordMetadata
  ): void {
    const key = filePath;
    const existing = this.sources.get(key);
    const retrievedAt = metadata?.retrievedAt || new Date().toISOString();

    let snippet: string | undefined;
    let contentHash: string | undefined;

    if (content) {
      if (startLine !== undefined && endLine !== undefined) {
        snippet = extractSnippet(content, startLine, endLine);
      } else {
        snippet = content.slice(0, 500);
      }
      contentHash = computeContentHash(snippet);
    }

    this.sources.set(key, {
      filePath,
      startLine: startLine ?? existing?.startLine,
      endLine: endLine ?? existing?.endLine,
      snippet: snippet || existing?.snippet,
      contentHash,
      retrievedAt,
      workspaceId: metadata?.workspaceId || existing?.workspaceId,
      taskId: metadata?.taskId || existing?.taskId
    });

    this.records.set(key, {
      filePath,
      fullContent: content,
      startLine,
      endLine,
      snippet,
      workspaceId: metadata?.workspaceId,
      taskId: metadata?.taskId,
      retrievedAt
    });
  }

  public getRecord(filePath: string): TrackedAccessRecord | undefined {
    return this.records.get(filePath);
  }

  public getAccessedSources(): SourceCitation[] {
    return Array.from(this.sources.values());
  }

  public getVerifiedCitations(workspaceId: string, taskId: string): VerifiedSourceCitation[] {
    const verified: VerifiedSourceCitation[] = [];
    for (const [filePath, rec] of this.records.entries()) {
      if (rec.snippet || rec.fullContent) {
        const snippet = rec.snippet || rec.fullContent || '';
        const lines = snippet.split('\n');
        verified.push(createVerifiedCitation({
          filePath,
          startLine: rec.startLine || 1,
          endLine: rec.endLine || lines.length,
          snippet,
          workspaceId: workspaceId || rec.workspaceId || '',
          taskId: taskId || rec.taskId || '',
          retrievedAt: rec.retrievedAt
        }));
      }
    }
    return verified;
  }

  public generateGroundingAppendix(): string {
    const sources = this.getAccessedSources();
    if (sources.length === 0) {
      return '';
    }

    const lines = ['\n\n### Grounded Sources:'];
    for (const s of sources) {
      lines.push(`- **${s.filePath}**${s.startLine ? ` (lines ${s.startLine}-${s.endLine ?? s.startLine})` : ''}`);
    }
    return lines.join('\n');
  }
}

