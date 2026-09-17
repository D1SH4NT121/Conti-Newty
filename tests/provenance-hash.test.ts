import crypto from 'crypto';
import {
  computeContentHash,
  extractSnippet,
  createVerifiedCitation,
  extractCitations,
  extractVerifiedCitations,
  SourceTracker,
  VerifiedSourceCitation
} from '../src/modules/brain/source-grounding';

describe('Cryptographic Content-Hashed Provenance & Verified Citations', () => {
  const sampleDocument = `# SOP-004: Production Incident Response
1. Severity 1 (Critical Outage):
   - Acknowledge within 5 minutes.
   - Open war room thread on Workbench.
   - Keep status communication hourly.
2. Mitigation First:
   - Revert recent changes or switch traffic before deep debugging.
3. Post-Mortem:
   - Deliver root cause analysis within 48 hours.`;

  it('1. Given known source content, SHA-256 matches expected value', () => {
    const rawSnippet = '1. Severity 1 (Critical Outage):\n   - Acknowledge within 5 minutes.';
    const expectedHash = crypto.createHash('sha256').update(rawSnippet).digest('hex');

    const computed = computeContentHash(rawSnippet);
    expect(computed).toBe(expectedHash);
    expect(computed).toHaveLength(64); // Standard SHA-256 hex length
  });

  it('2. Given a known line range, startLine, endLine, and snippet are exact', () => {
    // Lines 2 to 5 in sampleDocument
    const snippet = extractSnippet(sampleDocument, 2, 5);
    const expectedLines = [
      '1. Severity 1 (Critical Outage):',
      '   - Acknowledge within 5 minutes.',
      '   - Open war room thread on Workbench.',
      '   - Keep status communication hourly.'
    ].join('\n');

    expect(snippet).toBe(expectedLines);
  });

  it('3. Citation contains all required verified provenance properties', () => {
    const snippet = extractSnippet(sampleDocument, 6, 7);
    const citation: VerifiedSourceCitation = createVerifiedCitation({
      filePath: 'docs/sop-incident-response.md',
      startLine: 6,
      endLine: 7,
      snippet,
      workspaceId: 'ws-test-123',
      taskId: 'task-abc-456'
    });

    expect(citation.filePath).toBe('docs/sop-incident-response.md');
    expect(citation.startLine).toBe(6);
    expect(citation.endLine).toBe(7);
    expect(citation.snippet).toBe(snippet);
    expect(citation.workspaceId).toBe('ws-test-123');
    expect(citation.taskId).toBe('task-abc-456');
    expect(citation.contentHash).toBe(crypto.createHash('sha256').update(snippet).digest('hex'));
    expect(citation.retrievedAt).toBeDefined();
    expect(new Date(citation.retrievedAt).getTime()).not.toBeNaN();
  });

  it('4. Modifying the source changes the hash deterministically', () => {
    const originalSnippet = '2. Mitigation First:\n   - Revert recent changes.';
    const modifiedSnippet = '2. Mitigation First:\n   - Revert recent changes IMMEDIATELY.';

    const originalHash = computeContentHash(originalSnippet);
    const modifiedHash = computeContentHash(modifiedSnippet);

    expect(originalHash).not.toBe(modifiedHash);
  });

  it('5. SourceTracker records full content and generates verified citations with contentHash', () => {
    const tracker = new SourceTracker();
    tracker.recordAccess(
      'docs/sop-incident-response.md',
      sampleDocument,
      2,
      5,
      { workspaceId: 'ws-1', taskId: 'task-1' }
    );

    const citations = tracker.getVerifiedCitations('ws-1', 'task-1');
    expect(citations.length).toBe(1);

    const cit = citations[0];
    expect(cit.filePath).toBe('docs/sop-incident-response.md');
    expect(cit.startLine).toBe(2);
    expect(cit.endLine).toBe(5);
    expect(cit.contentHash).toBe(computeContentHash(cit.snippet));
  });

  it('6. extractVerifiedCitations extracts and hashes slice from formatted AI output', () => {
    const tracker = new SourceTracker();
    tracker.recordAccess(
      'docs/sop-incident-response.md',
      sampleDocument,
      undefined,
      undefined,
      { workspaceId: 'ws-prod', taskId: 'task-prod' }
    );

    const aiOutput = 'Based on [source: docs/sop-incident-response.md:2-5], acknowledge critical outages within 5 minutes.';
    const verified = extractVerifiedCitations(aiOutput, {
      sourceTracker: tracker,
      workspaceId: 'ws-prod',
      taskId: 'task-prod'
    });

    expect(verified.length).toBe(1);
    expect(verified[0].filePath).toBe('docs/sop-incident-response.md');
    expect(verified[0].startLine).toBe(2);
    expect(verified[0].endLine).toBe(5);
    expect(verified[0].snippet).toContain('1. Severity 1 (Critical Outage):');
    expect(verified[0].contentHash).toBe(computeContentHash(verified[0].snippet));
  });
});
