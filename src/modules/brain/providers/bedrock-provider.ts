import { BedrockRuntimeClient, ConverseStreamCommand, Message, Tool } from "@aws-sdk/client-bedrock-runtime";
import { LLMProvider, ProviderType, AIMessage, AIResponse, AIToolCall, isSimulationAllowed } from './types';

export class BedrockProvider implements LLMProvider {
  public readonly name = 'Amazon Bedrock';
  public readonly providerType: ProviderType = 'bedrock' as ProviderType;
  private client?: BedrockRuntimeClient;

  constructor(apiKey?: string) {
    if (apiKey && apiKey !== 'test-key' && apiKey !== 'your_aws_credentials_json') {
      try {
        const parsed = JSON.parse(apiKey);
        if (!parsed.accessKeyId || !parsed.secretAccessKey || !parsed.region) {
          throw new Error('Missing fields');
        }
        this.client = new BedrockRuntimeClient({
          region: parsed.region,
          credentials: {
            accessKeyId: parsed.accessKeyId,
            secretAccessKey: parsed.secretAccessKey
          }
        });
      } catch (e) {
        throw new Error('[Bedrock Engine] reconnect_required: Invalid or incomplete custom AWS credentials format.');
      }
    } else {
      // Default credential chain logic
      if (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_REGION) {
        // Leave undefined so parity tests can verify "Unconfigured provider" behavior
        this.client = undefined;
      } else {
        this.client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
      }
    }
  }

  public async complete(params: {
    messages: AIMessage[];
    systemPrompt?: string;
    tools?: any[];
    model?: string;
  }): Promise<AIResponse> {
    if (this.client) {
      const bedrockMessages: Message[] = params.messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: [{ text: m.content }]
      }));

      const toolConfig = params.tools ? {
        tools: params.tools.map(t => ({
          toolSpec: {
            name: t.name,
            description: t.description,
            inputSchema: {
              json: t.input_schema || t.parameters
            }
          }
        } as Tool))
      } : undefined;

      const command = new ConverseStreamCommand({
        modelId: params.model || process.env.BEDROCK_MODEL_ID || 'amazon.nova-pro-v1:0',
        messages: bedrockMessages,
        system: params.systemPrompt ? [{ text: params.systemPrompt }] : undefined,
        toolConfig
      });

      try {
        const response = await this.client.send(command);
        
        let textContent = '';
        const toolCallsMap = new Map<number, { id: string, name: string, inputStr: string }>();
        let stopReason = 'end_turn';

        if (response.stream) {
          for await (const chunk of response.stream) {
            if (chunk.contentBlockStart?.start?.toolUse) {
              const tu = chunk.contentBlockStart.start.toolUse;
              toolCallsMap.set(chunk.contentBlockStart.contentBlockIndex!, {
                id: tu.toolUseId!,
                name: tu.name!,
                inputStr: ''
              });
            }
            if (chunk.contentBlockDelta?.delta?.text) {
              textContent += chunk.contentBlockDelta.delta.text;
            }
            if (chunk.contentBlockDelta?.delta?.toolUse) {
               const idx = chunk.contentBlockDelta.contentBlockIndex!;
               const tu = toolCallsMap.get(idx);
               if (tu) {
                 tu.inputStr += chunk.contentBlockDelta.delta.toolUse.input || '';
               }
            }
            if (chunk.messageStop?.stopReason) {
               stopReason = chunk.messageStop.stopReason === 'tool_use' ? 'tool_use' : chunk.messageStop.stopReason;
            }
          }
        }

        const toolCalls: AIToolCall[] = Array.from(toolCallsMap.values()).map(tu => ({
          id: tu.id,
          name: tu.name,
          input: JSON.parse(tu.inputStr || '{}')
        }));

        return {
          content: textContent,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          stopReason,
          provider: this.name
        };
      } catch (err: any) {
        if (isSimulationAllowed()) {
          console.warn(`[Bedrock Engine] AWS Bedrock call failed (${err.message}). Falling back to simulation mode.`);
          return this.runTestSimulation(params);
        }
        throw err;
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
      content: `[Bedrock Engine] Processed prompt: "${lastUserMsg}"`,
      stopReason: 'end_turn',
      provider: this.name
    };
  }
}
