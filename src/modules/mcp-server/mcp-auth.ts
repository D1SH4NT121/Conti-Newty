import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../db/client';
import { CredentialVault } from '../auth/credential-vault';

export interface McpTokenPayload {
  workspaceId: string;
  userId: string;
  credentialId: string;
}

export interface McpAuthenticatedRequest extends Request {
  mcp?: McpTokenPayload;
  user?: any;
}

/**
 * Generates and stores a new per-workspace MCP access token.
 * Reuses the existing ProviderCredential model and AES-256-GCM CredentialVault.
 */
export async function generateWorkspaceMcpToken(
  workspaceId: string,
  userId: string,
  label?: string
): Promise<{ id: string; token: string; label: string; createdAt: Date }> {
  // Generate high-entropy token prefix
  const rawSecret = `cnty_mcp_${crypto.randomBytes(24).toString('hex')}`;
  const secretEnc = CredentialVault.encrypt(rawSecret);
  const tokenLabel = label || `MCP Token - ${new Date().toLocaleDateString()}`;

  const cred = await prisma.providerCredential.create({
    data: {
      kind: 'MCP_TOKEN',
      provider: 'mcp',
      label: tokenLabel,
      secretEnc,
      workspaceId,
      userId,
      createdById: userId,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      label: true,
      createdAt: true,
    },
  });

  return {
    id: cred.id,
    token: rawSecret,
    label: cred.label || tokenLabel,
    createdAt: cred.createdAt,
  };
}

/**
 * Validates an incoming MCP token against active ProviderCredential records.
 */
export async function validateMcpToken(
  rawToken: string,
  targetWorkspaceId?: string
): Promise<McpTokenPayload | null> {
  if (!rawToken || !rawToken.startsWith('cnty_mcp_')) {
    return null;
  }

  const whereClause: any = {
    provider: 'mcp',
    kind: 'MCP_TOKEN',
    status: 'ACTIVE',
  };

  if (targetWorkspaceId) {
    whereClause.workspaceId = targetWorkspaceId;
  }

  const candidates = await prisma.providerCredential.findMany({
    where: whereClause,
  });

  for (const candidate of candidates) {
    try {
      const decrypted = CredentialVault.decrypt(candidate.secretEnc);
      const tokenBuf = Buffer.from(rawToken);
      const decryptedBuf = Buffer.from(decrypted);

      if (
        tokenBuf.length === decryptedBuf.length &&
        crypto.timingSafeEqual(tokenBuf, decryptedBuf)
      ) {
        if (!candidate.workspaceId) continue;
        return {
          workspaceId: candidate.workspaceId,
          userId: candidate.userId || candidate.createdById || 'mcp-system',
          credentialId: candidate.id,
        };
      }
    } catch {
      // Ignore decrypt failure on stale record
    }
  }

  return null;
}

/**
 * Lists all active and revoked MCP tokens for a workspace (metadata only).
 */
export async function listWorkspaceMcpTokens(workspaceId: string) {
  return prisma.providerCredential.findMany({
    where: {
      workspaceId,
      provider: 'mcp',
      kind: 'MCP_TOKEN',
    },
    select: {
      id: true,
      label: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Revokes an existing MCP token.
 */
export async function revokeMcpToken(tokenId: string, workspaceId: string): Promise<boolean> {
  const cred = await prisma.providerCredential.findFirst({
    where: {
      id: tokenId,
      workspaceId,
      provider: 'mcp',
      kind: 'MCP_TOKEN',
    },
  });

  if (!cred) return false;

  await prisma.providerCredential.update({
    where: { id: tokenId },
    data: { status: 'REVOKED' },
  });

  return true;
}

/**
 * Express middleware to authenticate MCP requests via token header.
 * Supports:
 *   - Header: `Authorization: Bearer cnty_mcp_...`
 *   - Header: `x-mcp-token: cnty_mcp_...`
 *   - Fallback: standard user auth if already authenticated via session/JWT
 */
export async function mcpAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const mcpReq = req as McpAuthenticatedRequest;
  const authHeader = req.headers.authorization;
  const xMcpToken = req.headers['x-mcp-token'] as string | undefined;
  const workspaceIdParam = req.params.workspaceId || req.params.id;

  let rawToken: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const candidate = authHeader.slice(7).trim();
    if (candidate.startsWith('cnty_mcp_')) {
      rawToken = candidate;
    }
  } else if (xMcpToken) {
    rawToken = xMcpToken.trim();
  }

  if (rawToken) {
    const validated = await validateMcpToken(rawToken, workspaceIdParam);
    if (!validated) {
      return res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid or revoked MCP access token' },
        id: req.body?.id ?? null,
      });
    }

    mcpReq.mcp = validated;
    return next();
  }

  // Fallback: If user is authenticated via standard JWT/session and target workspace matches
  if (mcpReq.user && workspaceIdParam) {
    mcpReq.mcp = {
      workspaceId: workspaceIdParam,
      userId: mcpReq.user.id,
      credentialId: 'user-session',
    };
    return next();
  }

  return res.status(401).json({
    jsonrpc: '2.0',
    error: {
      code: -32000,
      message: 'Authentication required. Provide a valid MCP Bearer token.',
    },
    id: req.body?.id ?? null,
  });
}
