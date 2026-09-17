import { prisma } from '../src/db/client';
import { CredentialVault } from '../src/modules/auth/credential-vault';
import { CredentialService } from '../src/modules/auth/credential-service';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { TribalMemoryConnector } from '../src/modules/connectors/connector-services';
import { ICM_TEMPLATE_REGISTRY, seedIcmTemplateById } from '../src/modules/storage/icm-registry';
import request from 'supertest';
import { createApp } from '../src/api/app';
import { AuthService } from '../src/modules/auth/auth-service';
import path from 'path';
import fs from 'fs';

describe('New Features: Credential Vault, Connectors, ICM Registry, BYOK API', () => {
  let app: any;
  let userToken: string;
  let userId: string;
  let orgId: string;
  let workspaceId: string;
  let customStorageDir: string;
  const authService = new AuthService();

  beforeAll(async () => {
    customStorageDir = path.join(process.cwd(), 'tmp-test-new-features');
    if (!fs.existsSync(customStorageDir)) {
      fs.mkdirSync(customStorageDir, { recursive: true });
    }
    app = createApp(customStorageDir);

    const org = await prisma.organization.create({ data: { name: 'New Features Test Org' } });
    orgId = org.id;

    const user = await prisma.user.create({
      data: { email: `newfeatures-${Date.now()}@test.internal`, name: 'Test User', passwordHash: 'hash' }
    });
    userId = user.id;
    userToken = authService.generateToken({ userId: user.id, email: user.email, name: user.name });

    const ws = await prisma.workspace.create({
      data: { name: 'New Features Workspace', organizationId: orgId }
    });
    workspaceId = ws.id;

    await prisma.workspaceMember.create({
      data: { workspaceId, userId, role: 'admin' }
    });
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(customStorageDir)) {
        fs.rmSync(customStorageDir, { recursive: true, force: true });
      }
      await prisma.connectorSync.deleteMany({ where: { workspaceId } });
      await prisma.providerCredential.deleteMany({ where: { userId } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId } });
      await prisma.workspace.deleteMany({ where: { id: workspaceId } });
      await prisma.organization.deleteMany({ where: { id: orgId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    } catch {}
  });

  // ============= Credential Vault =============
  describe('Credential Vault (AES-256-GCM)', () => {
    it('1. encrypts and decrypts a secret correctly', () => {
      const secret = 'sk-test-anthropic-key-abc123';
      const encrypted = CredentialVault.encrypt(secret);

      // Encrypted format is iv:cipher:tag
      expect(encrypted.split(':').length).toBe(3);
      expect(encrypted).not.toContain(secret);

      const decrypted = CredentialVault.decrypt(encrypted);
      expect(decrypted).toBe(secret);
    });

    it('2. different encryptions of same secret produce different ciphertexts (random IV)', () => {
      const secret = 'sk-test-key-same';
      const enc1 = CredentialVault.encrypt(secret);
      const enc2 = CredentialVault.encrypt(secret);
      expect(enc1).not.toBe(enc2);
      expect(CredentialVault.decrypt(enc1)).toBe(secret);
      expect(CredentialVault.decrypt(enc2)).toBe(secret);
    });

    it('3. tampered ciphertext fails to decrypt', () => {
      const secret = 'sk-tamper-test';
      const encrypted = CredentialVault.encrypt(secret);
      // Flip a character in the cipher portion
      const parts = encrypted.split(':');
      parts[1] = parts[1].substring(0, parts[1].length - 2) + 'ff';
      const tampered = parts.join(':');

      expect(() => CredentialVault.decrypt(tampered)).toThrow();
    });
  });

  // ============= Credential API =============
  describe('BYOK Credential API', () => {
    let credentialId: string;

    it('4. POST /api/credentials stores a BYOK credential and returns metadata (no secret)', async () => {
      const res = await request(app)
        .post('/api/credentials')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'claude', secret: 'sk-ant-test-key-12345', label: 'My Claude Key' });

      expect(res.status).toBe(201);
      expect(res.body.provider).toBe('claude');
      expect(res.body.label).toBe('My Claude Key');
      expect(res.body.id).toBeDefined();
      expect(res.body.secretEnc).toBeUndefined(); // secret not exposed
      credentialId = res.body.id;
    });

    it('5. GET /api/credentials lists stored credentials (masked)', async () => {
      const res = await request(app)
        .get('/api/credentials')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const cred = res.body.find((c: any) => c.id === credentialId);
      expect(cred).toBeDefined();
      expect(cred.secretEnc).toBeUndefined();
    });

    it('6. CredentialService resolves the stored BYOK key for the user', async () => {
      const key = await CredentialService.resolveApiKey('claude', userId);
      expect(key).toBe('sk-ant-test-key-12345');
    });

    it('7. DELETE /api/credentials/:id revokes the credential', async () => {
      const res = await request(app)
        .delete(`/api/credentials/${credentialId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // After revoke, service should NOT return the key
      const key = await CredentialService.resolveApiKey('claude', userId);
      // Falls back to env var (which is empty in test)
      expect(key).not.toBe('sk-ant-test-key-12345');
    });
  });

  // ============= Tribal Memory Connector =============
  describe('Tribal Memory Connector', () => {
    it('8. ingests tribal memory entries into workspace storage', async () => {
      const storage = new WorkspaceStorage(workspaceId, path.join(customStorageDir, workspaceId));
      const result = await TribalMemoryConnector.ingest(storage, {
        entries: [
          { title: 'Why We Chose Single-Agent', content: 'Multi-agent pipelines fail in production due to latency.', author: 'CTO', tags: ['architecture', 'decision'] },
          { title: 'Chicago Pilot Learnings', content: 'Dispatchers prefer natural language over dashboards.', author: 'PM' }
        ]
      });

      expect(result.status).toBe('COMPLETED');
      expect(result.fileCount).toBe(2);
      expect(result.connector).toBe('tribal');
      expect(result.files.length).toBe(2);

      // Verify files exist on disk
      const file1 = await storage.readFile(result.files[0]);
      expect(file1).toContain('Why We Chose Single-Agent');
      expect(file1).toContain('CTO');
    });

    it('9. POST /api/workspaces/:id/connectors/tribal/sync records a ConnectorSync row', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/connectors/tribal/sync`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          entries: [
            { title: 'API Test Entry', content: 'Testing via HTTP endpoint', tags: ['test'] }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.connector).toBe('tribal');
      expect(res.body.fileCount).toBe(1);
      expect(res.body.status).toBe('COMPLETED');

      // Check DB record
      const syncs = await prisma.connectorSync.findMany({
        where: { workspaceId, connector: 'tribal' }
      });
      expect(syncs.length).toBeGreaterThanOrEqual(1);
    });

    it('10. GET /api/workspaces/:id/connectors lists sync history', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/connectors`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].connector).toBeDefined();
    });
  });

  // ============= ICM Registry =============
  describe('ICM Template Registry & API', () => {
    it('11. registry contains at least 4 templates (founder, agency-client, operations-playbook, minimal)', () => {
      expect(ICM_TEMPLATE_REGISTRY.length).toBeGreaterThanOrEqual(4);
      const ids = ICM_TEMPLATE_REGISTRY.map(t => t.id);
      expect(ids).toContain('founder');
      expect(ids).toContain('agency-client');
      expect(ids).toContain('operations-playbook');
      expect(ids).toContain('minimal');
    });

    it('12. seedIcmTemplateById writes real files for agency-client template', async () => {
      const storage = new WorkspaceStorage(`icm-test-${Date.now()}`, path.join(customStorageDir, `icm-test-${Date.now()}`));
      const files = await seedIcmTemplateById(storage, 'agency-client');

      expect(files).not.toBeNull();
      expect(files!.length).toBeGreaterThanOrEqual(4);
      expect(files).toContain('sops/client-onboarding.md');

      const content = await storage.readFile('sops/client-onboarding.md');
      expect(content).toContain('Client Onboarding');

      // Cleanup
      fs.rmSync(storage.workspaceRoot, { recursive: true, force: true });
    });

    it('13. GET /api/icm/templates returns all registered templates', async () => {
      const res = await request(app)
        .get('/api/icm/templates')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(4);
      expect(res.body[0].id).toBeDefined();
      expect(res.body[0].name).toBeDefined();
      expect(res.body[0].fileCount).toBeGreaterThanOrEqual(1);
    });

    it('14. POST /api/icm/apply seeds an operations-playbook template into a workspace', async () => {
      const res = await request(app)
        .post('/api/icm/apply')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ workspaceId, templateId: 'operations-playbook' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.templateId).toBe('operations-playbook');
      expect(res.body.fileCount).toBeGreaterThanOrEqual(4);
    });
  });

  // ============= Connector validation (Drive/Jira/Slack missing tokens) =============
  describe('Connector error handling', () => {
    it('15. Drive sync returns 400 without accessToken', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/connectors/drive/sync`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('16. Jira sync returns 400 without baseUrl/email/apiToken', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/connectors/jira/sync`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('17. Slack sync returns 400 without botToken/channelIds', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/connectors/slack/sync`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('18. Tribal sync returns 400 without entries', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/connectors/tribal/sync`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });
});
