import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';

describe('Database Connection and CRUD Operations', () => {
  beforeAll(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should connect to database and perform CRUD operations on Organization', async () => {
    // Create
    const org = await prisma.organization.create({
      data: {
        name: 'Test Organization',
        description: 'A test organization',
      },
    });

    expect(org).toHaveProperty('id');
    expect(org.name).toBe('Test Organization');
    expect(org.description).toBe('A test organization');

    // Read
    const foundOrg = await prisma.organization.findUnique({
      where: { id: org.id },
    });

    expect(foundOrg).not.toBeNull();
    expect(foundOrg?.name).toBe(org.name);

    // Update
    const updatedOrg = await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: 'Updated Organization',
      },
    });

    expect(updatedOrg.name).toBe('Updated Organization');

    // Delete
    await prisma.organization.delete({
      where: { id: org.id },
    });

    const deletedOrg = await prisma.organization.findUnique({
      where: { id: org.id },
    });

    expect(deletedOrg).toBeNull();
  });

  test('should create related records: User, Membership, Workspace', async () => {
    // Create organization
    const org = await prisma.organization.create({
      data: {
        name: 'Test Org for Relations',
      },
    });

    // Create user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashed_password', // In real app, use bcrypt
        organizationId: org.id,
      },
    });

    // Create membership
    const membership = await prisma.membership.create({
      data: {
        role: 'OWNER',
        userId: user.id,
        organizationId: org.id,
      },
    });

    // Create workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: 'Test Workspace',
        organizationId: org.id,
      },
    });

    // Verify relations
    const userWithMembership = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: true,
      },
    });

    expect(userWithMembership?.memberships).toHaveLength(1);
    expect(userWithMembership?.memberships[0].role).toBe('OWNER');

    const workspaceWithOrg = await prisma.workspace.findUnique({
      where: { id: workspace.id },
      include: {
        organization: true,
      },
    });

    expect(workspaceWithOrg?.organization.name).toBe('Test Org for Relations');
  });

  test('should create a live session with a Driver participant', async () => {
    const org = await prisma.organization.create({ data: { name: 'Live Session Org' } });
    const user = await prisma.user.create({
      data: { email: 'driver@example.com', name: 'Driver', passwordHash: 'hash', organizationId: org.id },
    });
    const workspace = await prisma.workspace.create({
      data: { name: 'Live Session Workspace', organizationId: org.id },
    });
    const session = await prisma.liveSession.create({
      data: {
        workspaceId: workspace.id,
        createdById: user.id,
        currentDriverId: user.id,
        title: 'Refund review',
        goal: 'Review refund policy',
        status: 'CREATED',
      },
    });
    const participant = await prisma.sessionParticipant.create({
      data: { sessionId: session.id, userId: user.id, role: 'DRIVER', status: 'CONNECTED' },
    });
    expect(session.status).toBe('CREATED');
    expect(participant).toMatchObject({ sessionId: session.id, userId: user.id, role: 'DRIVER' });
  });
});
