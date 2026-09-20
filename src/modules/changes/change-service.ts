import { WorkspaceStorage } from '../storage/workspace-storage';
import { prisma } from '../../db/client';

import { ProposedChange as PrismaProposedChange } from '@prisma/client';

export type ProposedChange = PrismaProposedChange;

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
    let proposerId = proposedBy;
    const proposer = await prisma.user.findUnique({ where: { id: proposedBy } });
    if (!proposer) {
      const systemProposer = await prisma.user.upsert({
        where: { email: 'ai-agent@system.local' },
        update: {},
        create: {
          email: 'ai-agent@system.local',
          name: 'AI Agent',
          passwordHash: null
        }
      });
      proposerId = systemProposer.id;
    }
    const change = await prisma.proposedChange.create({
      data: {
        workspaceId,
        filePath,
        proposedBy: proposerId,
        status: 'PENDING',
        originalContent,
        proposedContent,
        diff,
        description,
      }
    });

    return change;
  }

  public async getProposedChange(
    workspaceId: string,
    changeId: string
  ): Promise<ProposedChange | null> {
    const change = await prisma.proposedChange.findUnique({
      where: { id: changeId }
    });
    if (change && change.workspaceId === workspaceId) {
      return change;
    }
    return null;
  }

  public async listProposedChanges(
    workspaceId: string,
    status?: 'PENDING' | 'APPROVED' | 'REJECTED'
  ): Promise<ProposedChange[]> {
    const whereClause: any = { workspaceId };
    if (status) {
      whereClause.status = status;
    }
    return prisma.proposedChange.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
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

    await prisma.proposedChange.update({
      where: { id: changeId },
      data: {
        status: 'APPROVED',
        reviewedBy,
        reviewedAt: new Date()
      }
    });

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

    await prisma.proposedChange.update({
      where: { id: changeId },
      data: {
        status: 'REJECTED',
        reviewedBy,
        reviewedAt: new Date(),
        rejectionReason: reason
      }
    });

    return {
      success: true,
      message: `Change "${changeId}" rejected`
    };
  }
}
