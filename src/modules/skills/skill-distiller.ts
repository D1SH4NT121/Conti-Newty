import { z } from 'zod';
import { prisma } from '../../db/client';
import { AIClient } from '../brain/ai-client';
import { CredentialService } from '../auth/credential-service';
import { config } from '../../config';
import { isSimulationAllowed } from '../brain/providers/types';

export const SkillCandidateSchema = z.object({
  stableId: z.string().optional(),
  title: z.string().min(1),
  category: z.string().optional(),
  rule: z.string().min(1),
  rationale: z.string().min(1),
  trigger: z.string().min(1),
  example: z.string().min(1),
  confidence: z.number().min(0).max(1).optional()
});

export type SkillCandidate = z.infer<typeof SkillCandidateSchema>;

export async function distillRedirect(redirectId: string, reviewerContext?: string): Promise<SkillCandidate> {
  const redirect = await prisma.agentRedirect.findUnique({
    where: { id: redirectId },
    include: { session: true }
  });

  if (!redirect) {
    throw new Error(`AgentRedirect not found: ${redirectId}`);
  }

  const promptText = `
Human instruction: "${redirect.instruction}"
Session goal: "${redirect.session.goal}"
Evidence: "${redirect.evidence || 'None'}"
Reviewer note: "${reviewerContext || 'None'}"

Extract a reusable company skill/rule based on this correction. Respond ONLY with valid JSON matching this schema:
{
  "title": string,
  "category": string,
  "rule": string,
  "rationale": string,
  "trigger": string,
  "example": string,
  "confidence": number between 0 and 1
}
`.trim();

  // If simulation mode or test environment
  if (isSimulationAllowed()) {
    return {
      title: `Rule: ${redirect.instruction.slice(0, 40)}`,
      category: 'Session Learning',
      rule: redirect.instruction,
      rationale: `Derived from human redirection in session "${redirect.session.title}"`,
      trigger: redirect.session.goal.slice(0, 50),
      example: redirect.instruction,
      confidence: 0.95
    };
  }

  try {
    const apiKey = await CredentialService.resolveApiKey(config.aiProvider, redirect.correctedById, redirect.workspaceId);
    const client = new AIClient(config.aiProvider, apiKey);

    const response = await client.complete({
      messages: [{ role: 'user', content: promptText }],
      systemPrompt: 'You are an expert organizational knowledge engineer that distills corrections into precise, atomic company rules. Return JSON only.'
    });

    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('LLM did not return a valid JSON object');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return SkillCandidateSchema.parse(parsed);
  } catch (err: any) {
    if (isSimulationAllowed()) {
      return {
        title: `Rule: ${redirect.instruction.slice(0, 40)}`,
        category: 'Session Learning',
        rule: redirect.instruction,
        rationale: `Derived from human redirection in session "${redirect.session.title}"`,
        trigger: redirect.session.goal.slice(0, 50),
        example: redirect.instruction,
        confidence: 0.9
      };
    }
    throw new Error(`Failed to distill skill from redirect: ${err.message}`);
  }
}
