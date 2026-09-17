import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/client';
import { AppGeneratorService } from '../src/modules/app-generator/generator-service';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';

describe('Pillar 3.4: Substantive Brain-to-App Context Transfer', () => {
  let testOrg: any;
  let testWorkspace: any;
  let userId: string;
  let customStorageDir: string;
  let storage: WorkspaceStorage;
  let service: AppGeneratorService;

  beforeAll(async () => {
    customStorageDir = path.join(process.cwd(), 'tmp-test-storage-pillar3-context');
    if (!fs.existsSync(customStorageDir)) {
      fs.mkdirSync(customStorageDir, { recursive: true });
    }

    const user = await prisma.user.create({
      data: {
        email: `pillar3-ctx-${Date.now()}@continewty.internal`,
        name: 'Context Test User',
        passwordHash: 'hash'
      }
    });
    userId = user.id;

    testOrg = await prisma.organization.create({
      data: { name: 'Pillar 3 Context Org' }
    });

    testWorkspace = await prisma.workspace.create({
      data: {
        name: 'Pillar 3 Context Workspace',
        organizationId: testOrg.id
      }
    });

    await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: testWorkspace.id,
        role: 'OWNER'
      }
    });

    const wsDir = path.join(customStorageDir, testWorkspace.id);
    storage = new WorkspaceStorage(testWorkspace.id, wsDir);
    service = new AppGeneratorService(storage);

    // Seed domain knowledge files into workspace storage
    await storage.writeFile(
      '01-pricing-policy.md',
      '# Logistics Pricing Policy\nexpress_carrier_rate: weight_kg * 2.45 + 18.00\nescalation_sla_minutes: 15\nprimary_fulfillment_hub: Frankfurt-Enclave-P0\n'
    );

    await storage.writeFile(
      'metrics.json',
      JSON.stringify({
        quarterly_burn_rate_usd: 145000,
        runway_months: 18,
        net_retention_target_pct: 128
      })
    );
  });

  afterAll(async () => {
    try {
      if (fs.existsSync(customStorageDir)) {
        fs.rmSync(customStorageDir, { recursive: true, force: true });
      }
      await prisma.appDeployment.deleteMany({ where: { appWorkspace: { workspaceId: testWorkspace?.id } } });
      await prisma.appWorkspace.deleteMany({ where: { workspaceId: testWorkspace?.id } });
      await prisma.workspaceMember.deleteMany({ where: { workspaceId: testWorkspace?.id } });
      await prisma.workspace.deleteMany({ where: { id: testWorkspace?.id } });
      await prisma.organization.deleteMany({ where: { id: testOrg?.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
    } catch {}
  });

  test('1. AppGeneratorService extracts substantive domain rules and formulas from workspace files and embeds into generated app', async () => {
    const result = await service.generateAppFromKnowledge({
      workspaceId: testWorkspace.id,
      userId,
      prompt: 'Build executive logistics dashboard with live pricing formulas',
      appType: 'dashboard',
      appName: 'Logistics SLA & Pricing Portal'
    });

    expect(result).toBeDefined();
    expect(result.appWorkspaceId).toBeDefined();
    expect(result.files['index.html']).toBeDefined();
    expect(result.files['app.js']).toBeDefined();

    const html = result.files['index.html'];
    const js = result.files['app.js'];

    // Assert substantive domain context transfer occurred
    expect(html).toContain('express_carrier_rate');
    expect(html).toContain('weight_kg * 2.45 + 18.00');
    expect(html).toContain('Frankfurt-Enclave-P0');
    expect(html).toContain('quarterly_burn_rate_usd');
    expect(html).toContain('145000');
    expect(html).toContain('net_retention_target_pct');

    expect(js).toContain('express_carrier_rate');
    expect(js).toContain('Logistics SLA & Pricing Portal');
  });
});
