import { prisma } from '../../db/client';
import { AuthService } from '../../modules/auth/auth-service';
import { config } from '../../config';
import { createDefaultUserWithOrg } from './user-organization-service';

const authService = new AuthService();

interface OAuthProfile {
  providerId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  accessToken?: string;
}

function issueToken(userId: string, email: string): string {
  return authService.generateToken({ userId, email });
}

async function findOrCreateOAuthUser(
  provider: 'google' | 'github',
  profile: OAuthProfile
) {
  const idField = provider === 'google' ? 'googleId' : 'githubId';

  // 1. Existing linked account
  const linked = await prisma.user.findFirst({
    where: { [idField]: profile.providerId }
  });
  if (linked) {
    // Backfill avatar if missing
    if (!linked.avatarUrl && profile.avatarUrl) {
      await prisma.user.update({
        where: { id: linked.id },
        data: { avatarUrl: profile.avatarUrl }
      });
    }
    return linked;
  }

  // 2. Existing email account (password or other OAuth) — link it
  const byEmail = await prisma.user.findUnique({
    where: { email: profile.email }
  });
  if (byEmail) {
    return prisma.user.update({
      where: { id: byEmail.id },
      data: {
        [idField]: profile.providerId,
        avatarUrl: byEmail.avatarUrl || profile.avatarUrl,
        name: byEmail.name || profile.name
      }
    });
  }

  // 3. Brand-new user: atomically create user + default Organization + OWNER Membership
  return createDefaultUserWithOrg({
    email: profile.email,
    name: profile.name || profile.email.split('@')[0],
    passwordHash: null,
    [idField]: profile.providerId,
    avatarUrl: profile.avatarUrl
  });
}

function redirectWithToken(
  res: any,
  user: { id: string; email: string; name: string | null },
  params?: { inviteToken?: string; joinCode?: string; githubToken?: string; returnTo?: string }
) {
  const token = issueToken(user.id, user.email);
  const url = new URL('/auth/callback', config.frontendUrl);
  url.searchParams.set('token', token);
  if (params?.githubToken) {
    url.searchParams.set('github_token', params.githubToken);
  }
  if (params?.returnTo) {
    url.searchParams.set('return_to', params.returnTo);
  }
  if (params?.inviteToken) {
    url.searchParams.set('invite', params.inviteToken);
  }
  if (params?.joinCode) {
    url.searchParams.set('code', params.joinCode);
  }
  return res.redirect(url.toString());
}

function redirectWithError(res: any, message: string) {
  const url = new URL('/auth/callback', config.frontendUrl);
  url.searchParams.set('error', message);
  return res.redirect(url.toString());
}

// ---------- Google ----------

export function googleAuthUrl(state = 'login'): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', config.googleClientId);
  url.searchParams.set('redirect_uri', googleCallbackUrl());
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export function googleCallbackUrl(): string {
  return `http://localhost:${config.port}/api/auth/google/callback`;
}

export async function handleGoogleCallback(code: string): Promise<OAuthProfile> {
  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: googleCallbackUrl(),
      grant_type: 'authorization_code'
    })
  });
  if (!tokenRes.ok) {
    throw new Error('Google token exchange failed');
  }
  const tokens = (await tokenRes.json()) as { id_token?: string; access_token?: string };
  if (!tokens.id_token) {
    throw new Error('Google token missing id_token');
  }

  // Verify and extract profile from id_token
  const profileRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${tokens.id_token}`
  );
  if (!profileRes.ok) {
    throw new Error('Google token verification failed');
  }
  const profile = (await profileRes.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
    email_verified?: string | boolean;
  };
  if (!profile.email) {
    throw new Error('Google profile missing email');
  }
  return {
    providerId: profile.sub,
    email: profile.email,
    name: profile.name || null,
    avatarUrl: profile.picture || null,
    accessToken: tokens.access_token
  };
}

// ---------- GitHub ----------

export function githubAuthUrl(state = 'login'): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', config.githubClientId);
  url.searchParams.set('redirect_uri', githubCallbackUrl());
  url.searchParams.set('scope', 'read:user user:email repo');
  url.searchParams.set('state', state);
  return url.toString();
}

export function githubCallbackUrl(): string {
  return `http://localhost:${config.port}/api/auth/github/callback`;
}

export async function handleGithubCallback(code: string): Promise<OAuthProfile> {
  // Exchange code for tokens
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      code,
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      redirect_uri: githubCallbackUrl()
    })
  });
  if (!tokenRes.ok) {
    throw new Error('GitHub token exchange failed');
  }
  const tokens = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokens.access_token) {
    throw new Error(tokens.error || 'GitHub token exchange failed');
  }
  const headers = {
    Authorization: `Bearer ${tokens.access_token}`,
    Accept: 'application/vnd.github+json'
  };

  // Fetch profile
  const profileRes = await fetch('https://api.github.com/user', { headers });
  if (!profileRes.ok) {
    throw new Error('GitHub profile fetch failed');
  }
  const profile = (await profileRes.json()) as {
    id: number;
    login: string;
    name?: string | null;
    avatar_url?: string;
    email?: string | null;
  };

  // Primary verified email (may be private on profile)
  let email = profile.email || null;
  if (!email) {
    const emailsRes = await fetch('https://api.github.com/user/emails', { headers });
    if (emailsRes.ok) {
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified);
      email = primary?.email || null;
    }
  }
  if (!email) {
    throw new Error('GitHub account has no verified email — make one visible or verify it first');
  }

  return {
    providerId: String(profile.id),
    email,
    name: profile.name || profile.login,
    avatarUrl: profile.avatar_url || null,
    accessToken: tokens.access_token
  };
}

export const oauthService = {
  findOrCreateOAuthUser,
  redirectWithToken,
  redirectWithError,
  googleAuthUrl,
  githubAuthUrl,
  handleGoogleCallback,
  handleGithubCallback
};
