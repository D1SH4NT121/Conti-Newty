import request from 'supertest';
import { createApp } from '../src/api/app';
import { prisma } from '../src/db/client';
import { AuthService } from '../src/modules/auth/auth-service';
import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';

describe('Full PRD Functional Verification Test Suite', () => {
  const authService = new AuthService();
  const testStorageDir = path.resolve(__dirname, 'scratch', 'prd-features-' + Date.now());
  const app = createApp(testStorageDir);

  let adminToken: string;
  let testOrgId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Create test organization and admin user
    const org = await prisma.organization.create({
      data: { name: 'PRD Test Organization', description: 'Testing full functional scope' }
    });
    testOrgId = org.id;

    const user = await prisma.user.create({
      data: {
        email: `founder-${Date.now()}@edubaware.io`,
        name: 'Founder / Admin',
        passwordHash: authService.hashPassword('FounderPass123!'),
        role: 'ADMIN',
        organizationId: testOrgId
      }
    });
    adminUserId = user.id;

    await prisma.membership.create({
      data: { userId: user.id, organizationId: testOrgId, role: 'OWNER' }
    });

    adminToken = authService.generateToken({ userId: user.id, email: user.email });
  });

  afterAll(async () => {
    if (fs.existsSync(testStorageDir)) {
      await fs.promises.rm(testStorageDir, { recursive: true, force: true });
    }
  });

  describe('F1 & 5.1: Workbench Creation with ICM Template', () => {
    it('should create a new workbench and seed the founder ICM folder structure', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Acme Operations Brain',
          description: 'ICM folder workbench for Chicago logistics',
          organizationId: testOrgId,
          template: 'icm'
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeTruthy();
      const workspaceId = res.body.id;

      // Verify files in seeded ICM workspace
      const filesRes = await request(app)
        .get(`/api/workspaces/${workspaceId}/files`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(filesRes.status).toBe(200);
      const filePaths = filesRes.body.files.map((f: any) => f.name);
      expect(filePaths).toContain('prompts');
      expect(filePaths).toContain('docs');
      expect(filePaths).toContain('sops');
      expect(filePaths).toContain('notes');

      // Verify files inside prompts/
      const promptsRes = await request(app)
        .get(`/api/workspaces/${workspaceId}/files/prompts`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(promptsRes.status).toBe(200);
      const promptFiles = promptsRes.body.files.map((f: any) => f.name);
      expect(promptFiles).toContain('query_harness.md');

      // Verify file content directly
      const fileContentRes = await request(app)
        .get(`/api/workspaces/${workspaceId}/files/docs/company_overview.md`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(fileContentRes.status).toBe(200);
      expect(fileContentRes.body.content).toContain('Company Brain');
    });
  });

  describe('F9: In-Browser Download & Archive Export', () => {
    let workspaceId: string;

    beforeAll(async () => {
      const wsRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Export Test Workspace',
          organizationId: testOrgId,
          template: 'icm'
        });
      workspaceId = wsRes.body.id;
    });

    it('should download single file as text attachment with ?download=true', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/files/docs/company_overview.md?download=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('attachment; filename="company_overview.md"');
      expect(res.text).toContain('Company Brain');
    });

    it('should export the entire workbench as a downloadable ZIP archive', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/download`)
        .set('Authorization', `Bearer ${adminToken}`)
        .responseType('blob');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/zip');
      expect(res.headers['content-disposition']).toContain('.zip');

      const zip = new AdmZip(res.body);
      const entryNames = zip.getEntries().map((e) => e.entryName.replace(/\\/g, '/'));
      expect(entryNames).toContain('docs/company_overview.md');
      expect(entryNames).toContain('notes/high_tea_sessions.md');
    });
  });

  describe('F1: Ingest Existing Folder / ZIP Archive into Workbench', () => {
    it('should upload a ZIP archive into a workspace', async () => {
      const wsRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Archive Import Target',
          organizationId: testOrgId
        });
      const targetWorkspaceId = wsRes.body.id;

      // Build zip archive
      const zip = new AdmZip();
      zip.addFile('notes/imported-notes.md', Buffer.from('# Imported Notes\nContent from external archive.'));
      const zipBase64 = zip.toBuffer().toString('base64');

      const uploadRes = await request(app)
        .post(`/api/workspaces/${targetWorkspaceId}/upload`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ zipBase64 });

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.success).toBe(true);
      expect(uploadRes.body.importedCount).toBe(1);

      // Verify file exists
      const fileRes = await request(app)
        .get(`/api/workspaces/${targetWorkspaceId}/files/notes/imported-notes.md`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(fileRes.status).toBe(200);
      expect(fileRes.body.content).toContain('Content from external archive.');
    });
  });

  describe('F10: Data Anonymization for External Sharing', () => {
    let workspaceId: string;

    beforeAll(async () => {
      const wsRes = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Anonymization Workspace',
          organizationId: testOrgId,
          template: 'icm'
        });
      workspaceId = wsRes.body.id;
    });

    it('should sanitize confidential partner names and financial metrics from text', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/anonymize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'Client meeting with Pioneer Ventures: Agreed to $2.5M investment. Contact ceo@pioneer.vc',
          customEntities: ['Pioneer Ventures']
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.sanitizedText).not.toContain('Pioneer Ventures');
      expect(res.body.sanitizedText).not.toContain('$2.5M');
      expect(res.body.sanitizedText).not.toContain('ceo@pioneer.vc');
      expect(res.body.sanitizedText).toContain('[CONFIDENTIAL_PARTNER]');
      expect(res.body.sanitizedText).toContain('[FINANCIAL_METRIC]');
      expect(res.body.sanitizedText).toContain('[CONTACT_EMAIL_1]');
    });

    it('should sanitize existing workspace files directly by filePath', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/anonymize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          filePath: 'docs/fundraising_status.md'
        });

      expect(res.status).toBe(200);
      expect(res.body.sanitizedText).not.toContain('$2.5M');
      expect(res.body.sanitizedText).toContain('[FINANCIAL_METRIC]');
      expect(res.body.totalRedactions).toBeGreaterThan(0);
    });
  });

  describe('F6 & F11: Multi-Workbench & Bulk Organization Invites', () => {
    it('should bulk invite members to an organization', async () => {
      const res = await request(app)
        .post(`/api/orgs/${testOrgId}/invites`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          invites: [
            { email: `client1-${Date.now()}@acme.com`, name: 'Client Alice', role: 'VIEWER' },
            { email: `contractor-${Date.now()}@agency.com`, name: 'Contractor Bob', role: 'MEMBER' }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.invitedCount).toBe(2);
    });

    it('should list all members of an organization', async () => {
      const res = await request(app)
        .get(`/api/orgs/${testOrgId}/members`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });

    it('should list all workbenches under an organization (multi-workbench)', async () => {
      const res = await request(app)
        .get(`/api/orgs/${testOrgId}/workspaces`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
    });
  });
});
