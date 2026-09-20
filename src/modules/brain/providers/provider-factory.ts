import { LLMProvider, ProviderType } from './types';
import { ClaudeProvider } from './claude-provider';
import { GeminiProvider } from './gemini-provider';
import { OpenAIProvider } from './openai-provider';
import { BedrockProvider } from './bedrock-provider';
import { config } from '../../../config';

export class ProviderFactory {
  public static createProvider(type?: ProviderType | string, customApiKey?: string): LLMProvider {
    const selectedType = (type?.toLowerCase() || 'claude') as ProviderType;

    switch (selectedType) {
      case 'gemini':
        return new GeminiProvider(customApiKey || process.env.GEMINI_API_KEY);
      case 'openai':
        return new OpenAIProvider(customApiKey || process.env.OPENAI_API_KEY);
      case 'openrouter':
        return new OpenAIProvider(customApiKey || process.env.OPENROUTER_API_KEY, 'https://openrouter.ai/api/v1');
      case 'bedrock':
        return new BedrockProvider(customApiKey);
      case 'claude':
      default:
        return new ClaudeProvider(customApiKey || config.anthropicApiKey);
    }
  }

  public static getAvailableProviders(): Array<{ id: ProviderType; name: string; description: string }> {
    return [
      { id: 'claude', name: 'Claude Code (Anthropic)', description: 'Best for complex reasoning, tool execution, and code analysis' },
      { id: 'gemini', name: 'Gemini CLI (Google)', description: 'Fast responses with high context window for deep document trees' },
      { id: 'openai', name: 'Codex / GPT-4o (OpenAI)', description: 'Strong generalist for operational workflows and document drafting' },
      { id: 'openrouter', name: 'OpenRouter', description: 'Fallback gateway across multiple hosted models' },
      { id: 'bedrock', name: 'Amazon Bedrock', description: 'Multi-model AWS environment' }
    ];
  }
}
