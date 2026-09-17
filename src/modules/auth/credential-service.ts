import { prisma } from '../../db/client';
import { CredentialVault } from './credential-vault';
import { config } from '../../config';

export class CredentialService {
  public static async resolveApiKey(provider: string, userId?: string, workspaceId?: string): Promise<string | undefined> {
    // 1. Check User specific BYOK credential
    if (userId) {
      const userCred = await prisma.providerCredential.findFirst({
        where: { userId, provider: provider.toLowerCase(), status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' }
      });
      if (userCred) {
        try {
          return CredentialVault.decrypt(userCred.secretEnc);
        } catch {}
      }
    }

    // 2. Check Workspace specific CLI_OAUTH / Team payer credential
    if (workspaceId) {
      const wsCred = await prisma.providerCredential.findFirst({
        where: { workspaceId, provider: provider.toLowerCase(), status: 'ACTIVE' },
        orderBy: { updatedAt: 'desc' }
      });
      if (wsCred) {
        try {
          return CredentialVault.decrypt(wsCred.secretEnc);
        } catch {}
      }
    }

    // 3. Fallback to server environment variables
    const lower = provider.toLowerCase();
    if (lower === 'claude') return config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    if (lower === 'gemini') return process.env.GEMINI_API_KEY;
    if (lower === 'openai') return process.env.OPENAI_API_KEY;

    return undefined;
  }
}
