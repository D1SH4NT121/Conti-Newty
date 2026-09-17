import fs from 'fs';
import path from 'path';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import { validateWorkspacePath } from '../src/modules/storage/path-validator';

describe('Storage Module & Workspace Security Sandbox', () => {
  const testWorkspaceDir = path.resolve(process.cwd(), 'test-workspace-sandbox');
  let storage: WorkspaceStorage;

  beforeAll(async () => {
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testWorkspaceDir, { recursive: true });
  });

  afterAll(async () => {
    if (fs.existsSync(testWorkspaceDir)) {
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    storage = new WorkspaceStorage('test-workspace', testWorkspaceDir);
  });

  describe('Path Traversal Prevention', () => {
    it('should resolve safe paths within workspace root', () => {
      const resolved = validateWorkspacePath(testWorkspaceDir, 'docs/readme.md');
      expect(resolved).toBe(path.resolve(testWorkspaceDir, 'docs/readme.md'));
    });

    it('should reject path traversal attempts with ../', () => {
      expect(() => {
        validateWorkspacePath(testWorkspaceDir, '../../etc/passwd');
      }).toThrow(/path traversal/i);
    });

    it('should reject absolute paths outside the workspace root', () => {
      const outsidePath = path.resolve(testWorkspaceDir, '..', 'secret.txt');
      expect(() => {
        validateWorkspacePath(testWorkspaceDir, outsidePath);
      }).toThrow(/path traversal/i);
    });
  });

  describe('File Operations', () => {
    it('should create and read files correctly', async () => {
      await storage.createFile('notes/test.txt', 'Hello Workbench');
      const content = await storage.readFile('notes/test.txt');
      expect(content).toBe('Hello Workbench');
    });

    it('should overwrite files with writeFile', async () => {
      await storage.writeFile('notes/test.txt', 'Updated Content');
      const content = await storage.readFile('notes/test.txt');
      expect(content).toBe('Updated Content');
    });

    it('should list directory contents with metadata', async () => {
      await storage.createFile('src/index.ts', 'console.log("hi");');
      await storage.createFile('src/utils.ts', 'export const a = 1;');

      const list = await storage.listDirectory('src');
      expect(list.length).toBe(2);
      const names = list.map((item) => item.name);
      expect(names).toContain('index.ts');
      expect(names).toContain('utils.ts');
    });

    it('should delete a file', async () => {
      await storage.createFile('to-delete.txt', 'temp');
      expect(await storage.fileExists('to-delete.txt')).toBe(true);

      await storage.deleteFile('to-delete.txt');
      expect(await storage.fileExists('to-delete.txt')).toBe(false);
    });
  });

  describe('Read-Only Path Enforcement', () => {
    it('should prevent modifications to configured read-only paths', async () => {
      storage.setReadOnlyPatterns(['protected/**', 'config/*.json']);
      await storage.createFile('normal.txt', 'allowed');

      // Writing to normal file should work
      await storage.writeFile('normal.txt', 'updated allowed');

      // Writing to protected path should fail
      await expect(
        storage.writeFile('protected/system.lock', 'danger')
      ).rejects.toThrow(/read-only/i);

      await expect(
        storage.createFile('config/app.json', '{}')
      ).rejects.toThrow(/read-only/i);

      await expect(
        storage.deleteFile('protected/system.lock')
      ).rejects.toThrow(/read-only/i);
    });
  });
});
