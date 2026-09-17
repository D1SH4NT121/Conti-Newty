import { prisma } from '../../db/client';

export interface CreateUserParams {
  email: string;
  name?: string | null;
  passwordHash?: string | null;
  googleId?: string | null;
  githubId?: string | null;
  avatarUrl?: string | null;
}

/**
 * Creates a new user along with their default Organization and OWNER Membership
 * atomically in a single database transaction.
 */
export async function createDefaultUserWithOrg(params: CreateUserParams) {
  const displayName = params.name || params.email.split('@')[0];
  const orgName = `${displayName}'s Organization`;

  return prisma.$transaction(async (tx) => {
    // 1. Create default organization
    const org = await tx.organization.create({
      data: {
        name: orgName,
        description: `Default personal organization for ${displayName}`
      }
    });

    // 2. Create user assigned to this organization
    const user = await tx.user.create({
      data: {
        email: params.email,
        name: displayName,
        passwordHash: params.passwordHash || null,
        googleId: params.googleId || null,
        githubId: params.githubId || null,
        avatarUrl: params.avatarUrl || null,
        organizationId: org.id
      }
    });

    // 3. Create Membership row assigning user as OWNER
    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'OWNER'
      }
    });

    return user;
  });
}

/**
 * Computes the server-driven destination route after successful authentication.
 *
 * Rules:
 * 1. Pending unresolved invite for user's email -> /enter?invite=${token}
 * 2. 0 workspaces -> /onboarding
 * 3. >=1 workspaces -> /w/:workspaceId/home (last accessed or most recent)
 */
export async function computePostAuthRoute(user: { id: string; email: string; lastWorkspaceId?: string | null }): Promise<string> {
  // 1. Check for pending invite
  const pendingInvite = await prisma.orgInvite.findFirst({
    where: {
      email: user.email,
      consumedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (pendingInvite) {
    return `/enter?invite=${pendingInvite.token}`;
  }

  // 2. Query user's workspaces
  const workspaceMemberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    orderBy: { joinedAt: 'desc' }
  });

  if (workspaceMemberships.length === 0) {
    return '/onboarding';
  }

  // Check if lastWorkspaceId is still valid for this user
  if (user.lastWorkspaceId) {
    const hasAccess = workspaceMemberships.some((m) => m.workspaceId === user.lastWorkspaceId);
    if (hasAccess) {
      return `/w/${user.lastWorkspaceId}/home`;
    }
  }

  // Otherwise return the most recently joined workspace
  return `/w/${workspaceMemberships[0].workspaceId}/home`;
}
