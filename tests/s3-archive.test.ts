import { WorkspaceArchiveManager } from '../src/modules/storage/workspace-archive';
import { WorkspaceStorage } from '../src/modules/storage/workspace-storage';
import path from 'path';
import fs from 'fs';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('S3 Workspace Archive Export/Import', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalBucket = process.env.ARCHIVE_BUCKET;
  const originalRegion = process.env.AWS_REGION;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.ARCHIVE_BUCKET = 'test-bucket';
    process.env.AWS_REGION = 'us-east-1';
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.env.ARCHIVE_BUCKET = originalBucket;
    process.env.AWS_REGION = originalRegion;
  });

  it('fails to construct if ARCHIVE_BUCKET is missing', () => {
    delete process.env.ARCHIVE_BUCKET;
    const storage = new WorkspaceStorage('test', path.resolve(__dirname, 'scratch/test-fail'));
    expect(() => new WorkspaceArchiveManager(storage)).toThrow('ARCHIVE_BUCKET is required for workspace archives.');
  });

  it('fails to construct if AWS_REGION is missing in non-test mode', () => {
    delete process.env.AWS_REGION;
    const storage = new WorkspaceStorage('test', path.resolve(__dirname, 'scratch/test-fail2'));
    expect(() => new WorkspaceArchiveManager(storage)).toThrow('AWS_REGION is required for workspace archives.');
  });

  it('exports zip to S3 and returns a presigned URL', async () => {
    const mockGetSignedUrl = getSignedUrl as jest.Mock;
    mockGetSignedUrl.mockResolvedValue('https://presigned.url/archive.zip');

    const storage = new WorkspaceStorage('test-export', path.resolve(__dirname, 'scratch/test-export'));
    fs.mkdirSync(storage.getWorkspaceRoot(), { recursive: true });
    fs.writeFileSync(path.join(storage.getWorkspaceRoot(), 'hello.txt'), 'world');

    const archive = new WorkspaceArchiveManager(storage);
    const url = await archive.exportZip();

    expect(url).toBe('https://presigned.url/archive.zip');
    
    expect(S3Client).toHaveBeenCalled();
    const mockS3ClientInstance = (S3Client as jest.Mock).mock.instances[0];
    expect(mockS3ClientInstance.send).toHaveBeenCalled();
    
    const putArgs = (PutObjectCommand as unknown as jest.Mock).mock.calls[0][0];
    expect(putArgs.Bucket).toBe('test-bucket');
    expect(putArgs.ContentType).toBe('application/zip');

    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(GetObjectCommand),
      { expiresIn: 900 }
    );
  });
});
