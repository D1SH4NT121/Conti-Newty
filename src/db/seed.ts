import { prisma } from './client';
import { AuthService } from '../modules/auth/auth-service';

export async function main() {
  console.log('Starting database seeding...');
  const authService = new AuthService();

  // Create a default organization if it doesn't exist
  let organization = await prisma.organization.findFirst({
    where: { name: 'Conti-Newty Inc.' },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: 'Conti-Newty Inc.',
        description: 'Default organization for Conti-Newty Workbench',
      },
    });
  }

  // Create a default admin user if it doesn't exist
  let adminUser = await prisma.user.findFirst({
    where: { email: 'admin@conti-newty.com' },
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@conti-newty.com',
        name: 'Admin User',
        passwordHash: authService.hashPassword('password123'),
        role: 'ADMIN',
        organizationId: organization.id,
      },
    });
  } else {
    adminUser = await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        passwordHash: authService.hashPassword('password123')
      }
    });
  }

  // Create a membership for the admin user if it doesn't exist
  let membership = await prisma.membership.findFirst({
    where: {
      userId: adminUser.id,
      organizationId: organization.id,
    },
  });

  if (!membership) {
    membership = await prisma.membership.create({
      data: {
        role: 'OWNER',
        userId: adminUser.id,
        organizationId: organization.id,
      },
    });
  }

  // Create a default workspace if it doesn't exist
  let workspace = await prisma.workspace.findFirst({
    where: { name: 'Default Workspace' },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Default Workspace',
        description: 'Default workspace for getting started',
        organizationId: organization.id,
      },
    });
  }

  // Add admin user to workspace if not already a member
  let workspaceMembership = await prisma.workspaceMember.findFirst({
    where: {
      userId: adminUser.id,
      workspaceId: workspace.id,
    },
  });

  if (!workspaceMembership) {
    workspaceMembership = await prisma.workspaceMember.create({
      data: {
        role: 'OWNER',
        userId: adminUser.id,
        workspaceId: workspace.id,
      },
    });
  }

  // Create a sample thread if it doesn't exist
  let thread = await prisma.thread.findFirst({
    where: { title: 'Welcome to Conti-Newty Workbench' },
  });

  if (!thread) {
    thread = await prisma.thread.create({
      data: {
        title: 'Welcome to Conti-Newty Workbench',
        workspaceId: workspace.id,
        createdById: adminUser.id,
      },
    });
  }

  // Create a sample message if it doesn't exist
  let message = await prisma.message.findFirst({
    where: {
      content: 'Welcome to the Conti-Newty Workbench! This is a sample message to get you started.',
    },
  });

  if (!message) {
    message = await prisma.message.create({
      data: {
        content: 'Welcome to the Conti-Newty Workbench! This is a sample message to get you started.',
        threadId: thread.id,
        authorId: adminUser.id,
      },
    });
  }

  console.log('Seeding completed.');
}

// When this file is run directly, run main.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}