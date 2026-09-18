import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, ProviderType, AIMessage, AIResponse, AIToolCall, isSimulationAllowed } from './types';

export class ClaudeProvider implements LLMProvider {
  public readonly name = 'Claude Code (Anthropic)';
  public readonly providerType: ProviderType = 'claude';
  private client?: Anthropic;

  constructor(apiKey?: string) {
    if (apiKey && apiKey !== 'your_anthropic_api_key_here' && apiKey !== 'test-key') {
      this.client = new Anthropic({ apiKey });
    }
  }

  public async complete(params: {
    messages: AIMessage[];
    systemPrompt?: string;
    tools?: any[];
    model?: string;
  }): Promise<AIResponse> {
    if (this.client) {
      const clientAny = this.client as any;
      if (clientAny.messages && typeof clientAny.messages.create === 'function') {
        const anthropicMessages = params.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }));

        const response: any = await clientAny.messages.create({
          model: params.model || 'claude-3-5-sonnet-20241022',
          max_tokens: 4096,
          system: params.systemPrompt,
          messages: anthropicMessages,
          tools: params.tools as any
        });

        let textContent = '';
        const toolCalls: AIToolCall[] = [];

        for (const block of response.content) {
          if (block.type === 'text') {
            textContent += block.text;
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id,
              name: block.name,
              input: block.input
            });
          }
        }

        return {
          content: textContent,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          stopReason: response.stop_reason,
          provider: this.name
        };
      }
    }

    if (!isSimulationAllowed()) {
      throw new Error(`[${this.name}] Unconfigured provider: Valid API key is required. Simulation mode is forbidden outside NODE_ENV=test with ALLOW_AI_SIMULATION=true.`);
    }

    return this.runTestSimulation(params);
  }

  private runTestSimulation(params: { messages: AIMessage[]; tools?: any[] }): AIResponse {
    const lastUserMsg = [...params.messages].reverse().find(m => m.role === 'user')?.content || '';
    return {
      content: `[Claude Engine] Processed prompt: "${lastUserMsg}"`,
      stopReason: 'end_turn',
      provider: this.name
    };
  }
}
