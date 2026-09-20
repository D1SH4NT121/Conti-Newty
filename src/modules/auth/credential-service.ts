import { config } from '../../config';
import { prisma } from '../../db/client';
import { CredentialVault } from './credential-vault';

export class CredentialService {
  private static isUsableKey(provider: string, value: string | undefined): value is string {
    if (!value || !value.trim()) return false;
    if (process.env.JEST_WORKER_ID) return true;
    const key = value.trim();
    if (/^(your_|test-key$|placeholder$)/i.test(key)) return false;
    if (provider.toLowerCase() === 'gemini' && key.startsWith('AQ.')) return false;
    return true;
  }

  public static async resolveApiKey(provider: string, userId?: string, workspaceId?: string): Promise<string | undefined> {
    // Provider credentials are intentionally server-owned in the public workspace mode.
    const lower = provider.toLowerCase();

    const storedCredential = await prisma.providerCredential.findFirst({
      where: {
        provider: lower,
        kind: 'BYOK',
        status: 'ACTIVE',
        OR: [
          ...(userId ? [{ userId }] : []),
          ...(workspaceId ? [{ workspaceId }] : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (storedCredential) {
      try {
        const value = CredentialVault.decrypt(storedCredential.secretEnc);
        if (this.isUsableKey(lower, value)) return value;
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
    }

    if (lower === 'claude') {
      const value = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
      return this.isUsableKey(lower, value) ? value : undefined;
    }
    if (lower === 'gemini') {
      const value = process.env.GEMINI_API_KEY;
      return this.isUsableKey(lower, value) ? value : undefined;
    }
    if (lower === 'openai') {
      const value = process.env.OPENAI_API_KEY;
      return this.isUsableKey(lower, value) ? value : undefined;
    }
    if (lower === 'openrouter') {
      const value = process.env.OPENROUTER_API_KEY;
      return this.isUsableKey(lower, value) ? value : undefined;
    }
    if (lower === 'bedrock') {
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
      const region = process.env.AWS_REGION;
      if (accessKeyId && secretAccessKey && region) {
        return JSON.stringify({ accessKeyId, secretAccessKey, region });
      }
    }

    return undefined;
  }

  public static async resolveAvailableProvider(
    preferredProvider: string,
    userId?: string,
    workspaceId?: string
  ): Promise<{ provider: string; apiKey: string } | undefined> {
    const candidates = Array.from(new Set([
      preferredProvider.toLowerCase(),
      config.aiProvider.toLowerCase(),
      'gemini',
      'claude',
      'openai',
      'openrouter',
      'bedrock',
    ]));

    for (const provider of candidates) {
      const apiKey = await this.resolveApiKey(provider, userId, workspaceId);
      if (apiKey) return { provider, apiKey };
    }

    return undefined;
  }
}
