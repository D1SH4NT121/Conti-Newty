import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { createApp } from '../src/api/app';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import {
  generateWorkspaceMcpToken,
  validateMcpToken,
  revokeMcpToken,
} from '../src/modules/mcp-server/mcp-auth';
import { createEntry } from '../src/modules/tribal-memory/tribal-memory';

describe('Phase 1: Company Brain MCP Server', () => {
  const testStorageDir = path.resolve(__dirname, 'test-mcp-workspaces');
  const app = createApp(testStorageDir);

  let orgId: string;
  let workspaceId: string;
  let userId: string;
  let mcpToken: string;
  let storage: WorkspaceStorage;

  beforeAll(async () => {
    if (!fs.existsSync(testStorageDir)) {
      fs.mkdirSync(testStorageDir, { recursive: true });
    }
  });

  afterAll(async () => {
    if (fs.existsSync(testStorageDir)) {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    }
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();

    const org = await prisma.organization.create({
      data: { name: `MCP Test Org ${Date.now()}` },
    });
    orgId = org.id;

    const user = await prisma.user.create({
      data: {
        email: `mcp-user-${Date.now()}@test.internal`,
        name: 'MCP User',
      },
    });
    userId = user.id;

    const ws = await prisma.workspace.create({
      data: {
        name: 'MCP Test Workspace',
        organizationId: orgId,
      },
    });
    workspaceId = ws.id;

    await prisma.workspaceMember.create({
      data: {
        workspaceId,
        userId,
        role: 'OWNER',
      },
    });

    storage = new WorkspaceStorage(workspaceId, path.join(testStorageDir, workspaceId));

    // Generate valid workspace MCP token
    const tokenRecord = await generateWorkspaceMcpToken(workspaceId, userId, 'Test MCP Key');
    mcpToken = tokenRecord.token;
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('1. MCP Token Issuance & Validation (CredentialVault Pattern)', () => {
    it('generates a formatted token and validates it via AES-256-GCM decrypt', async () => {
      expect(mcpToken).toMatch(/^cnty_mcp_[a-f0-9]{48}$/);

      const validated = await validateMcpToken(mcpToken, workspaceId);
      expect(validated).not.toBeNull();
      expect(validated?.workspaceId).toBe(workspaceId);
      expect(validated?.userId).toBe(userId);
    });

    it('rejects invalid or tampered tokens', async () => {
      const invalid = await validateMcpToken('cnty_mcp_invalidtoken12345', workspaceId);
      expect(invalid).toBeNull();

      const nonMcp = await validateMcpToken('some-other-token', workspaceId);
      expect(nonMcp).toBeNull();
    });

    it('rejects token when queried against wrong workspaceId', async () => {
      const wrong = await validateMcpToken(mcpToken, 'non-existent-ws-id');
      expect(wrong).toBeNull();
    });

    it('rejects revoked tokens', async () => {
      const tokens = await prisma.providerCredential.findMany({
        where: { workspaceId, provider: 'mcp' },
      });
      expect(tokens.length).toBe(1);

      await revokeMcpToken(tokens[0].id, workspaceId);
      const postRevoke = await validateMcpToken(mcpToken, workspaceId);
      expect(postRevoke).toBeNull();
    });
  });

  describe('2. MCP Protocol Handshake (initialize, tools/list)', () => {
    it('returns protocol version and capabilities on initialize', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/mcp`)
        .set('Authorization', `Bearer ${mcpToken}`)
        .send({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            clientInfo: { name: 'claude-code', version: '1.0.0' },
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.jsonrpc).toBe('2.0');
      expect(res.body.id).toBe(1);
      expect(res.body.result.protocolVersion).toBe('2024-11-05');
      expect(res.body.result.serverInfo.name).toBe('conti-newty-brain');
      expect(res.body.result.capabilities.tools).toBeDefined();
    });

    it('returns tools/list with the 4 required brain tools', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/mcp`)
        .set('Authorization', `Bearer ${mcpToken}`)
        .send({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        });

      expect(res.status).toBe(200);
      const tools = res.body.result.tools;
      expect(Array.isArray(tools)).toBe(true);

      const toolNames = tools.map((t: any) => t.name);
      expect(toolNames).toContain('search_brain');
      expect(toolNames).toContain('get_tribal_memory');
      expect(toolNames).toContain('list_recent_decisions');
      expect(toolNames).toContain('get_file');
    });

    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/mcp`)
        .send({
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/list',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('3. Tool Execution & Dual-Write Audit Trail', () => {
    it('executes get_tribal_memory with and without tag filtering', async () => {
      // Seed two tribal memory entries
      await createEntry({
        workspaceId,
        userId,
        title: 'Auth Architecture Guideline',
        content: 'Use JWT with AES-256-GCM token storage for all external APIs.',
        tags: ['architecture', 'security'],
      });

      await createEntry({
        workspaceId,
        userId,
        title: 'Q3 Product Strategy Decision',
        content: 'Focus Company Brain on live continuous ingestion and MCP exposure.',
        tags: ['decision', 'strategy'],
      });

      // 1. Fetch all tribal memory
      const allRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/mcp`)
        .set('Authorization', `Bearer ${mcpToken}`)
        .send({
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: {
            name: 'get_tribal_memory',
            arguments: {},
          },
        });

      expect(allRes.status).toBe(200);
      const allData = JSON.parse(allRes.body.result.content[0].text);
      expect(allData.total).toBe(2);

      // 2. Fetch tribal memory filtered by tag "architecture"
      const filteredRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/mcp`)
        .set('Authorization', `Bearer ${mcpToken}`)
        .send({
          jsonrpc: '2.0',
          id: 11,
          method: 'tools/call',
          params: {
            name: 'get_tribal_memory',
            arguments: { tag: 'architecture' },
          },
        });

      expect(filteredRes.status).toBe(200);
      const filteredData = JSON.parse(filteredRes.body.result.content[0].text);
      expect(filteredData.total).toBe(1);
      expect(filteredData.entries[0].title).toBe('Auth Architecture Guideline');

      // 3. Verify ToolExecution and AuditLog records were created
      const toolExecs = await prisma.toolExecution.findMany({
        where: { workspaceId, toolName: 'mcp_get_tribal_memory' },
      });
      expect(toolExecs.length).toBe(2);
      expect(toolExecs[0].status).toBe('SUCCESS');
      expect(toolExecs[0].allowed).toBe(true);

      const auditLogs = await prisma.auditLog.findMany({
        where: { workspaceId, action: 'MCP_GET_TRIBAL_MEMORY' },
      });
      expect(auditLogs.length).toBe(2);
    });

    it('executes list_recent_decisions filtered by tag decision and date since', async () => {
      await createEntry({
        workspaceId,
        userId,
        title: 'Decision A: Adopt PostgreSQL',
        content: 'Postgres selected as primary relational store.',
        tags: ['decision'],
      });

      await createEntry({
        workspaceId,
        userId,
        title: 'Guideline B: Code formatting',
        content: 'Run Prettier before committing.',
        tags: ['guideline'],
      });

      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/mcp`)
        .set('Authorization', `Bearer ${mcpToken}`)
        .send({
          jsonrpc: '2.0',
          id: 20,
          method: 'tools/call',
          params: {
            name: 'list_recent_decisions',
            arguments: {},
          },
        });

      expect(res.status).toBe(200);
      const data = JSON.parse(res.body.result.content[0].text);
      expect(data.total).toBe(1);
      expect(data.decisions[0].title).toBe('Decision A: Adopt PostgreSQL');
    });

    it('executes search_brain across both files and Tribal Memory', async () => {
      // Create file in storage
      await storage.writeFile('docs/architecture.md', '# System Architecture\nMicroservices and event streams.');
      await storage.writeFile('src/auth.ts', '// Authentication logic\nexport const AUTH_ENABLED = true;');

      // Create tribal memory
      await createEntry({
        workspaceId,
        userId,
        title: 'Architecture Overview Note',
        content: 'High-level architecture documentation for Conti-Newty.',
        tags: ['architecture'],
      });

      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/mcp`)
        .set('Authorization', `Bearer ${mcpToken}`)
        .send({
          jsonrpc: '2.0',
          id: 30,
          method: 'tools/call',
          params: {
            name: 'search_brain',
            arguments: { query: 'Architecture' },
          },
        });

      expect(res.status).toBe(200);
      const data = JSON.parse(res.body.result.content[0].text);
      expect(data.files.length).toBeGreaterThanOrEqual(1);
      expect(data.files.some((f: any) => f.filePath === 'docs/architecture.md')).toBe(true);
      expect(data.tribalMemory.length).toBe(1);
      expect(data.tribalMemory[0].title).toBe('Architecture Overview Note');

      // Check audit logs
      const audit = await prisma.auditLog.findFirst({
        where: { workspaceId, action: 'MCP_SEARCH_BRAIN' },
      });
      expect(audit).not.toBeNull();
    });

    it('executes get_file with path boundary protection', async () => {
      await storage.writeFile('readme.txt', 'Hello Company Brain from MCP!');

      // Valid read
      const res = await request(app)
        .post(`/api/workspaces/${workspaceId}/mcp`)
        .set('Authorization', `Bearer ${mcpToken}`)
        .send({
          jsonrpc: '2.0',
          id: 40,
          method: 'tools/call',
          params: {
            name: 'get_file',
            arguments: { path: 'readme.txt' },
          },
        });

      expect(res.status).toBe(200);
      const data = JSON.parse(res.body.result.content[0].text);
      expect(data.content).toBe('Hello Company Brain from MCP!');

      // Attempt directory traversal outside workspace
      const traverseRes = await request(app)
        .post(`/api/workspaces/${workspaceId}/mcp`)
        .set('Authorization', `Bearer ${mcpToken}`)
        .send({
          jsonrpc: '2.0',
          id: 41,
          method: 'tools/call',
          params: {
            name: 'get_file',
            arguments: { path: '../../package.json' },
          },
        });

      expect(traverseRes.status).toBe(200);
      expect(traverseRes.body.result.isError).toBe(true);

      // Verify failure was logged in ToolExecution and AuditLog
      const failedExec = await prisma.toolExecution.findFirst({
        where: { workspaceId, toolName: 'mcp_get_file', status: 'FAILURE' },
      });
      expect(failedExec).not.toBeNull();
    });
  });

  describe('4. Settings Configuration Endpoint', () => {
    it('returns configuration snippets for Claude Code and Cursor', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}/mcp/config`)
        .set('x-user-id', userId);

      expect(res.status).toBe(200);
      expect(res.body.endpointUrl).toContain(`/api/workspaces/${workspaceId}/mcp`);
      expect(res.body.claudeCodeCommand).toContain('claude mcp add');
      expect(res.body.cursorConfig.mcpServers).toBeDefined();
    });
  });
});
