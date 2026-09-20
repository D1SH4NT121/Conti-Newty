/**
 * Tribal Memory Tests — unit tests for core functions
 *
 * Cases:
 *   1. createEntry() — validates and creates entry with searchText
 *   2. listEntries() — returns entries paginated, newest first
 *   3. searchEntries() — searches by title/content/tags
 *   4. updateEntry() — updates entry and regenerates searchText
 *   5. deleteEntry() — removes entry
 *   6. exportToBrain() — generates index + individual files
 */

import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import {
  createEntry,
  listEntries,
  searchEntries,
  getEntry,
  updateEntry,
  deleteEntry,
  exportToBrain,
} from '../src/modules/tribal-memory/tribal-memory';

// ── Setup ────────────────────────────────────────────────────────────────────

const testDir = path.resolve(process.cwd(), 'test-tribal-memory');
let storage: WorkspaceStorage;
let testUser: any;
let testWorkspace: any;

beforeAll(async () => {
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  await clearDatabase();

  const org = await prisma.organization.create({ data: { name: 'Tribal Test Org' } });
  testUser = await prisma.user.create({
    data: { email: 'tribal-test@test.com', name: 'Tribal Tester', passwordHash: 'x' },
  });
  testWorkspace = await prisma.workspace.create({
    data: { name: 'Tribal Test WS', organizationId: org.id },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: testWorkspace.id, userId: testUser.id, role: 'member' },
  });

  storage = new WorkspaceStorage(testWorkspace.id, testDir);
});

afterAll(async () => {
  try {
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  } catch { /* Windows lock */ }
  await clearDatabase();
  await prisma.$disconnect();
});

// ── Test 1: Create Entry ────────────────────────────────────────────────────

describe('createEntry()', () => {
  it('creates entry with searchText denormalization', async () => {
    const entry = await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'Decision: Use TypeScript',
      content: 'We decided to use TypeScript for type safety.',
      tags: ['decision', 'architecture'],
    });

    expect(entry.id).toBeDefined();
    expect(entry.title).toBe('Decision: Use TypeScript');
    expect(entry.content).toBe('We decided to use TypeScript for type safety.');
    expect(entry.tags).toEqual(['decision', 'architecture']);
    expect(entry.authorName).toBe('Tribal Tester');

    // Verify searchText was denormalized in DB
    const dbEntry = await prisma.tribalMemoryEntry.findUnique({
      where: { id: entry.id },
    });
    expect(dbEntry!.searchText).toContain('decision');
    expect(dbEntry!.searchText).toContain('typescript');
  });

  it('stores tags as JSON array', async () => {
    const entry = await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'Best Practice: Code Review',
      content: 'Always review before merging.',
      tags: ['best-practice', 'process'],
    });

    const dbEntry = await prisma.tribalMemoryEntry.findUnique({
      where: { id: entry.id },
    });
    expect(dbEntry!.tags).toBe(JSON.stringify(['best-practice', 'process']));
  });
});

// ── Test 2: List Entries ────────────────────────────────────────────────────

describe('listEntries()', () => {
  it('lists entries newest first with pagination', async () => {
    // Create 3 entries
    const entry1 = await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'Entry 1',
      content: 'First entry',
      tags: [],
    });

    // Add delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));

    const entry2 = await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'Entry 2',
      content: 'Second entry',
      tags: [],
    });

    const result = await listEntries({
      workspaceId: testWorkspace.id,
      limit: 10,
      offset: 0,
    });

    expect(result.entries.length).toBeGreaterThanOrEqual(2);
    expect(result.entries[0].title).toBe('Entry 2'); // Newest first
    expect(result.total).toBeGreaterThanOrEqual(2);
  });

  it('respects limit and offset', async () => {
    const result1 = await listEntries({
      workspaceId: testWorkspace.id,
      limit: 1,
      offset: 0,
    });

    const result2 = await listEntries({
      workspaceId: testWorkspace.id,
      limit: 1,
      offset: 1,
    });

    expect(result1.entries.length).toBe(1);
    expect(result2.entries.length).toBeGreaterThanOrEqual(1);
    if (result1.total > 1) {
      expect(result1.entries[0].id).not.toBe(result2.entries[0].id);
    }
  });
});

// ── Test 3: Search Entries ──────────────────────────────────────────────────

describe('searchEntries()', () => {
  beforeEach(async () => {
    await prisma.tribalMemoryEntry.deleteMany({
      where: { workspaceId: testWorkspace.id },
    });
  });

  it('searches by title', async () => {
    await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'Scaling PostgreSQL',
      content: 'Tips for scaling database',
      tags: [],
    });

    const result = await searchEntries({
      workspaceId: testWorkspace.id,
      query: 'PostgreSQL',
    });

    expect(result.entries.length).toBeGreaterThanOrEqual(1);
    expect(result.entries.some((e) => e.title.includes('PostgreSQL'))).toBe(true);
  });

  it('searches by content', async () => {
    await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'Database Performance',
      content: 'Use indexing to speed up queries',
      tags: [],
    });

    const result = await searchEntries({
      workspaceId: testWorkspace.id,
      query: 'indexing',
    });

    expect(result.entries.length).toBeGreaterThanOrEqual(1);
    expect(result.entries.some((e) => e.content.includes('indexing'))).toBe(true);
  });

  it('searches case-insensitively', async () => {
    await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'API Design',
      content: 'RESTful principles',
      tags: [],
    });

    const result = await searchEntries({
      workspaceId: testWorkspace.id,
      query: 'restful',
    });

    expect(result.entries.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Test 4: Update Entry ────────────────────────────────────────────────────

describe('updateEntry()', () => {
  it('updates entry and regenerates searchText', async () => {
    const entry = await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'Original Title',
      content: 'Original content',
      tags: ['tag1'],
    });

    const updated = await updateEntry({
      entryId: entry.id,
      title: 'Updated Title',
      content: 'Updated content',
      tags: ['tag2', 'tag3'],
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.content).toBe('Updated content');
    expect(updated.tags).toEqual(['tag2', 'tag3']);

    // Verify searchText was regenerated
    const dbEntry = await prisma.tribalMemoryEntry.findUnique({
      where: { id: entry.id },
    });
    expect(dbEntry!.searchText).toContain('updated title');
    expect(dbEntry!.searchText).toContain('tag2');
    expect(dbEntry!.searchText).not.toContain('tag1');
  });

  it('preserves unmodified fields', async () => {
    const entry = await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'Title',
      content: 'Content with important details',
      tags: ['important'],
    });

    const updated = await updateEntry({
      entryId: entry.id,
      title: 'New Title',
      // content and tags unchanged
    });

    expect(updated.title).toBe('New Title');
    expect(updated.content).toBe('Content with important details');
    expect(updated.tags).toEqual(['important']);
  });
});

// ── Test 5: Delete Entry ────────────────────────────────────────────────────

describe('deleteEntry()', () => {
  it('deletes entry', async () => {
    const entry = await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'To Delete',
      content: 'This will be deleted',
      tags: [],
    });

    await deleteEntry(entry.id);

    const found = await getEntry(entry.id);
    expect(found).toBeNull();
  });
});

// ── Test 6: Export to Brain ─────────────────────────────────────────────────

describe('exportToBrain()', () => {
  beforeEach(async () => {
    // Clear test directory
    if (fs.existsSync(path.join(testDir, 'exports'))) {
      try {
        fs.rmSync(path.join(testDir, 'exports'), { recursive: true, force: true, maxRetries: 3 });
      } catch {
        // ignore transient lock on Windows
      }
    }
  });

  it('exports entries to Brain markdown files', async () => {
    // Create test storage in subdirectory
    const exportDir = path.join(testDir, 'exports');
    fs.mkdirSync(exportDir, { recursive: true });
    const exportStorage = new WorkspaceStorage(testWorkspace.id, exportDir);

    // Clear old entries
    await prisma.tribalMemoryEntry.deleteMany({
      where: { workspaceId: testWorkspace.id },
    });

    // Create test entries
    await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'Decision: Use TypeScript',
      content: 'Type safety benefits',
      tags: ['decision', 'architecture'],
    });

    await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'Best Practice: Code Review',
      content: 'Always review before merge',
      tags: ['best-practice'],
    });

    const result = await exportToBrain({
      workspaceId: testWorkspace.id,
      storage: exportStorage,
      targetPath: 'connectors/tribal-memory',
    });

    expect(result.success).toBe(true);
    expect(result.entriesExported).toBe(2);
    expect(result.fileCount).toBe(3); // 2 entries + 1 index

    // Verify index file exists and contains entries
    const indexPath = path.join(exportDir, 'connectors', 'tribal-memory', 'index.md');
    expect(fs.existsSync(indexPath)).toBe(true);

    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    expect(indexContent).toContain('Tribal Memory Index');
    expect(indexContent).toContain('decision');
    expect(indexContent).toContain('best-practice');
    expect(indexContent).toContain('Decision: Use TypeScript');
    expect(indexContent).toContain('Best Practice: Code Review');
  });

  it('generates individual entry files with metadata', async () => {
    const exportDir = path.join(testDir, 'exports2');
    fs.mkdirSync(exportDir, { recursive: true });
    const exportStorage = new WorkspaceStorage(testWorkspace.id, exportDir);

    await prisma.tribalMemoryEntry.deleteMany({
      where: { workspaceId: testWorkspace.id },
    });

    await createEntry({
      workspaceId: testWorkspace.id,
      userId: testUser.id,
      title: 'Test Entry',
      content: 'Entry content',
      tags: ['test'],
    });

    await exportToBrain({
      workspaceId: testWorkspace.id,
      storage: exportStorage,
      targetPath: 'tribal',
    });

    // Find the entry file
    const tribalDir = path.join(exportDir, 'tribal');
    const files = fs.readdirSync(tribalDir);
    const entryFile = files.find((f) => f.startsWith('202') && f.endsWith('.md') && f !== 'index.md');

    expect(entryFile).toBeDefined();

    const entryContent = fs.readFileSync(path.join(tribalDir, entryFile!), 'utf-8');
    expect(entryContent).toContain('# Test Entry');
    expect(entryContent).toContain('**Author:**');
    expect(entryContent).toContain('**Created:**');
    expect(entryContent).toContain('**Tags:** test');
    expect(entryContent).toContain('Entry content');
  });
});
