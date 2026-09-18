import { ProviderFactory } from '../src/modules/brain/providers/provider-factory';
import { ClaudeProvider } from '../src/modules/brain/providers/claude-provider';
import { OpenAIProvider } from '../src/modules/brain/providers/openai-provider';
import { GeminiProvider } from '../src/modules/brain/providers/gemini-provider';
import { BedrockProvider } from '../src/modules/brain/providers/bedrock-provider';

describe('Pillar 1.3: Real Provider Contract Parity & Simulation Guard', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalAllowSim = process.env.ALLOW_AI_SIMULATION;

  afterEach(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_AI_SIMULATION;
  });

  afterAll(() => {
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_AI_SIMULATION;
  });

  it('1. Rejects unconfigured provider calls with explicit error when simulation is not permitted', async () => {
    // Explicitly disable simulation
    process.env.ALLOW_AI_SIMULATION = 'false';

    const claude = new ClaudeProvider();
    const openai = new OpenAIProvider();
    const gemini = new GeminiProvider();
    const bedrock = new BedrockProvider();

    await expect(
      claude.complete({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow(/Unconfigured provider: Valid API key is required/);

    await expect(
      openai.complete({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow(/Unconfigured provider: Valid API key is required/);

    await expect(
      gemini.complete({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow(/Unconfigured provider: Valid API key is required/);

    await expect(
      bedrock.complete({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow(/Unconfigured provider: Valid API key is required/);
  });

  it('2. Rejects simulation mode if NODE_ENV is production even if ALLOW_AI_SIMULATION is true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_AI_SIMULATION = 'true';

    const claude = new ClaudeProvider();
    await expect(
      claude.complete({ messages: [{ role: 'user', content: 'hello' }] })
    ).rejects.toThrow(/Simulation mode is forbidden outside NODE_ENV=test/);
  });

  it('3. In test environment with ALLOW_AI_SIMULATION=true, all providers execute cleanly without canned fake citations', async () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_AI_SIMULATION = 'true';

    const providers = [
      new ClaudeProvider(),
      new OpenAIProvider(),
      new GeminiProvider(),
      new BedrockProvider()
    ];

    for (const provider of providers) {
      const response = await provider.complete({
        messages: [{ role: 'user', content: 'Summarize our infrastructure requirements' }]
      });

      expect(response.content).toBeDefined();
      expect(response.stopReason).toBeDefined();
      expect(response.provider).toBe(provider.name);
      // Verify no hardcoded fake citation hallucinations
      expect(response.content).not.toContain('docs/fundraising_status.md');
      expect(response.content).not.toContain('sops/production_deployment.md');
      expect(response.content).not.toContain('notes/high_tea_sessions.md');
    }
  });

  it('4. ProviderFactory instantiates all available providers and lists metadata correctly', () => {
    const list = ProviderFactory.getAvailableProviders();
    expect(list).toHaveLength(4);
    expect(list.map((p) => p.id)).toEqual(['claude', 'gemini', 'openai', 'bedrock']);

    const claude = ProviderFactory.createProvider('claude');
    expect(claude.providerType).toBe('claude');

    const openai = ProviderFactory.createProvider('openai');
    expect(openai.providerType).toBe('openai');

    const gemini = ProviderFactory.createProvider('gemini');
    expect(gemini.providerType).toBe('gemini');

    const bedrock = ProviderFactory.createProvider('bedrock');
    expect(bedrock.providerType).toBe('bedrock');
  });
});
