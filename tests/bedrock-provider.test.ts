import { BedrockProvider } from '../src/modules/brain/providers/bedrock-provider';
import { BedrockRuntimeClient, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';

jest.mock('@aws-sdk/client-bedrock-runtime');

describe('BedrockProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('BYOK Credential Handling', () => {
    it('throws reconnect_required when malformed BYOK JSON is provided', () => {
      const invalidConfigs = [
        'not-json',
        '{"accessKeyId": "foo"}', 
        '{"accessKeyId": "foo", "secretAccessKey": "bar"}',
        '{"region": "us-east-1"}'
      ];

      for (const config of invalidConfigs) {
        expect(() => new BedrockProvider(config)).toThrow(
          '[Bedrock Engine] reconnect_required: Invalid or incomplete custom AWS credentials format.'
        );
      }
    });

    it('initializes successfully with valid BYOK JSON', () => {
      expect(() => new BedrockProvider('{"accessKeyId":"test","secretAccessKey":"test","region":"us-east-1"}')).not.toThrow();
    });
  });

  describe('Tool Call Parsing', () => {
    it('parses tool calls from ConverseStreamCommand stream chunks correctly', async () => {
      const mockSend = jest.fn();
      (BedrockRuntimeClient as jest.Mock).mockImplementation(() => ({
        send: mockSend
      }));

      const provider = new BedrockProvider('{"accessKeyId":"test","secretAccessKey":"test","region":"us-east-1"}');
      
      async function* mockStream() {
        yield {
          contentBlockStart: {
            start: {
              toolUse: {
                toolUseId: 'tool-123',
                name: 'get_weather'
              }
            },
            contentBlockIndex: 1
          }
        };
        
        yield {
          contentBlockDelta: {
            delta: {
              toolUse: { input: '{"locati' }
            },
            contentBlockIndex: 1
          }
        };
        
        yield {
          contentBlockDelta: {
            delta: {
              toolUse: { input: 'on": "Seattle"}' }
            },
            contentBlockIndex: 1
          }
        };

        yield {
          messageStop: {
            stopReason: 'tool_use'
          }
        };
      }

      mockSend.mockResolvedValue({ stream: mockStream() });

      const response = await provider.complete({
        messages: [{ role: 'user', content: 'What is the weather in Seattle?' }]
      });

      expect(response.stopReason).toBe('tool_use');
      expect(response.toolCalls).toBeDefined();
      expect(response.toolCalls).toHaveLength(1);
      expect(response.toolCalls![0]).toEqual({
        id: 'tool-123',
        name: 'get_weather',
        input: { location: 'Seattle' }
      });
      
      expect(mockSend).toHaveBeenCalledTimes(1);
    });
  });
});
