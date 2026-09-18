export type ProviderType = 'claude' | 'gemini' | 'openai' | 'bedrock';

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
    /** Optional model override — e.g. "gpt-4o-mini", "claude-3-haiku-20240307", "gemini-1.5-flash" */
    model?: string;
  }): Promise<AIResponse>;
}

/** Cheapest known model ID for each provider, used for intermediate Relay Mode steps. */
export const CHEAP_MODEL: Record<ProviderType, string> = {
  claude: 'claude-3-haiku-20240307',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-1.5-flash',
  bedrock: 'anthropic.claude-3-haiku-20240307-v1:0'
};

/** Default (strongest) model ID for each provider, used for the final Relay Mode step. */
export const STRONG_MODEL: Record<ProviderType, string> = {
  claude: 'claude-3-5-sonnet-20241022',
  openai: 'gpt-4o',
  gemini: 'gemini-1.5-pro',
  bedrock: 'anthropic.claude-3-5-sonnet-20241022-v2:0'
};
