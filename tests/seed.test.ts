import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';

describe('Seed Data Verification', () => {
  beforeAll(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await clearDatabase();
    await prisma.$disconnect();
  });

  test('should seed default organization, user, workspace, thread, and message', async () => {
    // Import and run the seed function
    const { main } = await import('../src/db/seed');
    await main();

    // Verify organization was created
    const organization = await prisma.organization.findFirst({
      where: { name: 'Conti-Newty Inc.' },
    });

    expect(organization).not.toBeNull();
    expect(organization?.description).toBe('Default organization for Conti-Newty Workbench');

    // Verify admin user was created
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@conti-newty.com' },
    });

    expect(adminUser).not.toBeNull();
    expect(adminUser?.name).toBe('Admin User');
    expect(adminUser?.role).toBe('ADMIN');

    // Verify membership was created
    const membership = await prisma.membership.findFirst({
      where: {
        userId: adminUser?.id,
        organizationId: organization?.id,
      },
    });

    expect(membership).not.toBeNull();
    expect(membership?.role).toBe('OWNER');

    // Verify workspace was created
    const workspace = await prisma.workspace.findFirst({
      where: { name: 'Default Workspace' },
    });

    expect(workspace).not.toBeNull();
    expect(workspace?.description).toBe('Default workspace for getting started');

    // Verify workspace membership was created
    const workspaceMembership = await prisma.workspaceMember.findFirst({
      where: {
        userId: adminUser?.id,
        workspaceId: workspace?.id,
      },
    });

    expect(workspaceMembership).not.toBeNull();
    expect(workspaceMembership?.role).toBe('OWNER');

    // Verify thread was created
    const thread = await prisma.thread.findFirst({
      where: { title: 'Welcome to Conti-Newty Workbench' },
    });

    expect(thread).not.toBeNull();
    expect(thread?.workspaceId).toBe(workspace?.id);
    expect(thread?.createdById).toBe(adminUser?.id);

    // Verify message was created
    const message = await prisma.message.findFirst({
      where: {
        content: 'Welcome to the Conti-Newty Workbench! This is a sample message to get you started.',
      },
    });

    expect(message).not.toBeNull();
    expect(message?.threadId).toBe(thread?.id);
    expect(message?.authorId).toBe(adminUser?.id);
  });
});