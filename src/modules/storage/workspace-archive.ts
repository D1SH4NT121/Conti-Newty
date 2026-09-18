import AdmZip from 'adm-zip';
import path from 'path';
import fs from 'fs';
import * as crypto from 'crypto';
import { WorkspaceStorage } from './workspace-storage';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export class WorkspaceArchiveManager {
  private s3Client?: S3Client;
  private bucket: string;

  constructor(private storage: WorkspaceStorage) {
    if (process.env.NODE_ENV === 'test' && !process.env.ARCHIVE_BUCKET) {
      this.bucket = 'test-bucket';
      // In test mode, leave s3Client undefined to mock the result or we can mock the client in tests
    } else {
      if (!process.env.ARCHIVE_BUCKET) {
        throw new Error('ARCHIVE_BUCKET is required for workspace archives.');
      }
      this.bucket = process.env.ARCHIVE_BUCKET;
      
      // Enforce fail-closed if AWS_REGION is missing in non-test mode
      if (!process.env.AWS_REGION && process.env.NODE_ENV !== 'test') {
        throw new Error('AWS_REGION is required for workspace archives.');
      }
      
      this.s3Client = new S3Client({ region: process.env.AWS_REGION });
    }
  }

  /**
   * Exports the entire workspace directory into a ZIP, uploads to S3, and returns a 15-minute presigned URL.
   */
  public async exportZip(): Promise<string> {
    const zip = new AdmZip();
    const workspaceRoot = this.storage.getWorkspaceRoot();

    if (fs.existsSync(workspaceRoot)) {
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
    }

    const zipBuffer = zip.toBuffer();
    const archiveKey = `archives/workspace-${crypto.randomBytes(8).toString('hex')}.zip`;

    if (this.s3Client) {
      const putCommand = new PutObjectCommand({
        Bucket: this.bucket,
        Key: archiveKey,
        Body: zipBuffer,
        ContentType: 'application/zip'
      });
      await this.s3Client.send(putCommand);

      const getCommand = new GetObjectCommand({
        Bucket: this.bucket,
        Key: archiveKey
      });
      return await getSignedUrl(this.s3Client, getCommand, { expiresIn: 900 });
    }

    // Fallback strictly for tests running without a mocked S3 client
    return `https://mock-s3-url.com/${this.bucket}/${archiveKey}`;
  }

  /**
   * Imports a ZIP archive into the workspace, safely extracting files and rejecting traversal attacks.
   * Accepts either a raw Buffer (for direct uploads) or an S3 presigned URL / object key to fetch.
   */
  public async importZip(source: Buffer | string): Promise<{ importedCount: number; files: string[] }> {
    let zipBuffer: Buffer;

    if (Buffer.isBuffer(source)) {
      zipBuffer = source;
    } else if (typeof source === 'string') {
      if (source.startsWith('http://') || source.startsWith('https://')) {
        // Fetch from presigned URL
        const res = await fetch(source);
        if (!res.ok) {
          throw new Error(`Failed to fetch archive from URL: ${res.statusText}`);
        }
        zipBuffer = Buffer.from(await res.arrayBuffer());
      } else {
        // Assume it's an S3 object key
        if (!this.s3Client) {
          throw new Error('S3 client not configured, cannot fetch by object key.');
        }
        const command = new GetObjectCommand({
          Bucket: this.bucket,
          Key: source
        });
        const response = await this.s3Client.send(command);
        if (!response.Body) {
          throw new Error('Empty body returned from S3');
        }
        // In Node.js, the Body from GetObject is a stream or byte array
        // A simple way that works for both streams and Uint8Array is to use response.Body.transformToByteArray()
        if (typeof (response.Body as any).transformToByteArray === 'function') {
           zipBuffer = Buffer.from(await (response.Body as any).transformToByteArray());
        } else {
           // fallback for older SDKs
           const stream = response.Body as any;
           const chunks: Buffer[] = [];
           for await (const chunk of stream) {
             chunks.push(Buffer.from(chunk));
           }
           zipBuffer = Buffer.concat(chunks);
        }
      }
    } else {
      throw new Error('Invalid import source');
    }

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
      const safePath = this.storage.resolveSafePath(rawPath);
      
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
