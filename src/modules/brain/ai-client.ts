import { ProviderFactory } from './providers/provider-factory';
import { LLMProvider, ProviderType, AIMessage, AIResponse, AIToolCall } from './providers/types';

export { AIMessage, AIResponse, AIToolCall, ProviderType };

export class AIClient {
  private provider: LLMProvider;

  constructor(providerType?: ProviderType | string, customApiKey?: string) {
    this.provider = ProviderFactory.createProvider(providerType, customApiKey);
  }

  public setProvider(providerType: ProviderType | string, customApiKey?: string) {
    this.provider = ProviderFactory.createProvider(providerType, customApiKey);
  }

  public getProviderName(): string {
    return this.provider.name;
  }

  public async complete(params: {
    messages: AIMessage[];
    systemPrompt?: string;
    tools?: any[];
    model?: string;
  }): Promise<AIResponse> {
    return this.provider.complete(params);
  }
}
