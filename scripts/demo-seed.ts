import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/client';
import { AuthService } from '../src/modules/auth/auth-service';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';

async function seedDemoData() {
  console.log('--- Seeding Workbench Demo Environment ---');
  const authService = new AuthService();

  // 1. Organization
  let org = await prisma.organization.findFirst({
    where: { name: 'Acme AI Systems' }
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: 'Acme AI Systems',
        description: 'Enterprise AI Knowledge and Multiplayer Workspace'
      }
    });
  }

  // 2. Admin User
  let admin = await prisma.user.findUnique({
    where: { email: 'admin@acme.ai' }
  });

  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: 'admin@acme.ai',
        name: 'Alex Rivera (Lead Architect)',
        passwordHash: authService.hashPassword('admin12345'),
        role: 'ADMIN',
        organizationId: org.id
      }
    });
  }

  // 3. Member User
  let member = await prisma.user.findUnique({
    where: { email: 'sarah@acme.ai' }
  });

  if (!member) {
    member = await prisma.user.create({
      data: {
        email: 'sarah@acme.ai',
        name: 'Sarah Chen (Senior Engineer)',
        passwordHash: authService.hashPassword('member12345'),
        role: 'USER',
        organizationId: org.id
      }
    });
  }

  // 4. Primary Workspace
  let ws = await prisma.workspace.findFirst({
    where: { name: 'Company Core Brain' }
  });

  if (!ws) {
    ws = await prisma.workspace.create({
      data: {
        name: 'Company Core Brain',
        description: 'Central intelligence repository, SOPs, multiplayer discussions, and small apps',
        organizationId: org.id
      }
    });

    await prisma.workspaceMember.create({
      data: { workspaceId: ws.id, userId: admin.id, role: 'admin' }
    });
    await prisma.workspaceMember.create({
      data: { workspaceId: ws.id, userId: member.id, role: 'member' }
    });
  }

  // 5. Populate Workspace Files on Disk with founder's ICM templates
  const storage = new WorkspaceStorage(ws.id);
  const { seedWorkspaceIcmTemplate } = require('../src/modules/storage/icm-templates');
  await seedWorkspaceIcmTemplate(storage);

  await storage.createFile(
    'docs/sop-incident-response.md',
    `# SOP-004: Production Incident Response
1. **Severity 1 (Critical Outage)**:
   - Acknowledge within 5 minutes.
   - Open war room thread on Workbench.
   - Keep status communication hourly.
2. **Mitigation First**:
   - Revert recent changes or switch traffic before deep debugging.
3. **Post-Mortem**:
   - Deliver root cause analysis within 48 hours.`
  );

  await storage.createFile(
    'data/q3-quarterly-metrics.json',
    JSON.stringify(
      {
        quarter: 'Q3 2026',
        arr: '$4.2M',
        activeOrganizations: 180,
        monthlyActiveUsers: 24500,
        averageResponseTimeMs: 140,
        uptimePercentage: 99.98
      },
      null,
      2
    )
  );

  await storage.createFile(
    'docs/product-roadmap.md',
    `# 2026 Product Roadmap
- **Q1**: Multiplayer AI conversation & collaborative threads
- **Q2**: Small Software Cloud isolated sandbox micro-apps
- **Q3**: Enterprise SSO, Fine-grained RBAC & Auditing
- **Q4**: Cross-workspace semantic knowledge synthesis`
  );

  // 6. Thread & Discussion
  const thread = await prisma.thread.create({
    data: {
      title: 'Q3 Planning & Infrastructure Architecture',
      workspaceId: ws.id,
      createdById: admin.id
    }
  });

  await prisma.message.create({
    data: {
      content: 'Welcome team! Please review [source: docs/product-roadmap.md] for upcoming deliverables.',
      threadId: thread.id,
      authorId: admin.id
    }
  });

  console.log(`✓ Demo seeded successfully.`);
  console.log(`  Org: ${org.name}`);
  console.log(`  Admin login: admin@acme.ai / admin12345`);
  console.log(`  Member login: sarah@acme.ai / member12345`);
  console.log(`  Workspace: ${ws.name} (${ws.id})`);
}

if (require.main === module) {
  seedDemoData()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
