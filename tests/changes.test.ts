import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { ChangeService } from '../src/modules/changes/change-service';

describe('Change Review & Server-Side Approval Engine', () => {
  const testWorkspaceDir = path.resolve(process.cwd(), 'test-changes-workspace');
  let storage: WorkspaceStorage;
  let changeService: ChangeService;
  let testUserAdmin: any;
  let testUserMember: any;
  let testWorkspace: any;

  beforeAll(async () => {
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testWorkspaceDir, { recursive: true });

    await clearDatabase();

    const org = await prisma.organization.create({
      data: { name: 'Change Test Org' }
    });

    testUserAdmin = await prisma.user.create({
      data: {
        email: 'admin@changes.com',
        name: 'Admin Reviewer',
        passwordHash: 'hash123'
      }
    });

    testUserMember = await prisma.user.create({
      data: {
        email: 'member@changes.com',
        name: 'Member Proposer',
        passwordHash: 'hash123'
      }
    });

    testWorkspace = await prisma.workspace.create({
      data: {
        name: 'Change Review Workspace',
        organizationId: org.id
      }
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: testWorkspace.id,
        userId: testUserAdmin.id,
        role: 'admin'
      }
    });

    await prisma.workspaceMember.create({
      data: {
        workspaceId: testWorkspace.id,
        userId: testUserMember.id,
        role: 'member'
      }
    });

    storage = new WorkspaceStorage(testWorkspace.id, testWorkspaceDir);
    changeService = new ChangeService(storage);

    // Initial file setup
    await storage.createFile('config.json', '{\n  "version": "1.0.0",\n  "env": "staging"\n}');
  });

  afterAll(async () => {
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
    await clearDatabase();
    await prisma.$disconnect();
  });

  describe('Proposal Creation & Diff Generation', () => {
    it('should create a proposed change with unified diff', async () => {
      const proposal = await changeService.createProposedChange({
        workspaceId: testWorkspace.id,
        filePath: 'config.json',
        proposedBy: testUserMember.id,
        proposedContent: '{\n  "version": "2.0.0",\n  "env": "production"\n}',
        description: 'Upgrade version and environment'
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.status).toBe('PENDING');
      expect(proposal.originalContent).toContain('1.0.0');
      expect(proposal.proposedContent).toContain('2.0.0');
      expect(proposal.diff).toContain('-   "version": "1.0.0"');
      expect(proposal.diff).toContain('+   "version": "2.0.0"');
    });
  });

  describe('Approval Workflow', () => {
    it('should apply approved changes to the workspace file', async () => {
      const proposal = await changeService.createProposedChange({
        workspaceId: testWorkspace.id,
        filePath: 'config.json',
        proposedBy: 'ai-agent',
        proposedContent: '{\n  "version": "2.1.0",\n  "env": "production"\n}',
        description: 'AI recommended patch'
      });

      // Before approval, file content should still be version 1.0.0
      expect(await storage.readFile('config.json')).toContain('1.0.0');

      const approval = await changeService.approveChange({
        workspaceId: testWorkspace.id,
        changeId: proposal.id,
        reviewedBy: testUserAdmin.id
      });

      expect(approval.success).toBe(true);

      // After approval, file content must be updated on disk
      const updatedContent = await storage.readFile('config.json');
      expect(updatedContent).toContain('2.1.0');

      // Proposal status is APPROVED
      const fetched = await changeService.getProposedChange(testWorkspace.id, proposal.id);
      expect(fetched?.status).toBe('APPROVED');
      expect(fetched?.reviewedBy).toBe(testUserAdmin.id);
    });

    it('should handle rejected changes without modifying files', async () => {
      const contentBefore = await storage.readFile('config.json');

      const proposal = await changeService.createProposedChange({
        workspaceId: testWorkspace.id,
        filePath: 'config.json',
        proposedBy: 'ai-agent',
        proposedContent: '{"danger": true}',
        description: 'Malicious or broken patch'
      });

      const rejection = await changeService.rejectChange({
        workspaceId: testWorkspace.id,
        changeId: proposal.id,
        reviewedBy: testUserAdmin.id,
        reason: 'Broken format'
      });

      expect(rejection.success).toBe(true);

      // Disk content remains unchanged
      const contentAfter = await storage.readFile('config.json');
      expect(contentAfter).toBe(contentBefore);

      const fetched = await changeService.getProposedChange(testWorkspace.id, proposal.id);
      expect(fetched?.status).toBe('REJECTED');
      expect(fetched?.rejectionReason).toBe('Broken format');
    });
  });
});
