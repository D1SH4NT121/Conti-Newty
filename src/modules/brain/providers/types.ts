export type ProviderType = 'claude' | 'gemini' | 'openai';

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
  }): Promise<AIResponse>;
}
