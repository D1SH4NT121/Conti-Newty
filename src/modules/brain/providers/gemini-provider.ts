import { LLMProvider, ProviderType, AIMessage, AIResponse, AIToolCall, isSimulationAllowed } from './types';

export class GeminiProvider implements LLMProvider {
  public readonly name = 'Gemini CLI (Google)';
  public readonly providerType: ProviderType = 'gemini';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey && apiKey !== 'your_gemini_api_key_here' && apiKey !== 'test-key' ? apiKey : undefined;
  }

  public async complete(params: {
    messages: AIMessage[];
    systemPrompt?: string;
    tools?: any[];
    model?: string;
  }): Promise<AIResponse> {
    if (this.apiKey) {
      const contents = params.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const functionDeclarations = params.tools?.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }));

      const bodyPayload: any = {
        systemInstruction: params.systemPrompt ? { parts: [{ text: params.systemPrompt }] } : undefined,
        contents,
        generationConfig: { maxOutputTokens: 4096 }
      };

      if (functionDeclarations && functionDeclarations.length > 0) {
        bodyPayload.tools = [{ functionDeclarations }];
      }

      const modelId = params.model || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });

      if (response.ok) {
        const data: any = await response.json();
        const candidate = data?.candidates?.[0];
        const parts = candidate?.content?.parts || [];
        
        let textContent = '';
        const toolCalls: AIToolCall[] = [];

        for (const part of parts) {
          if (part.text) {
            textContent += part.text;
          }
          if (part.functionCall) {
            toolCalls.push({
              id: `gemini-${Date.now()}`,
              name: part.functionCall.name,
              input: part.functionCall.args || {}
            });
          }
        }

        return {
          content: textContent,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          stopReason: candidate?.finishReason || 'end_turn',
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
      content: `[Gemini Engine] Processed prompt: "${lastUserMsg}"`,
      stopReason: 'end_turn',
      provider: this.name
    };
  }
}
