import { LLMProvider, ProviderType, AIMessage, AIResponse, AIToolCall, isSimulationAllowed } from './types';

export class OpenAIProvider implements LLMProvider {
  public readonly name = 'OpenAI Codex / GPT-4o';
  public readonly providerType: ProviderType = 'openai';
  private apiKey?: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey && apiKey !== 'your_openai_api_key_here' && apiKey !== 'test-key' ? apiKey : undefined;
    this.baseUrl = baseUrl;
  }

  public async complete(params: {
    messages: AIMessage[];
    systemPrompt?: string;
    tools?: any[];
    model?: string;
  }): Promise<AIResponse> {
    if (this.apiKey) {
      const messages = [
        ...(params.systemPrompt ? [{ role: 'system', content: params.systemPrompt }] : []),
        ...params.messages.map((m) => ({ role: m.role, content: m.content }))
      ];

      const formattedTools = params.tools?.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema
        }
      }));

      const bodyPayload: any = {
        model: params.model || 'gpt-4o',
        messages,
        max_tokens: 4096
      };
      if (formattedTools && formattedTools.length > 0) {
        bodyPayload.tools = formattedTools;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      };
      if (this.baseUrl.includes('openrouter')) {
        headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL || 'https://conti-newty.com';
        headers['X-Title'] = process.env.OPENROUTER_APP_NAME || 'Conti-Newty';
      }

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload)
      });

      if (response.ok) {
        const data: any = await response.json();
        const choice = data?.choices?.[0];
        const text = choice?.message?.content || '';
        const toolCalls: AIToolCall[] = (choice?.message?.tool_calls || []).map((tc: any) => ({
          id: tc.id,
          name: tc.function?.name,
          input: typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function?.arguments
        }));

        return {
          content: text,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          stopReason: choice?.finish_reason,
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
      content: `[OpenAI Engine] Processed prompt: "${lastUserMsg}"`,
      stopReason: 'stop',
      provider: this.name
    };
  }
}
