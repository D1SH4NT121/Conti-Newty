export type ProviderType = 'claude' | 'gemini' | 'openai' | 'openrouter' | 'bedrock';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface AIResponse {
  content: string;
  toolCalls?: AIToolCall[];
  stopReason?: string;
  provider?: string;
}

export function isSimulationAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  if (process.env.ALLOW_AI_SIMULATION === 'true') {
    return true;
  }
  const isTest = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  if (!isTest) {
    return false;
  }
  return process.env.ALLOW_AI_SIMULATION !== 'false';
}

export interface LLMProvider {
  readonly name: string;
  readonly providerType: ProviderType;
  complete(params: {
    messages: AIMessage[];
    systemPrompt?: string;
    tools?: any[];
    /** Optional model override — e.g. "gpt-4o-mini", "claude-haiku-4-5-20251001", "gemini-1.5-flash" */
    model?: string;
  }): Promise<AIResponse>;
}

/** Cheapest known model ID for each provider, used for intermediate Relay Mode steps. */
export const CHEAP_MODEL: Record<ProviderType, string> = {
  claude: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  openrouter: process.env.OPENROUTER_CHEAP_MODEL_ID || 'openai/gpt-4o-mini',
  gemini: process.env.GEMINI_CHEAP_MODEL_ID || 'gemini-3.5-flash-lite',
  bedrock: process.env.BEDROCK_CHEAP_MODEL_ID || 'amazon.nova-lite-v1:0'
};

/** Default (strongest) model ID for each provider, used for the final Relay Mode step. */
export const STRONG_MODEL: Record<ProviderType, string> = {
  claude: 'claude-3-5-sonnet-20241022',
  openai: 'gpt-4o',
  openrouter: process.env.OPENROUTER_MODEL_ID || 'openai/gpt-4o',
  gemini: process.env.GEMINI_MODEL_ID || 'gemini-3-flash-preview',
  bedrock: process.env.BEDROCK_MODEL_ID || 'amazon.nova-pro-v1:0'
};
