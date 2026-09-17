import { ProviderFactory } from '../src/modules/brain/providers/provider-factory';
import { AIClient } from '../src/modules/brain/ai-client';
import { DataAnonymizer } from '../src/modules/brain/anonymizer';

describe('Multi-Provider AI Engine & Data Anonymization', () => {
  describe('Provider Factory & Multi-Model Switching', () => {
    it('should list available providers (Claude, Gemini, OpenAI)', () => {
      const providers = ProviderFactory.getAvailableProviders();
      expect(providers.length).toBeGreaterThanOrEqual(3);
      expect(providers.map((p) => p.id)).toEqual(expect.arrayContaining(['claude', 'gemini', 'openai']));
    });

    it('should instantiate Claude provider by default', async () => {
      const client = new AIClient();
      expect(client.getProviderName()).toContain('Claude');

      const res = await client.complete({
        messages: [{ role: 'user', content: 'What is our mission?' }]
      });
      expect(res.content).toBeTruthy();
      expect(res.content).toContain('What is our mission?');
      expect(res.provider).toContain('Claude');
    });

    it('should switch to Gemini provider and return grounded navigation responses', async () => {
      const client = new AIClient('gemini');
      expect(client.getProviderName()).toContain('Gemini');

      const res = await client.complete({
        messages: [{ role: 'user', content: 'What did we do in Chicago?' }]
      });
      expect(res.content).toBeTruthy();
      expect(res.content).toContain('What did we do in Chicago?');
      expect(res.provider).toContain('Gemini');
    });

    it('should switch to OpenAI/Codex provider', async () => {
      const client = new AIClient('openai');
      expect(client.getProviderName()).toContain('OpenAI');

      const res = await client.complete({
        messages: [{ role: 'user', content: 'How do we onboard clients?' }]
      });
      expect(res.content).toBeTruthy();
      expect(res.content).toContain('How do we onboard clients?');
      expect(res.provider).toContain('OpenAI');
    });
  });

  describe('Data Anonymization Engine for External Sharing', () => {
    it('should scrub emails, phones, secrets, and financials', () => {
      const text = `
        Contact Alice at alice@edubaware.io or bob.smith@client.com, phone: (312) 555-0199.
        Secret key used: sk-ant-api03-abcdef1234567890abcdef1234567890.
        Current round target is $2.5M with burn of $65k/month.
        Our partner Acme Logistics has approved the contract.
      `;

      const result = DataAnonymizer.anonymize(text, {
        customEntities: ['Acme Logistics']
      });

      expect(result.sanitizedText).not.toContain('alice@edubaware.io');
      expect(result.sanitizedText).not.toContain('(312) 555-0199');
      expect(result.sanitizedText).not.toContain('sk-ant-api03-abcdef1234567890abcdef1234567890');
      expect(result.sanitizedText).not.toContain('$2.5M');
      expect(result.sanitizedText).not.toContain('Acme Logistics');

      expect(result.sanitizedText).toContain('[CONTACT_EMAIL_1]');
      expect(result.sanitizedText).toContain('[REDACTED_PHONE]');
      expect(result.sanitizedText).toContain('[REDACTED_SECRET_KEY]');
      expect(result.sanitizedText).toContain('[FINANCIAL_METRIC]');
      expect(result.sanitizedText).toContain('[CONFIDENTIAL_PARTNER]');
      expect(result.totalRedactions).toBeGreaterThanOrEqual(5);
    });

    it('should generate a sanitized markdown report header', () => {
      const report = DataAnonymizer.generateSanitizedReport(
        'Meeting with Founder: target $10M ARR by Q4. Contact founder@test.com'
      );
      expect(report).toContain('Confidential Document - Anonymized for External Sharing');
      expect(report).toContain('[CONTACT_EMAIL_1]');
      expect(report).toContain('[FINANCIAL_METRIC]');
    });
  });
});
