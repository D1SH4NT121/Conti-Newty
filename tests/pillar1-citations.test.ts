import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { 
  SourceTracker, 
  extractCitations, 
  extractVerifiedCitations, 
  sanitizeHallucinatedCitations,
  verifyCitationAgainstDisk,
  computeContentHash 
} from '../src/modules/brain/source-grounding';
import path from 'path';
import fs from 'fs';

describe('Pillar 1.2: Deterministic Content-Hashed Citations & Hallucination Rejection', () => {
  const workspaceId = `test-ws-citations-${Date.now()}`;
  let storage: WorkspaceStorage;
  const testDir = path.join(process.cwd(), 'data', 'workspaces', workspaceId);

  beforeAll(async () => {
    storage = new WorkspaceStorage(workspaceId);
    await storage.writeFile(
      'policies/travel.md',
      '# Corporate Travel Policy\nLine 2: Employees must book economy flights.\nLine 3: Daily per-diem limit is $75 USD.\nLine 4: Approvals required for international trips.'
    );
    await storage.writeFile(
      'finance/budget.md',
      '# Q3 Budget\nMarketing: $50,000\nEngineering: $120,000\nOperations: $30,000'
    );
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('1. Captures citation with real file + line range + SHA-256 hash at read time and matches disk re-read', async () => {
    const sourceTracker = new SourceTracker();
    const filePath = 'policies/travel.md';

    // Simulate real tool read of travel.md
    const content = await storage.readFile(filePath);
    sourceTracker.recordAccess(filePath, content, 2, 3, { workspaceId, taskId: 'task-123' });

    const modelResponse = 'Per the company guidelines, employees must book economy and the per diem is $75 [source: policies/travel.md:2-3].';

    const citations = extractCitations(modelResponse, { sourceTracker, workspaceId, taskId: 'task-123' });
    expect(citations).toHaveLength(1);
    expect(citations[0].filePath).toBe('policies/travel.md');
    expect(citations[0].startLine).toBe(2);
    expect(citations[0].endLine).toBe(3);
    expect(citations[0].contentHash).toBeDefined();

    const verifiedList = extractVerifiedCitations(modelResponse, { sourceTracker, workspaceId, taskId: 'task-123' });
    expect(verifiedList).toHaveLength(1);
    const citation = verifiedList[0];

    // Independently re-read from disk and verify SHA-256 matches
    const diskCheck = await verifyCitationAgainstDisk(citation, storage);
    expect(diskCheck.valid).toBe(true);
    expect(diskCheck.diskHash).toBe(citation.contentHash);

    // Verify manual hash computation
    const rawDisk = await storage.readFile(filePath);
    const lines = rawDisk.split('\n');
    const expectedSnippet = lines.slice(1, 3).join('\n');
    expect(computeContentHash(expectedSnippet)).toBe(citation.contentHash);
  });

  it('2. Detects disk tampering if file content changes after read time', async () => {
    const sourceTracker = new SourceTracker();
    const filePath = 'finance/budget.md';

    const initialContent = await storage.readFile(filePath);
    sourceTracker.recordAccess(filePath, initialContent, 1, 3, { workspaceId, taskId: 'task-123' });

    const modelResponse = 'The budget is documented in [source: finance/budget.md:1-3].';
    const verifiedList = extractVerifiedCitations(modelResponse, { sourceTracker, workspaceId, taskId: 'task-123' });
    expect(verifiedList).toHaveLength(1);
    const citation = verifiedList[0];

    // Tamper with file on disk
    await storage.writeFile(filePath, '# Tampered Budget\nMarketing: $999,999\nEngineering: $0');

    // Verify disk check detects mismatch
    const diskCheck = await verifyCitationAgainstDisk(citation, storage);
    expect(diskCheck.valid).toBe(false);
    expect(diskCheck.diskHash).not.toBe(citation.contentHash);

    // Restore original file
    await storage.writeFile(filePath, initialContent);
  });

  it('3. Rejects and strips hallucinated citations for files that were NEVER read in the turn', async () => {
    const sourceTracker = new SourceTracker();

    // The agent ONLY read policies/travel.md
    const content = await storage.readFile('policies/travel.md');
    sourceTracker.recordAccess('policies/travel.md', content, 1, 2, { workspaceId, taskId: 'task-123' });

    // The model hallucinates an extra citation for unread 'confidential/acquisition_targets.md'
    const modelResponseWithHallucination = 
      'Travel guidelines are active [source: policies/travel.md:1-2]. We also plan to buy competitors [source: confidential/acquisition_targets.md:5-10].';

    // 1. extractCitations MUST exclude the hallucinated file
    const citations = extractCitations(modelResponseWithHallucination, { sourceTracker, workspaceId, taskId: 'task-123' });
    expect(citations).toHaveLength(1);
    expect(citations[0].filePath).toBe('policies/travel.md');
    expect(citations.some(c => c.filePath.includes('acquisition_targets'))).toBe(false);

    // 2. sanitizeHallucinatedCitations MUST strip the hallucinated bracket from the user-facing text
    const sanitizedText = sanitizeHallucinatedCitations(modelResponseWithHallucination, sourceTracker);
    expect(sanitizedText).toContain('[source: policies/travel.md:1-2]');
    expect(sanitizedText).not.toContain('confidential/acquisition_targets.md');

    // 3. extractVerifiedCitations MUST exclude hallucinated citations
    const verified = extractVerifiedCitations(modelResponseWithHallucination, { sourceTracker, workspaceId, taskId: 'task-123' });
    expect(verified).toHaveLength(1);
    expect(verified[0].filePath).toBe('policies/travel.md');
  });
});
