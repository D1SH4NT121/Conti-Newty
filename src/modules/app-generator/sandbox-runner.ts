import http from 'http';
import fs from 'fs';
import path from 'path';
import { AddressInfo } from 'net';

export interface RunningSandbox {
  appWorkspaceId: string;
  port: number;
  server: http.Server;
  dir: string;
  url: string;
}

export class SandboxRunner {
  private activeSandboxes: Map<string, RunningSandbox> = new Map();

  public async startSandbox(
    appWorkspaceId: string,
    appFilesDir: string
  ): Promise<{ port: number; url: string }> {
    // If already running, stop old instance first
    if (this.activeSandboxes.has(appWorkspaceId)) {
      await this.stopSandbox(appWorkspaceId);
    }

    const server = http.createServer((req, res) => {
      const requestedUrl = req.url === '/' || !req.url ? '/index.html' : req.url.split('?')[0];
      const safeRelative = path.normalize(requestedUrl).replace(/^(\.\.[/\\])+/, '');
      const filePath = path.join(appFilesDir, safeRelative);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.svg': 'image/svg+xml'
        };

        const contentType = mimeTypes[ext] || 'text/plain';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found in Sandbox');
      }
    });

    return new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        const port = address.port;
        // Assumes direct access; will break behind a reverse proxy without path-based routing — revisit before Docker deployment.
        const url = `http://localhost:${port}`;

        this.activeSandboxes.set(appWorkspaceId, {
          appWorkspaceId,
          port,
          server,
          dir: appFilesDir,
          url
        });

        resolve({ port, url });
      });

      server.on('error', (err) => {
        reject(err);
      });
    });
  }

  public async stopSandbox(appWorkspaceId: string): Promise<void> {
    const sandbox = this.activeSandboxes.get(appWorkspaceId);
    if (sandbox) {
      await new Promise<void>((resolve) => {
        sandbox.server.close(() => resolve());
      });
      this.activeSandboxes.delete(appWorkspaceId);
    }
  }

  public isRunning(appWorkspaceId: string): boolean {
    return this.activeSandboxes.has(appWorkspaceId);
  }

  public getSandboxUrl(appWorkspaceId: string): string | null {
    const sandbox = this.activeSandboxes.get(appWorkspaceId);
    return sandbox ? sandbox.url : null;
  }

  public stopAll(): void {
    for (const [_id, sandbox] of this.activeSandboxes.entries()) {
      try {
        sandbox.server.close();
      } catch {
        // ignore
      }
    }
    this.activeSandboxes.clear();
  }
}
