import crypto from 'crypto';
import { WorkspaceStorage } from '../storage/workspace-storage';
import { prisma } from '../../db/client';

export interface ProposedChange {
  id: string;
  workspaceId: string;
  filePath: string;
  proposedBy: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  originalContent: string;
  proposedContent: string;
  diff: string;
  description?: string;
  createdAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
}

export function computeLineDiff(original: string, proposed: string): string {
  const origLines = original.split(/\r?\n/);
  const propLines = proposed.split(/\r?\n/);

  const diffLines: string[] = ['--- original', '+++ proposed'];
  const maxLines = Math.max(origLines.length, propLines.length);

  for (let i = 0; i < maxLines; i++) {
    const o = origLines[i];
    const p = propLines[i];

    if (o === p) {
      if (o !== undefined) {
        diffLines.push(`  ${o}`);
      }
    } else {
      if (o !== undefined) {
        diffLines.push(`- ${o}`);
      }
      if (p !== undefined) {
        diffLines.push(`+ ${p}`);
      }
    }
  }

  return diffLines.join('\n');
}

export class ChangeService {
  private storage: WorkspaceStorage;
  private changeStore: Map<string, ProposedChange> = new Map();

  constructor(storage: WorkspaceStorage) {
    this.storage = storage;
  }

  public async createProposedChange(params: {
    workspaceId: string;
    filePath: string;
    proposedBy: string;
    proposedContent: string;
    description?: string;
  }): Promise<ProposedChange> {
    const { workspaceId, filePath, proposedBy, proposedContent, description } = params;

    let originalContent = '';
    try {
      if (await this.storage.fileExists(filePath)) {
        originalContent = await this.storage.readFile(filePath);
      }
    } catch {
      originalContent = '';
    }

    const diff = computeLineDiff(originalContent, proposedContent);
    const id = crypto.randomUUID();

    const change: ProposedChange = {
      id,
      workspaceId,
      filePath,
      proposedBy,
      status: 'PENDING',
      originalContent,
      proposedContent,
      diff,
      description,
      createdAt: new Date()
    };

    this.changeStore.set(`${workspaceId}:${id}`, change);
    return change;
  }

  public async getProposedChange(
    workspaceId: string,
    changeId: string
  ): Promise<ProposedChange | null> {
    const change = this.changeStore.get(`${workspaceId}:${changeId}`);
    return change || null;
  }

  public async listProposedChanges(
    workspaceId: string,
    status?: 'PENDING' | 'APPROVED' | 'REJECTED'
  ): Promise<ProposedChange[]> {
    const list: ProposedChange[] = [];
    for (const [key, change] of this.changeStore.entries()) {
      if (change.workspaceId === workspaceId) {
        if (!status || change.status === status) {
          list.push(change);
        }
      }
    }
    return list;
  }

  public async approveChange(params: {
    workspaceId: string;
    changeId: string;
    reviewedBy: string;
  }): Promise<{ success: boolean; message: string }> {
    const { workspaceId, changeId, reviewedBy } = params;
    const change = await this.getProposedChange(workspaceId, changeId);

    if (!change) {
      throw new Error(`Proposed change "${changeId}" not found`);
    }

    if (change.status !== 'PENDING') {
      throw new Error(`Proposed change is already ${change.status}`);
    }

    // Apply change to workspace storage
    await this.storage.writeFile(change.filePath, change.proposedContent);

    // Update status
    change.status = 'APPROVED';
    change.reviewedBy = reviewedBy;
    change.reviewedAt = new Date();
    this.changeStore.set(`${workspaceId}:${changeId}`, change);

    return {
      success: true,
      message: `Change "${changeId}" approved and applied to "${change.filePath}"`
    };
  }

  public async rejectChange(params: {
    workspaceId: string;
    changeId: string;
    reviewedBy: string;
    reason?: string;
  }): Promise<{ success: boolean; message: string }> {
    const { workspaceId, changeId, reviewedBy, reason } = params;
    const change = await this.getProposedChange(workspaceId, changeId);

    if (!change) {
      throw new Error(`Proposed change "${changeId}" not found`);
    }

    if (change.status !== 'PENDING') {
      throw new Error(`Proposed change is already ${change.status}`);
    }

    change.status = 'REJECTED';
    change.reviewedBy = reviewedBy;
    change.reviewedAt = new Date();
    change.rejectionReason = reason;
    this.changeStore.set(`${workspaceId}:${changeId}`, change);

    return {
      success: true,
      message: `Change "${changeId}" rejected`
    };
  }
}
