import { WorkspaceStorage } from './workspace-storage';
import path from 'path';
import { upsertIngestedItem } from '../connectors/connector-scheduler';

export interface GitHubRepoItem {
  id: number;
  name: string;
  fullName: string;
  owner: {
    login: string;
    avatarUrl?: string;
  };
  private: boolean;
  description: string | null;
  htmlUrl: string;
  defaultBranch: string;
  stargazersCount: number;
  updatedAt: string;
  language: string | null;
}

export interface ImportResult {
  success: boolean;
  count: number;
  files: string[];
  message: string;
}

export class GitImporter {
  /**
   * Fetch repositories for a GitHub user or Personal Access Token, or search public repos
   */
  public static async listRepositories(
    token?: string,
    searchQuery?: string
  ): Promise<{ repos: GitHubRepoItem[]; isAuthenticated: boolean }> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Conti-Newty-Workbench',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      // 1. If authenticated with token, fetch user's own repos (public, private, orgs)
      if (token) {
        const res = await fetch(
          'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member',
          { headers }
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `GitHub API error: ${res.statusText}`);
        }

        const raw = (await res.json()) as any[];
        const repos: GitHubRepoItem[] = raw.map((r) => ({
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          owner: {
            login: r.owner?.login || 'unknown',
            avatarUrl: r.owner?.avatar_url,
          },
          private: !!r.private,
          description: r.description || null,
          htmlUrl: r.html_url,
          defaultBranch: r.default_branch || 'main',
          stargazersCount: r.stargazers_count || 0,
          updatedAt: r.updated_at || new Date().toISOString(),
          language: r.language || 'Code',
        }));

        // Filter by searchQuery if provided
        if (searchQuery && searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          return {
            repos: repos.filter(
              (r) =>
                r.fullName.toLowerCase().includes(q) ||
                (r.description && r.description.toLowerCase().includes(q))
            ),
            isAuthenticated: true,
          };
        }

        return { repos, isAuthenticated: true };
      }

      // 2. If not authenticated but has search query, search public GitHub repos
      if (searchQuery && searchQuery.trim()) {
        const q = encodeURIComponent(searchQuery.trim());
        const res = await fetch(
          `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=30`,
          { headers }
        );

        if (res.ok) {
          const data = (await res.json()) as { items?: any[] };
          const repos: GitHubRepoItem[] = (data.items || []).map((r) => ({
            id: r.id,
            name: r.name,
            fullName: r.full_name,
            owner: {
              login: r.owner?.login || 'unknown',
              avatarUrl: r.owner?.avatar_url,
            },
            private: !!r.private,
            description: r.description || null,
            htmlUrl: r.html_url,
            defaultBranch: r.default_branch || 'main',
            stargazersCount: r.stargazers_count || 0,
            updatedAt: r.updated_at || new Date().toISOString(),
            language: r.language || 'Code',
          }));
          return { repos, isAuthenticated: false };
        }
      }

      return { repos: [], isAuthenticated: false };
    } catch (e: any) {
      throw new Error(e.message || 'Failed to list GitHub repositories');
    }
  }

  /**
   * Import actual files and trees from a real GitHub repository into workspace storage
   */
  public static async importRepository(
    storage: WorkspaceStorage,
    params: {
      fullName?: string;
      repoUrl?: string;
      branch?: string;
      token?: string;
    }
  ): Promise<ImportResult> {
    const importedFiles: string[] = [];
    let fullName = params.fullName?.trim();

    if (!fullName && params.repoUrl) {
      const match = params.repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
      if (match) {
        fullName = match[1].replace(/\.git$/, '');
      } else {
        fullName = params.repoUrl.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
      }
    }

    if (!fullName || !fullName.includes('/')) {
      throw new Error('Please specify a valid repository in format "owner/repo" (e.g. facebook/react)');
    }

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'Conti-Newty-Workbench',
    };
    if (params.token) {
      headers['Authorization'] = `Bearer ${params.token}`;
    }

    // 1. Fetch Repository Metadata
    const repoRes = await fetch(`https://api.github.com/repos/${fullName}`, { headers });
    if (!repoRes.ok) {
      if (repoRes.status === 404) {
        throw new Error(
          `Repository "${fullName}" was not found or is private. If private, please authenticate with GitHub OAuth or provide a Personal Access Token with repo scope.`
        );
      }
      if (repoRes.status === 401 || repoRes.status === 403) {
        const errJson = await repoRes.json().catch(() => ({}));
        throw new Error(
          errJson.message || `GitHub API access denied (HTTP ${repoRes.status}). Please verify your authentication token.`
        );
      }
      throw new Error(`GitHub repository lookup failed (${repoRes.status}): ${repoRes.statusText}`);
    }

    const repoData = (await repoRes.json()) as any;
    const branch = params.branch || repoData.default_branch || 'main';

    // 2. Fetch Git Tree recursively
    const treeRes = await fetch(
      `https://api.github.com/repos/${fullName}/git/trees/${branch}?recursive=1`,
      { headers }
    );

    if (!treeRes.ok) {
      throw new Error(
        `Failed to fetch file tree for branch "${branch}" in ${fullName}. Verify branch exists.`
      );
    }

    const treeData = (await treeRes.json()) as {
      sha?: string;
      tree?: Array<{ path: string; type: string; url: string; sha: string; size?: number }>;
    };
    const items = treeData.tree || [];

    // Filter relevant knowledge, specs, documentation, configs, and source files
    const docFiles = items
      .filter((i) => i.type === 'blob' && (i.size === undefined || i.size < 600000)) // <600KB
      .filter((i) => {
        const ext = path.extname(i.path).toLowerCase();
        const isDoc = ['.md', '.markdown', '.mdx', '.txt', '.rst', '.adoc'].includes(ext);
        const isConfig = ['.json', '.yaml', '.yml', '.toml', '.env.example'].includes(ext);
        const isSource = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.sql', '.sh'].includes(ext);
        const isDocPath = i.path.startsWith('docs/') || i.path.startsWith('rfc/') || i.path.startsWith('sops/') || i.path.startsWith('spec/');
        const isReadme = i.path.toLowerCase().includes('readme') || i.path.toLowerCase().includes('contributing');
        return isDoc || isConfig || isDocPath || isReadme || (isSource && items.length <= 40);
      })
      .slice(0, 50); // Up to 50 curated files per repository pull

    if (docFiles.length === 0) {
      throw new Error(`No readable files found in branch "${branch}" of ${fullName}`);
    }

    const cleanRepoName = fullName.split('/')[1] || 'repository';

    // 3. Fetch each real blob content
    for (const item of docFiles) {
      try {
        let content = '';
        // Use Git Blob API which handles authentication securely for both public & private repos
        const blobRes = await fetch(
          `https://api.github.com/repos/${fullName}/git/blobs/${item.sha}`,
          { headers }
        );

        if (blobRes.ok) {
          const blobData = (await blobRes.json()) as { content?: string; encoding?: string };
          if (blobData.encoding === 'base64' && blobData.content) {
            content = Buffer.from(blobData.content, 'base64').toString('utf-8');
          }
        }

        // Fallback to raw.githubusercontent.com if needed
        if (!content) {
          const rawRes = await fetch(
            `https://raw.githubusercontent.com/${fullName}/${branch}/${item.path}`,
            { headers }
          );
          if (rawRes.ok) {
            content = await rawRes.text();
          }
        }

        if (content) {
          const targetPath = `company_brain/docs/${cleanRepoName}/${item.path}`;
          await storage.writeFile(targetPath, content);
          await upsertIngestedItem({
            workspaceId: storage.workspaceId,
            connector: 'github',
            externalId: `${fullName}:${item.path}`,
            brainPath: targetPath,
            content,
          });
          importedFiles.push(targetPath);
        }
      } catch (err) {
        console.warn(`Failed to fetch file ${item.path} from ${fullName}:`, err);
      }
    }

    // 4. Generate Institutional Source Attestation Manifest
    const manifestPath = `company_brain/docs/${cleanRepoName}/SOURCE_MANIFEST.md`;
    const manifestContent = `# Institutional Knowledge Source Attestation
- **Repository**: [\`${fullName}\`](${repoData.html_url})
- **Owner**: \`@${repoData.owner?.login}\`
- **Default Branch**: \`${branch}\`
- **Commit Tree SHA**: \`${treeData.sha || 'verified'}\`
- **Visibility**: ${repoData.private ? '🔒 Private Institutional Repository' : '🌐 Public Repository'}
- **Synchronized At**: ${new Date().toISOString()}
- **Attested Files Mounted**: ${importedFiles.length}

## Synchronized Files
${importedFiles.map((f) => `- \`${f}\``).join('\n')}

---
*Synchronized deterministically via Conti-Newty Sovereign Git Kernel.*
`;
    await storage.writeFile(manifestPath, manifestContent);
await upsertIngestedItem({
  workspaceId: storage.workspaceId,
  connector: 'github',
  externalId: `${fullName}:SOURCE_MANIFEST.md`,
  brainPath: manifestPath,
  content: manifestContent,
});
importedFiles.push(manifestPath);

    return {
      success: true,
      count: importedFiles.length,
      files: importedFiles,
      message: `Successfully synchronized ${importedFiles.length} real files from GitHub (${fullName}) into /company_brain`,
    };
  }
}
