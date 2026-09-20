import fs from 'fs';
import path from 'path';
import { validateWorkspacePath, normalizePath } from './path-validator';

export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  updatedAt: Date;
}

export class ReadOnlyPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadOnlyPathError';
  }
}

/**
 * Converts a simple glob pattern to a RegExp
 */
function globToRegex(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, '/');
  let regexStr = '^';
  let i = 0;
  while (i < normalized.length) {
    const char = normalized[i];
    if (char === '*' && normalized[i + 1] === '*') {
      if (normalized[i + 2] === '/') {
        regexStr += '(?:.*/)?';
        i += 3;
      } else {
        regexStr += '.*';
        i += 2;
      }
    } else if (char === '*') {
      regexStr += '[^/]*';
      i += 1;
    } else if (char === '?') {
      regexStr += '[^/]';
      i += 1;
    } else if (['.', '+', '^', '$', '(', ')', '[', ']', '{', '}', '|', '\\'].includes(char)) {
      regexStr += '\\' + char;
      i += 1;
    } else {
      regexStr += char;
      i += 1;
    }
  }
  regexStr += '$';
  return new RegExp(regexStr);
}

export class WorkspaceStorage {
  public readonly workspaceId: string;
  public readonly workspaceRoot: string;
  private readOnlyPatterns: string[] = [];

  constructor(workspaceId: string, customRoot?: string) {
    this.workspaceId = workspaceId;
    this.workspaceRoot = customRoot
      ? path.resolve(customRoot)
      : path.resolve(process.cwd(), 'workspaces', workspaceId);

    if (!fs.existsSync(this.workspaceRoot)) {
      fs.mkdirSync(this.workspaceRoot, { recursive: true });
    }
  }

  public getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  public setReadOnlyPatterns(patterns: string[]): void {
    this.readOnlyPatterns = patterns;
  }

  public getReadOnlyPatterns(): string[] {
    return [...this.readOnlyPatterns];
  }

  public resolveSafePath(filePath: string): string {
    return validateWorkspacePath(this.workspaceRoot, filePath);
  }

  public isReadOnlyPath(filePath: string): boolean {
    const absPath = this.resolveSafePath(filePath);
    const relative = normalizePath(path.relative(this.workspaceRoot, absPath));

    for (const pattern of this.readOnlyPatterns) {
      const regex = globToRegex(pattern);
      if (regex.test(relative)) {
        return true;
      }
    }
    return false;
  }

  public async fileExists(filePath: string): Promise<boolean> {
    const absPath = this.resolveSafePath(filePath);
    return fs.existsSync(absPath);
  }

  public async readFile(filePath: string): Promise<string> {
    const absPath = this.resolveSafePath(filePath);
    return fs.promises.readFile(absPath, 'utf-8');
  }

  public async writeFile(filePath: string, content: string | Buffer): Promise<void> {
    if (this.isReadOnlyPath(filePath)) {
      throw new ReadOnlyPathError(`Cannot write to read-only path: "${filePath}"`);
    }

    const absPath = this.resolveSafePath(filePath);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await fs.promises.writeFile(absPath, content);
  }

  public async createFile(filePath: string, content: string | Buffer = ''): Promise<void> {
    if (this.isReadOnlyPath(filePath)) {
      throw new ReadOnlyPathError(`Cannot create file at read-only path: "${filePath}"`);
    }

    const absPath = this.resolveSafePath(filePath);
    const dir = path.dirname(absPath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await fs.promises.writeFile(absPath, content);
  }

  public async deleteFile(filePath: string): Promise<void> {
    if (this.isReadOnlyPath(filePath)) {
      throw new ReadOnlyPathError(`Cannot delete read-only path: "${filePath}"`);
    }

    const absPath = this.resolveSafePath(filePath);
    if (fs.existsSync(absPath)) {
      const stat = await fs.promises.stat(absPath);
      if (stat.isDirectory()) {
        await fs.promises.rm(absPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(absPath);
      }
    }
  }

  public async listDirectory(relativeDirPath = ''): Promise<FileInfo[]> {
    const targetDir = this.resolveSafePath(relativeDirPath);
    if (!fs.existsSync(targetDir)) {
      return [];
    }

    const entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
    const results: FileInfo[] = [];

    for (const entry of entries) {
      const entryAbsPath = path.join(targetDir, entry.name);
      const stat = await fs.promises.stat(entryAbsPath);
      const relPath = normalizePath(path.relative(this.workspaceRoot, entryAbsPath));

      results.push({
        name: entry.name,
        path: relPath,
        isDirectory: entry.isDirectory(),
        size: stat.size,
        updatedAt: stat.mtime
      });
    }

    return results;
  }
}
