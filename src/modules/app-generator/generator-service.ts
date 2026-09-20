import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../../db/client';
import { WorkspaceStorage } from '../storage/workspace-storage';
import { SandboxRunner } from './sandbox-runner';
import { validateGeneratedCode } from './validator';
import { generateDashboardTemplate, generatePortalTemplate } from './templates';

function generateSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}

export interface GenerateAppParams {
  workspaceId: string;
  userId: string;
  prompt: string;
  appType?: 'dashboard' | 'portal' | 'custom' | string;
  appName?: string;
}

export interface GeneratedAppResult {
  appWorkspaceId: string;
  name: string;
  slug: string;
  deploymentId: string;
  url: string;
  previewUrl: string;
  shareUrl: string;
  files: Record<string, string>;
  status: string;
}

export class AppGeneratorService {
  private storage: WorkspaceStorage;
  private sandboxRunner: SandboxRunner;

  constructor(storage: WorkspaceStorage, sandboxRunner?: SandboxRunner) {
    this.storage = storage;
    this.sandboxRunner = sandboxRunner || new SandboxRunner();
  }

  public async generateAppFromKnowledge(
    params: GenerateAppParams
  ): Promise<GeneratedAppResult> {
    const { workspaceId, userId: _userId, prompt, appType = 'dashboard', appName } = params;

    // 1. Gather domain context from workspace files
    const workspaceKnowledgeData: any = {};
    try {
      const files = await this.storage.listDirectory();
      for (const file of files) {
        if (!file.isDirectory && (file.name.endsWith('.json') || file.name.endsWith('.md'))) {
          const content = await this.storage.readFile(file.path);
          if (file.name.endsWith('.json')) {
            try {
              workspaceKnowledgeData[file.name] = JSON.parse(content);
            } catch {
              workspaceKnowledgeData[file.name] = content;
            }
          } else {
            workspaceKnowledgeData[file.name] = content;
          }
        }
      }
    } catch {
      // Continue even if file read has minor issue
    }

    const name = appName || (prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt);

    // 2. Select and generate template
    let generatedFiles: Record<string, string>;
    if (appType === 'portal' || prompt.toLowerCase().includes('portal') || prompt.toLowerCase().includes('doc')) {
      generatedFiles = generatePortalTemplate({
        title: name,
        description: prompt,
        data: workspaceKnowledgeData
      });
    } else {
      generatedFiles = generateDashboardTemplate({
        title: name,
        description: prompt,
        data: workspaceKnowledgeData
      });
    }

    // 3. Security validation
    const validation = validateGeneratedCode(generatedFiles);
    if (!validation.valid) {
      throw new Error(`Generated app failed security validation: ${validation.errors.join(', ')}`);
    }

    // 4. Create AppWorkspace and AppDeployment in DB
    const appWorkspace = await prisma.appWorkspace.create({
      data: {
        name,
        description: prompt,
        workspaceId,
        slug: generateSlug(name)
      }
    });

    // 5. Write generated files to isolated apps directory
    const appFilesDir = path.join(this.storage.workspaceRoot, 'apps', appWorkspace.id);
    if (!fs.existsSync(appFilesDir)) {
      fs.mkdirSync(appFilesDir, { recursive: true });
    }

    for (const [filename, content] of Object.entries(generatedFiles)) {
      const targetFilePath = path.join(appFilesDir, filename);
      fs.writeFileSync(targetFilePath, content, 'utf-8');
    }

    // 6. Deploy to Sandbox Runner
    let deploymentUrl = '';
    try {
      const sandbox = await this.sandboxRunner.startSandbox(appWorkspace.id, appFilesDir);
      deploymentUrl = sandbox.url;
    } catch (err: any) {
      console.warn('Sandbox start warning:', err.message);
    }

    const deployment = await prisma.appDeployment.create({
      data: {
        version: '1.0.0',
        status: 'DEPLOYED',
        appWorkspaceId: appWorkspace.id
      }
    });

    return {
      appWorkspaceId: appWorkspace.id,
      name: appWorkspace.name,
      slug: appWorkspace.slug!,
      deploymentId: deployment.id,
      url: deploymentUrl,
      previewUrl: `/api/workspaces/${appWorkspace.workspaceId}/apps/${appWorkspace.id}/preview`,
      shareUrl: `/apps/${appWorkspace.slug}`,
      files: generatedFiles,
      status: 'DEPLOYED'
    };
  }

  public async getApp(appWorkspaceId: string) {
    return prisma.appWorkspace.findUnique({
      where: { id: appWorkspaceId },
      include: {
        deployments: {
          orderBy: { deployedAt: 'desc' }
        },
        accesses: true
      }
    });
  }

  public async listApps(workspaceId: string) {
    return prisma.appWorkspace.findMany({
      where: { workspaceId },
      include: {
        deployments: {
          orderBy: { deployedAt: 'desc' }
        }
      }
    });
  }

  public getSandboxRunner(): SandboxRunner {
    return this.sandboxRunner;
  }
}
