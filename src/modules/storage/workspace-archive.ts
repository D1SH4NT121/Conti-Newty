import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import { WorkspaceStorage } from './workspace-storage';

export class WorkspaceArchiveManager {
  constructor(private storage: WorkspaceStorage) {}

  /**
   * Exports the entire workspace directory into a ZIP Buffer.
   */
  public async exportZip(): Promise<Buffer> {
    const zip = new AdmZip();
    const workspaceRoot = this.storage.getWorkspaceRoot();

    if (!fs.existsSync(workspaceRoot)) {
      return zip.toBuffer();
    }

    const addFilesRecursively = (currentDir: string, relativePrefix: string = '') => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          addFilesRecursively(fullPath, relPath);
        } else if (entry.isFile()) {
          const content = fs.readFileSync(fullPath);
          zip.addFile(relPath, content);
        }
      }
    };

    addFilesRecursively(workspaceRoot);
    return zip.toBuffer();
  }

  /**
   * Imports a ZIP archive into the workspace, safely extracting files and rejecting traversal attacks.
   */
  public async importZip(zipBuffer: Buffer): Promise<{ importedCount: number; files: string[] }> {
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();
    const importedFiles: string[] = [];

    for (const entry of zipEntries) {
      if (entry.isDirectory) {
        continue;
      }

      if (entry.entryName.includes('..')) {
        throw new Error(`Path traversal detected in zip archive entry: "${entry.entryName}"`);
      }

      const rawPath = entry.entryName.replace(/\\/g, '/').replace(/^\/+/, '');
      
      // Validate safe path within workspace boundaries
      const safePath = this.storage.resolveSafePath(rawPath);
      
      // Ensure target directory exists
      const dir = path.dirname(safePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content = entry.getData();
      fs.writeFileSync(safePath, content);
      importedFiles.push(rawPath);
    }

    return {
      importedCount: importedFiles.length,
      files: importedFiles
    };
  }
}
