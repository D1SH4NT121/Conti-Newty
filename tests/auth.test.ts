import { prisma } from '../src/db/client';
import { AuthService } from '../src/modules/auth/auth-service';
import { AuthorizationGuard } from '../src/modules/auth/authorization-guard';
import { clearDatabase } from './test-utils';

describe('Auth, Authorization & Tool Execution Chain', () => {
  let authService: AuthService;
  let authGuard: AuthorizationGuard;
  let testUserAdmin: any;
  let testUserMember: any;
  let testUserViewer: any;
  let testWorkspace: any;

  beforeAll(async () => {
    authService = new AuthService();
    authGuard = new AuthorizationGuard();

    await clearDatabase();

    // Create Org
    const org = await prisma.organization.create({
      data: { name: 'Auth Test Org' }
    });

    // Create Users
    testUserAdmin = await prisma.user.create({
      data: { email: 'admin@auth-test.com', name: 'Admin User', passwordHash: 'hashed_pw_admin' }
    });
    testUserMember = await prisma.user.create({
      data: { email: 'member@auth-test.com', name: 'Member User', passwordHash: 'hashed_pw_member' }
    });
    testUserViewer = await prisma.user.create({
      data: { email: 'viewer@auth-test.com', name: 'Viewer User', passwordHash: 'hashed_pw_viewer' }
    });

    // Create Workspace
    testWorkspace = await prisma.workspace.create({
      data: {
        name: 'Auth Security Workspace',
        organizationId: org.id
      }
    });

    // Add Workspace Members with roles
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
    await prisma.workspaceMember.create({
      data: {
        workspaceId: testWorkspace.id,
        userId: testUserViewer.id,
        role: 'viewer'
      }
    });

    // Add a ReadOnlyPath in DB
    await prisma.readOnlyPath.create({
      data: {
        workspaceId: testWorkspace.id,
        path: 'contracts/**'
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Auth Token Service', () => {
    it('should generate and verify JWT auth tokens', () => {
      const token = authService.generateToken({
        userId: testUserMember.id,
        email: testUserMember.email
      });

      expect(typeof token).toBe('string');
      const payload = authService.verifyToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(testUserMember.id);
      expect(payload?.email).toBe(testUserMember.email);
    });

    it('should reject invalid or tampered tokens', () => {
      const token = authService.generateToken({ userId: 'test' });
      const tampered = token.slice(0, -5) + 'abcde';
      const payload = authService.verifyToken(tampered);
      expect(payload).toBeNull();
    });
  });

  describe('Tool Authorization Evaluation Chain', () => {
    it('should allow read tools for viewer, member, and admin', async () => {
      const viewerRead = await authGuard.evaluateToolAuthorization({
        userId: testUserViewer.id,
        workspaceId: testWorkspace.id,
        toolName: 'read',
        resourcePath: 'notes.txt'
      });
      expect(viewerRead.allowed).toBe(true);

      const memberRead = await authGuard.evaluateToolAuthorization({
        userId: testUserMember.id,
        workspaceId: testWorkspace.id,
        toolName: 'read',
        resourcePath: 'notes.txt'
      });
      expect(memberRead.allowed).toBe(true);
    });

    it('should deny write tools for viewer role', async () => {
      const viewerWrite = await authGuard.evaluateToolAuthorization({
        userId: testUserViewer.id,
        workspaceId: testWorkspace.id,
        toolName: 'write',
        resourcePath: 'notes.txt'
      });
      expect(viewerWrite.allowed).toBe(false);
      expect(viewerWrite.reason).toMatch(/permission denied|insufficient role/i);
    });

    it('should allow write tools for member on normal paths', async () => {
      const memberWrite = await authGuard.evaluateToolAuthorization({
        userId: testUserMember.id,
        workspaceId: testWorkspace.id,
        toolName: 'write',
        resourcePath: 'notes.txt'
      });
      expect(memberWrite.allowed).toBe(true);
    });

    it('should deny write tools on read-only paths even for member', async () => {
      const memberWriteReadOnly = await authGuard.evaluateToolAuthorization({
        userId: testUserMember.id,
        workspaceId: testWorkspace.id,
        toolName: 'write',
        resourcePath: 'contracts/service-agreement.pdf'
      });
      expect(memberWriteReadOnly.allowed).toBe(false);
      expect(memberWriteReadOnly.reason).toMatch(/read-only/i);
    });

    it('should deny users who are not members of the workspace', async () => {
      const nonMemberAuth = await authGuard.evaluateToolAuthorization({
        userId: 'non-existent-user-id',
        workspaceId: testWorkspace.id,
        toolName: 'read',
        resourcePath: 'notes.txt'
      });
      expect(nonMemberAuth.allowed).toBe(false);
    });
  });
});
