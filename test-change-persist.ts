import { ChangeService } from './src/modules/changes/change-service';
import { WorkspaceStorage } from './src/modules/storage/workspace-storage';
import { prisma } from './src/db/client';
import crypto from 'crypto';

async function testPersistence() {
  const dummyUser = await prisma.user.create({
    data: { email: `test-${Date.now()}@example.com`, name: 'Test User' }
  });
  const dummyOrg = await prisma.organization.create({
    data: { name: 'Test Org' }
  });
  const dummyWorkspace = await prisma.workspace.create({
    data: { name: 'Test WS', organizationId: dummyOrg.id }
  });

  const storage = new WorkspaceStorage(dummyWorkspace.id);
  const svc1 = new ChangeService(storage);

  const newChange = await svc1.createProposedChange({
    workspaceId: dummyWorkspace.id,
    filePath: 'test.txt',
    proposedBy: dummyUser.id,
    proposedContent: 'hello world',
    description: 'test change'
  });

  console.log(`Created proposed change ID: ${newChange.id}`);

  // Re-instantiate service (simulating restart)
  const svc2 = new ChangeService(storage);
  const fetched = await svc2.getProposedChange(dummyWorkspace.id, newChange.id);

  console.log('Fetched from DB:', fetched ? 'Found' : 'Not Found');
  console.log(fetched?.id === newChange.id ? 'Persistence OK' : 'Failed to retrieve');
  
  // Cleanup
  await prisma.proposedChange.delete({ where: { id: newChange.id } });
  await prisma.workspace.delete({ where: { id: dummyWorkspace.id } });
  await prisma.organization.delete({ where: { id: dummyOrg.id } });
  await prisma.user.delete({ where: { id: dummyUser.id } });
}

testPersistence().then(() => process.exit(0)).catch(console.error);
