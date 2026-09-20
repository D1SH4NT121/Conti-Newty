import React, { useState, useEffect } from 'react';
import { api, GitHubRepoItem, ImportResult } from '../../lib/api-client';

interface GitRepoPickerModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: ImportResult, repoName: string) => void;
}

interface GitHubUserProfile {
  login: string;
  name: string | null;
  avatar_url: string;
  public_repos: number;
  total_private_repos?: number;
}

export const GitRepoPickerModal: React.FC<GitRepoPickerModalProps> = ({
  workspaceId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'repos' | 'pat' | 'custom'>('repos');
  const [search, setSearch] = useState('');
  const [repos, setRepos] = useState<GitHubRepoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [githubToken, setGithubToken] = useState<string | null>(null);
  const [githubUser, setGithubUser] = useState<GitHubUserProfile | null>(null);
  const [importingRepo, setImportingRepo] = useState<string | null>(null);
  const [importLogs, setImportLogs] = useState<string[]>([]);
  const [patInput, setPatInput] = useState('');
  const [patLoading, setPatLoading] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [customBranch, setCustomBranch] = useState('main');
  const [error, setError] = useState('');

  const connectGitHub = async () => {
    try {
      setError('');
      window.location.href = await api.getGitHubConnectUrl(workspaceId);
    } catch (e: any) {
      setError(e.message || 'Failed to start GitHub authorization');
    }
  };

  // 1. Check existing GitHub connection on open
  useEffect(() => {
    if (!isOpen) return;
    setError('');
    const storedToken = localStorage.getItem('anti_github_token');
    if (storedToken) {
      setGithubToken(storedToken);
      loadReposWithToken(storedToken);
    } else {
      setGithubToken(null);
      setGithubUser(null);
      setRepos([]);
      setLoading(false);
    }
  }, [isOpen]);

  // Search public repos if not logged in and search has input
  useEffect(() => {
    if (!isOpen || githubToken) return;
    if (!search.trim() || search.trim().length < 2) {
      setRepos([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.listGitHubRepos(undefined, search.trim());
        setRepos(res.repos);
      } catch (e: any) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [search, githubToken, isOpen]);

  const loadReposWithToken = async (token: string) => {
    setLoading(true);
    setError('');
    try {
      // Fetch Real GitHub User Profile
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (userRes.ok) {
        const u = await userRes.json();
        setGithubUser(u);
      } else {
        // Token invalid or expired
        localStorage.removeItem('anti_github_token');
        setGithubToken(null);
        setGithubUser(null);
      }

      // Fetch Real GitHub Repositories for this user
      const res = await api.listGitHubRepos(token);
      setRepos(res.repos);
    } catch (e: any) {
      console.error('Failed to load GitHub repos:', e);
      setError('Failed to fetch repositories from GitHub.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Connect via Personal Access Token
  const handleConnectPAT = async () => {
    if (!patInput.trim()) {
      setError('Please paste a GitHub Personal Access Token');
      return;
    }

    setPatLoading(true);
    setError('');

    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${patInput.trim()}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!userRes.ok) {
        throw new Error('Invalid Personal Access Token. Please verify token permissions (repo scope).');
      }

      const u = await userRes.json();
      localStorage.setItem('anti_github_token', patInput.trim());
      setGithubToken(patInput.trim());
      setGithubUser(u);
      setPatInput('');
      setActiveTab('repos');
      await loadReposWithToken(patInput.trim());
    } catch (e: any) {
      setError(e.message || 'Failed to authenticate with GitHub token');
    } finally {
      setPatLoading(false);
    }
  };

  // 3. Disconnect GitHub Token
  const handleDisconnect = () => {
    localStorage.removeItem('anti_github_token');
    setGithubToken(null);
    setGithubUser(null);
    setRepos([]);
    setSearch('');
  };

  if (!isOpen) return null;

  const filteredRepos = repos.filter(
    (r) =>
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  // 4. Import selected repository
  const handleImport = async (repo: GitHubRepoItem) => {
    setImportingRepo(repo.fullName);
    setError('');
    setImportLogs([
      `Initiating connection to GitHub repository: ${repo.fullName}...`,
      `Scanning branch [${repo.defaultBranch}] recursive file tree...`,
    ]);

    try {
      const timer = setTimeout(() => {
        setImportLogs((prev) => [
          ...prev,
          'Fetching file blobs, documentation, specs, and manifests...',
        ]);
      }, 500);

      const res = await api.importGitHubRepo(workspaceId, {
        fullName: repo.fullName,
        branch: repo.defaultBranch,
        token: githubToken || undefined,
      });

      clearTimeout(timer);
      setImportLogs((prev) => [
        ...prev,
        `Synchronized ${res.count} actual files into /company_brain/docs/${repo.name}`,
        'Generated institutional attestation SOURCE_MANIFEST.md with SHA-256',
        'Repository successfully mounted!',
      ]);

      setTimeout(() => {
        onSuccess(res, repo.fullName);
        onClose();
      }, 800);
    } catch (e: any) {
      setError(e.message || 'Import failed');
      setImportingRepo(null);
    }
  };

  const handleCustomImport = async () => {
    if (!customUrl.trim()) {
      setError('Please provide a valid GitHub repository URL or owner/repo');
      return;
    }

    setImportingRepo(customUrl.trim());
    setError('');
    setImportLogs([
      `Connecting to repository: ${customUrl.trim()}...`,
      `Querying GitHub API for branch [${customBranch.trim() || 'main'}]...`,
    ]);

    try {
      const res = await api.importGitHubRepo(workspaceId, {
        repoUrl: customUrl.trim(),
        branch: customBranch.trim() || 'main',
        token: githubToken || undefined,
      });

      setImportLogs((prev) => [
        ...prev,
        `Successfully imported ${res.count} files from GitHub.`,
        'Mounted into /company_brain/docs/.',
      ]);

      setTimeout(() => {
        onSuccess(res, customUrl.trim());
        onClose();
      }, 800);
    } catch (e: any) {
      setError(e.message || 'Failed to import repository from GitHub');
      setImportingRepo(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#0e0e11] border border-white/12 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/10 bg-[#121216]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#1c1c24] border border-white/15 flex items-center justify-center shadow-inner">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
                <path d="M12 2C6.5 2 2 6.5 2 12c0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.3-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.5-1.4.1-2.8 0 0 .8-.3 2.8 1 .8-.2 1.7-.3 2.5-.3s1.7.1 2.5.3c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.5.1 2.8.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7 1 .7 2v3c0 .3.2.6.7.5A10 10 0 0 0 22 12c0-5.5-4.5-10-10-10z" />
              </svg>
            </div>
            <div>
              <h3 className="font-sans text-base font-semibold text-white">
                Connect GitHub Repository
              </h3>
              <p className="font-mono text-xs text-white/50">
                Synchronize actual repositories &amp; specs into /company_brain
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:border-white/30 transition-colors font-mono text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* GitHub Account Auth Status Bar */}
        <div className="px-6 py-3 border-b border-white/8 bg-[#111115] flex items-center justify-between">
          {githubUser ? (
            <div className="flex items-center gap-2.5">
              <img
                src={githubUser.avatar_url}
                alt={githubUser.login}
                className="w-5 h-5 rounded-full object-cover border border-white/20"
              />
              <span className="font-mono text-xs text-white">
                Authenticated as <strong className="text-emerald-400">@{githubUser.login}</strong>
              </span>
              <span className="font-mono text-[10px] text-white/40">
                ({githubUser.public_repos} public repos)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 font-mono text-xs text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Not signed in with GitHub</span>
            </div>
          )}

          {githubUser ? (
            <button
              onClick={handleDisconnect}
              className="font-mono text-xs text-white/40 hover:text-red-400 transition-colors cursor-pointer"
            >
              Sign out of GitHub
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={connectGitHub}
                className="px-3 py-1.5 rounded-lg bg-white text-black font-mono text-xs font-bold hover:bg-emerald-400 hover:text-black transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Authorize GitHub OAuth →</span>
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 pb-2 border-b border-white/8 bg-[#0e0e11]">
          <button
            onClick={() => setActiveTab('repos')}
            className={`px-3 py-1.5 rounded-md font-mono text-xs transition-colors cursor-pointer ${
              activeTab === 'repos'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            {githubUser ? `My Repositories (${repos.length})` : 'Search Public Repositories'}
          </button>
          <button
            onClick={() => setActiveTab('pat')}
            className={`px-3 py-1.5 rounded-md font-mono text-xs transition-colors cursor-pointer ${
              activeTab === 'pat'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Personal Access Token (PAT)
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1.5 rounded-md font-mono text-xs transition-colors cursor-pointer ${
              activeTab === 'custom'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            Paste Repo URL
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-950/50 border border-red-500/40 font-mono text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {importingRepo ? (
            /* Terminal Progress */
            <div className="p-5 rounded-xl bg-black/60 border border-emerald-500/30 space-y-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                <span className="font-mono text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Importing {importingRepo} from GitHub...
                </span>
              </div>
              <div className="p-3 bg-black/80 rounded border border-white/10 font-mono text-xs text-white/80 space-y-1.5 max-h-48 overflow-y-auto">
                {importLogs.map((log, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11.5px]">
                    <span className="text-emerald-500 font-bold">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'repos' ? (
            /* Real Repositories List */
            <div className="space-y-4">
              {!githubUser && (
                <div className="p-5 rounded-xl bg-gradient-to-r from-blue-950/50 to-indigo-950/50 border border-blue-500/30 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-mono text-xs font-bold text-white uppercase tracking-wider mb-1">
                        Authenticate with your GitHub Account
                      </h4>
                      <p className="text-xs text-white/70 leading-relaxed">
                        Sign in to automatically pull and search your actual personal, organization, and private repositories directly from GitHub.
                      </p>
                    </div>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={connectGitHub}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white text-black font-mono text-xs font-bold hover:bg-emerald-400 hover:text-black transition-colors shadow-lg"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.5 2 2 6.5 2 12c0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.3-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.5-1.4.1-2.8 0 0 .8-.3 2.8 1 .8-.2 1.7-.3 2.5-.3s1.7.1 2.5.3c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.5.1 2.8.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7 1 .7 2v3c0 .3.2.6.7.5A10 10 0 0 0 22 12c0-5.5-4.5-10-10-10z" />
                      </svg>
                      <span>Sign in with GitHub (OAuth) →</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Search Box */}
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    githubUser
                      ? "Search your repositories..."
                      : "Search public GitHub repositories (e.g. facebook/react, vercel/next.js)..."
                  }
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-white/40 placeholder-white/30"
                  autoFocus
                />
              </div>

              {loading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 font-mono text-xs text-white/40">
                  <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Fetching live repositories from GitHub API...
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="py-10 text-center font-mono text-xs text-white/40 space-y-2">
                  {githubUser ? (
                    <p>No repositories found matching &ldquo;{search}&rdquo;.</p>
                  ) : search ? (
                    <p>No public GitHub repositories found for &ldquo;{search}&rdquo;.</p>
                  ) : (
                    <p>Sign in above or type a search query to browse GitHub repositories.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="p-4 rounded-xl bg-white/[0.02] border border-white/8 hover:border-white/25 hover:bg-white/[0.04] transition-all flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-bold text-white truncate">
                            {repo.fullName}
                          </span>
                          <span
                            className={`font-mono text-[9px] px-1.5 py-0.2 rounded uppercase font-semibold ${
                              repo.private
                                ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
                                : 'bg-white/10 text-white/70 border border-white/15'
                            }`}
                          >
                            {repo.private ? 'Private' : 'Public'}
                          </span>
                          <span className="font-mono text-[10px] text-white/40 ml-auto hidden sm:inline">
                            Branch: {repo.defaultBranch}
                          </span>
                        </div>
                        {repo.description && (
                          <p className="text-xs text-white/60 line-clamp-1 mb-1">
                            {repo.description}
                          </p>
                        )}
                        <div className="flex items-center gap-3 font-mono text-[10px] text-white/40">
                          {repo.language && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              {repo.language}
                            </span>
                          )}
                          {repo.stargazersCount > 0 && (
                            <span>★ {repo.stargazersCount.toLocaleString()}</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleImport(repo)}
                        className="px-4 py-2 rounded-lg bg-white text-black font-mono text-xs font-bold hover:bg-emerald-400 hover:text-black transition-colors shrink-0 cursor-pointer shadow-sm"
                      >
                        Import →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'pat' ? (
            /* Connect via Personal Access Token Tab */
            <div className="space-y-4">
              <p className="text-xs text-white/70 leading-relaxed">
                Provide a GitHub Personal Access Token (classic or fine-grained with <code className="text-emerald-400 bg-white/5 px-1 py-0.5 rounded">repo</code> scope) to directly pull your private &amp; organization repositories.
              </p>

              <div>
                <label className="font-mono text-xs text-white/60 block mb-1.5">
                  GITHUB PERSONAL ACCESS TOKEN (PAT)
                </label>
                <input
                  type="password"
                  value={patInput}
                  onChange={(e) => setPatInput(e.target.value)}
                  placeholder="ghp_..."
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-white/40 placeholder-white/30"
                  autoFocus
                />
              </div>

              <button
                onClick={handleConnectPAT}
                disabled={!patInput.trim() || patLoading}
                className="w-full py-3 rounded-lg bg-white text-black font-mono text-xs font-bold hover:bg-emerald-400 hover:text-black transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                {patLoading ? 'VALIDATING TOKEN...' : 'AUTHENTICATE & LOAD REPOSITORIES →'}
              </button>
            </div>
          ) : (
            /* Custom URL Input Tab */
            <div className="space-y-4">
              <div>
                <label className="font-mono text-xs text-white/60 block mb-1.5">
                  REPOSITORY URL OR OWNER/REPO
                </label>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://github.com/facebook/react or owner/repo"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-white/40 placeholder-white/30"
                  autoFocus
                />
              </div>

              <div>
                <label className="font-mono text-xs text-white/60 block mb-1.5">
                  BRANCH <span className="text-white/40">(optional)</span>
                </label>
                <input
                  type="text"
                  value={customBranch}
                  onChange={(e) => setCustomBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-white/40 placeholder-white/30"
                />
              </div>

              <button
                onClick={handleCustomImport}
                disabled={!customUrl.trim()}
                className="w-full py-3 rounded-lg bg-white text-black font-mono text-xs font-bold hover:bg-emerald-400 hover:text-black transition-colors disabled:opacity-40 cursor-pointer"
              >
                CONNECT &amp; IMPORT REPOSITORY →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GitRepoPickerModal;
