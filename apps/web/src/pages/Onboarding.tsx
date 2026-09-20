import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, ImportResult } from '../lib/api-client';
import { GitRepoPickerModal } from '../components/onboarding/GitRepoPickerModal';
import { useAuth } from '../context/AuthContext';

const STEPS = [
  { n: 1, label: 'Create workspace' },
  { n: 2, label: 'Connect knowledge' },
  { n: 3, label: 'Invite team' },
  { n: 4, label: 'Ready' },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {STEPS.map((s, i) => (
        <div key={s.n} className="flex items-center shrink-0">
          <div className={`flex items-center gap-2 px-3 py-1.5 ${current === s.n ? 'bg-foreground text-background' : ''}`}>
            <span className={`font-mono text-xs ${current === s.n ? 'text-background' : current > s.n ? 'text-accent' : 'text-muted-foreground'}`}>
              {current > s.n ? '✓' : String(s.n).padStart(2, '0')}
            </span>
            <span className={`font-mono text-xs hidden sm:block ${current === s.n ? 'text-background' : 'text-muted-foreground'}`}>{s.label}</span>
          </div>
          {i < STEPS.length - 1 && <div className="w-6 h-px bg-border shrink-0" />}
        </div>
      ))}
    </div>
  );
}

function Step1({ onNext, workspaceName, setWorkspaceName }: {
  onNext: (workspaceId: string, name: string, description: string, template?: string) => void;
  workspaceName: string;
  setWorkspaceName: (v: string) => void;
}) {
  const [displayName, setDisplayName] = useState(() => localStorage.getItem('anti_display_name') || '');
  const [desc, setDesc] = useState('');
  const [useIcm, setUseIcm] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false }; }, []);

  async function create() {
    if (!workspaceName.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (displayName.trim()) api.setDisplayName(displayName);
      const ws = await api.createWorkspace({
        name: workspaceName.trim(),
        description: desc.trim() || undefined,
        template: useIcm ? 'icm' : undefined,
      });
      if (!mounted.current) return;
      setLoading(false);
      onNext(ws.id, ws.name, desc.trim());
    } catch (e: any) {
      if (!mounted.current) return;
      setError(e.message || 'Failed to create workspace');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm w-full animate-fade-in">
      <h2 className="font-serif text-3xl font-light text-foreground mb-2">Create your workspace</h2>
      <p className="text-sm text-muted-foreground mb-8">Your workspace is the persistent environment for your team&apos;s knowledge, work, and agents.</p>
      {error && <div className="mb-4 p-3 bg-destructive/5 border border-destructive/20"><span className="font-mono text-xs text-destructive">{error}</span></div>}
      <div className="space-y-4">
        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5">DISPLAY NAME</label>
          <input
            type="text"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="How collaborators should see you"
            className="w-full px-3 py-2.5 bg-background border border-border text-foreground text-sm focus:outline-none focus:border-foreground transition-colors placeholder-muted-foreground"
          />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5">WORKSPACE NAME</label>
          <input
            type="text"
            value={workspaceName}
            onChange={e => setWorkspaceName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="Acme Operations"
            className="w-full px-3 py-2.5 bg-background border border-border text-foreground text-sm focus:outline-none focus:border-foreground transition-colors placeholder-muted-foreground"
            autoFocus
          />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5">DESCRIPTION <span className="font-normal text-muted-foreground">(optional)</span></label>
          <input
            type="text"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Operations workspace for the team"
            className="w-full px-3 py-2.5 bg-background border border-border text-foreground text-sm focus:outline-none focus:border-foreground transition-colors placeholder-muted-foreground"
          />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5">KNOWLEDGE TEMPLATE</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setUseIcm(true)}
              className={`px-3 py-2.5 border font-mono text-xs transition-colors cursor-pointer ${useIcm ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`}
            >
              ICM STANDARD
            </button>
            <button
              type="button"
              onClick={() => setUseIcm(false)}
              className={`px-3 py-2.5 border font-mono text-xs transition-colors cursor-pointer ${!useIcm ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground'}`}
            >
              BLANK
            </button>
          </div>
          <p className="mt-1.5 font-mono text-xs text-muted-foreground">
            {useIcm ? 'Seeds docs/, sops/, notes/, prompts/ with institutional templates.' : 'Start with an empty root directory.'}
          </p>
        </div>
        <button
          onClick={create}
          disabled={!workspaceName.trim() || loading}
          className="w-full py-3 bg-foreground text-background font-mono text-xs tracking-wider hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? <><div className="w-3 h-3 border border-background border-t-transparent rounded-full animate-spin" />CREATING...</> : 'CREATE WORKSPACE →'}
        </button>
      </div>
    </div>
  );
}

interface ConnectedKnowledgeInfo {
  type: 'GIT' | 'FILES' | 'ZIP';
  title: string;
  fileCount: number;
  files?: string[];
}

function Step2({ workspaceId, onNext, onSkip }: { workspaceId: string; onNext: () => void; onSkip: () => void }) {
  const [gitModalOpen, setGitModalOpen] = useState(false);
  const [connected, setConnected] = useState<ConnectedKnowledgeInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [error, setError] = useState('');
  const [showFileList, setShowFileList] = useState(false);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const [githubUser, setGithubUser] = useState<{ login: string; avatar_url: string } | null>(null);
  const isGithubConnected = Boolean(localStorage.getItem('anti_github_token') || githubUser);

  useEffect(() => {
    const token = localStorage.getItem('anti_github_token');
    if (token) {
      fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((u) => {
          if (u) setGithubUser({ login: u.login, avatar_url: u.avatar_url });
        })
        .catch(() => {});
    }
  }, []);

  // Handle Multi-file Upload
  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    setError('');
    setUploadStatus(`Reading ${selectedFiles.length} file(s)...`);

    try {
      const filePayloads: Array<{ name: string; content: string }> = [];

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const text = await file.text();
        filePayloads.push({
          name: file.name,
          content: text,
        });
      }

      setUploadStatus(`Writing ${filePayloads.length} documents into /company_brain...`);
      const res = await api.importFiles(workspaceId, filePayloads);

      setConnected({
        type: 'FILES',
        title: `${filePayloads.length} Local Document(s)`,
        fileCount: res.count,
        files: res.files,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to upload files');
    } finally {
      setUploading(false);
      if (filesInputRef.current) filesInputRef.current.value = '';
    }
  };

  // Handle ZIP Archive Upload
  const handleZipSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setUploadStatus(`Unpacking ZIP archive: ${file.name}...`);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const res = await api.uploadWorkspaceZip(workspaceId, base64);

          setConnected({
            type: 'ZIP',
            title: file.name,
            fileCount: res.count,
            files: res.files,
          });
        } catch (err: any) {
          setError(err.message || 'Failed to upload ZIP archive');
        } finally {
          setUploading(false);
          if (zipInputRef.current) zipInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || 'Failed to process ZIP file');
      setUploading(false);
    }
  };

  const handleGitSuccess = (res: ImportResult, repoName: string) => {
    setConnected({
      type: 'GIT',
      title: repoName,
      fileCount: res.count,
      files: res.files,
    });
  };

  return (
    <div className="max-w-sm w-full animate-fade-in">
      <h2 className="font-serif text-3xl font-light text-foreground mb-2">Connect your knowledge</h2>
      <p className="text-sm text-muted-foreground mb-8">
        Your Company Brain is a traversable filesystem built from your actual knowledge sources. Your template files are already seeded.
      </p>

      {/* Hidden Native File Inputs */}
      <input
        ref={filesInputRef}
        type="file"
        multiple
        accept=".md,.markdown,.txt,.json,.yaml,.yml,.csv,.pdf,.ts,.js,.py"
        className="hidden"
        onChange={handleFilesSelected}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleZipSelected}
      />

      {/* Git Repo Picker Modal */}
      <GitRepoPickerModal
        workspaceId={workspaceId}
        isOpen={gitModalOpen}
        onClose={() => setGitModalOpen(false)}
        onSuccess={handleGitSuccess}
      />

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-md font-mono text-xs text-destructive">
          {error}
        </div>
      )}

      {uploading && (
        <div className="mb-6 p-4 bg-card border border-border animate-fade-in rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-xs text-foreground font-semibold">SYNCHRONIZING...</span>
          </div>
          <div className="font-mono text-xs text-muted-foreground">{uploadStatus}</div>
        </div>
      )}

      {connected && (
        <div className="mb-6 p-4 bg-accent/10 border border-accent/30 rounded-lg animate-fade-in space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-accent font-bold">✓ CONNECTED</span>
              <span className="font-mono text-xs text-foreground font-semibold truncate max-w-[170px]">
                · {connected.title}
              </span>
            </div>
            <span className="font-mono text-[10px] px-1.5 py-0.5 bg-accent/20 text-accent rounded font-bold">
              {connected.type}
            </span>
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            {connected.fileCount} knowledge documents synchronized into /company_brain
          </div>

          {connected.files && connected.files.length > 0 && (
            <div className="pt-2 border-t border-accent/20">
              <button
                type="button"
                onClick={() => setShowFileList(!showFileList)}
                className="text-[11px] font-mono text-accent hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{showFileList ? '▼ Hide file list' : '▶ View imported files (' + connected.files.length + ')'}</span>
              </button>

              {showFileList && (
                <div className="mt-2 max-h-32 overflow-y-auto p-2 bg-black/40 rounded border border-accent/20 space-y-1 font-mono text-[10px] text-muted-foreground">
                  {connected.files.map((f, i) => (
                    <div key={i} className="truncate text-foreground/80">
                      📄 {f.replace(/^company_brain\//, '')}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3 Source Options */}
      {!uploading && (
        <div className="space-y-2.5 mb-6">
          <button
            onClick={() => setGitModalOpen(true)}
            className="w-full flex items-start gap-4 border border-border bg-background hover:border-foreground hover:bg-card transition-all p-4 text-left rounded-lg cursor-pointer group"
          >
            <div className="w-8 h-8 rounded bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
              {githubUser?.avatar_url ? (
                <img
                  src={githubUser.avatar_url}
                  alt={githubUser.login}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff">
                  <path d="M12 2C6.5 2 2 6.5 2 12c0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.3-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.5-1.4.1-2.8 0 0 .8-.3 2.8 1 .8-.2 1.7-.3 2.5-.3s1.7.1 2.5.3c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.5.1 2.8.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7 1 .7 2v3c0 .3.2.6.7.5A10 10 0 0 0 22 12c0-5.5-4.5-10-10-10z" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                  {isGithubConnected
                    ? `IMPORT FROM GITHUB ${githubUser?.login ? `(@${githubUser.login})` : ''}`
                    : 'CONNECT GIT (GITHUB)'}
                </span>
                {isGithubConnected && (
                  <span className="font-mono text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded font-semibold uppercase tracking-wider shrink-0">
                    AUTHENTICATED
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {isGithubConnected
                  ? 'Browse and synchronize your GitHub repositories directly'
                  : 'Connect your GitHub account or paste repo URL'}
              </div>
            </div>
            <span className="font-mono text-sm text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform">→</span>
          </button>

          <button
            onClick={() => filesInputRef.current?.click()}
            className="w-full flex items-start gap-4 border border-border bg-background hover:border-foreground hover:bg-card transition-all p-4 text-left rounded-lg cursor-pointer group"
          >
            <div className="w-8 h-8 rounded bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
              <span className="text-base">📄</span>
            </div>
            <div>
              <div className="font-mono text-xs font-semibold text-foreground mb-0.5 group-hover:text-primary transition-colors">
                ADD FILES
              </div>
              <div className="text-xs text-muted-foreground">
                Upload Markdown, PDF, text, or configs
              </div>
            </div>
            <span className="font-mono text-sm text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform">→</span>
          </button>

          <button
            onClick={() => zipInputRef.current?.click()}
            className="w-full flex items-start gap-4 border border-border bg-background hover:border-foreground hover:bg-card transition-all p-4 text-left rounded-lg cursor-pointer group"
          >
            <div className="w-8 h-8 rounded bg-black/40 border border-white/10 flex items-center justify-center shrink-0">
              <span className="text-base">📦</span>
            </div>
            <div>
              <div className="font-mono text-xs font-semibold text-foreground mb-0.5 group-hover:text-primary transition-colors">
                IMPORT ZIP ARCHIVE
              </div>
              <div className="text-xs text-muted-foreground">
                Unpack an existing workspace archive
              </div>
            </div>
            <span className="font-mono text-sm text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform">→</span>
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onNext}
          className="flex-1 py-3 bg-foreground text-background font-mono text-xs tracking-wider hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
        >
          {connected ? 'CONTINUE →' : 'CONTINUE →'}
        </button>
        <button
          onClick={onSkip}
          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors py-3 px-4 cursor-pointer"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

interface PendingInviteItem {
  id?: string;
  email: string;
  role: string;
  token?: string;
  inviteUrl?: string;
}

function Step3({ workspaceId, onNext, onSkip }: { workspaceId: string; onNext: () => void; onSkip: () => void }) {
  const [email, setEmail] = useState('');
  const [perm, setPerm] = useState('editor');
  const [pending, setPending] = useState<PendingInviteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load current user's organization and generate/fetch join code
    api.getMe().then(async ({ user }) => {
      if (user?.organizationId) {
        setOrgId(user.organizationId);
        try {
          const res = await api.createJoinCode(user.organizationId, {
            workspaceId,
            role: 'member',
          });
          if (res?.joinCode?.code) {
            setJoinCode(res.joinCode.code);
          }
        } catch (e) {
          console.warn('Could not generate join code:', e);
        }
      }
    }).catch(console.error);
  }, [workspaceId]);

  async function invite() {
    if (!email.trim() || loading) return;
    setError('');
    setLoading(true);

    try {
      if (!orgId) {
        // Fetch orgId if not loaded yet
        const me = await api.getMe();
        if (me.user?.organizationId) {
          setOrgId(me.user.organizationId);
        } else {
          throw new Error('No active organization found to invite teammates to');
        }
      }

      const effectiveOrgId = orgId || (await api.getMe()).user?.organizationId;
      if (!effectiveOrgId) {
        throw new Error('Organization not found');
      }

      const res = await api.createInvite(effectiveOrgId, {
        email: email.trim().toLowerCase(),
        role: perm === 'admin' ? 'ADMIN' : 'MEMBER',
        workspaceId,
      });

      const fullInviteUrl = `${window.location.origin}${res.invite.inviteUrl}`;

      setPending((p) => [
        ...p,
        {
          id: res.invite.id,
          email: res.invite.email,
          role: perm,
          token: res.invite.token,
          inviteUrl: fullInviteUrl,
        },
      ]);
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Failed to create invitation');
    } finally {
      setLoading(false);
    }
  }

  const copyInviteLink = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="max-w-md w-full animate-fade-in">
      <h2 className="font-serif text-3xl font-light text-foreground mb-2">Bring your team in</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Workspace members share the same Company Brain, work items, and agents. Real cryptographic invite links and join codes are generated instantly.
      </p>

      {/* Shareable Team Join Code */}
      {joinCode && (
        <div className="mb-6 p-3.5 rounded-lg bg-card border border-border flex items-center justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">
              Team Instant Join Code
            </div>
            <div className="font-mono text-sm font-bold text-foreground tracking-widest mt-0.5">
              {joinCode}
            </div>
          </div>
          <button
            onClick={() => copyCode(joinCode)}
            className="px-3 py-1.5 rounded bg-background border border-border font-mono text-xs hover:border-foreground transition-colors cursor-pointer text-foreground"
          >
            {copiedCode ? '✓ Copied Code' : 'Copy Code'}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded bg-red-950/40 border border-red-500/30 text-xs font-mono text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-3 mb-6">
        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5">EMAIL ADDRESS</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="w-full px-3 py-2.5 bg-background border border-border text-foreground text-sm focus:outline-none focus:border-foreground transition-colors placeholder-muted-foreground"
            onKeyDown={(e) => e.key === 'Enter' && invite()}
            autoFocus
          />
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5">PERMISSION</label>
          <select
            value={perm}
            onChange={(e) => setPerm(e.target.value)}
            className="w-full px-3 py-2.5 bg-background border border-border text-foreground text-sm focus:outline-none focus:border-foreground transition-colors"
          >
            <option value="editor">Editor (Member)</option>
            <option value="viewer">Viewer (Read-only)</option>
            <option value="admin">Admin (Full Access)</option>
          </select>
        </div>
        <button
          onClick={invite}
          disabled={!email.trim() || loading}
          className="w-full py-3 border border-border text-foreground font-mono text-xs tracking-wider hover:border-foreground hover:bg-card transition-colors disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? 'GENERATING INVITATION...' : 'CREATE INVITATION LINK →'}
        </button>
      </div>

      {pending.length > 0 && (
        <div className="mb-6 space-y-2">
          <div className="font-mono text-xs text-muted-foreground">ACTIVE INVITATIONS ({pending.length})</div>
          {pending.map((p, i) => (
            <div key={i} className="p-3 bg-card border border-border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{p.email}</span>
                <span className="font-mono text-[11px] text-emerald-400 bg-emerald-950/30 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  {p.role} · Active Invite
                </span>
              </div>
              {p.inviteUrl && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={p.inviteUrl}
                    className="flex-1 px-2 py-1 bg-background border border-border rounded font-mono text-[11px] text-muted-foreground truncate"
                  />
                  <button
                    onClick={() => copyInviteLink(p.inviteUrl!, i)}
                    className="px-2.5 py-1 rounded bg-foreground text-background font-mono text-[11px] font-semibold hover:bg-primary hover:text-primary-foreground transition-colors shrink-0 cursor-pointer"
                  >
                    {copiedIndex === i ? '✓ Copied' : 'Copy Link'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onNext}
          className="flex-1 py-3 bg-foreground text-background font-mono text-xs tracking-wider hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
        >
          CONTINUE →
        </button>
        <button
          onClick={onSkip}
          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors py-3 px-4 cursor-pointer"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}

function Step4({ onComplete, workspaceName }: { onComplete: () => void; workspaceName: string }) {
  return (
    <div className="max-w-sm w-full text-center animate-fade-in">
      <div className="font-mono text-xs text-accent mb-4">WORKSPACE READY</div>
      <h2 className="font-serif text-3xl font-light text-foreground mb-8 uppercase tracking-wide">{workspaceName}</h2>
      <div className="space-y-0 mb-10 text-left border border-border">
        {[
          { label: 'Status', value: 'Active', color: 'text-accent' },
          { label: 'Knowledge', value: 'Loaded', color: 'text-foreground' },
          { label: 'Agents', value: 'Ready', color: 'text-foreground' },
        ].map((row, i) => (
          <div key={row.label} className={`flex items-center justify-between px-4 py-3 ${i < 2 ? 'border-b border-border' : ''}`}>
            <span className="font-mono text-xs text-muted-foreground">{row.label}</span>
            <span className={`font-mono text-xs font-semibold ${row.color}`}>{row.value}</span>
          </div>
        ))}
      </div>
      <button onClick={onComplete} className="w-full py-3 bg-foreground text-background font-mono text-xs tracking-wider hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
        ENTER WORKSPACE →
      </button>
    </div>
  );
}

export const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [step, setStep] = useState(searchParams.get('workspace_id') ? 2 : 1);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceId, setWorkspaceId] = useState(searchParams.get('workspace_id') || '');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }

    api.getMe().then(({ nextRoute }) => {
      if (searchParams.get('workspace_id')) return;
      if (nextRoute && nextRoute !== '/onboarding') {
        navigate(nextRoute, { replace: true });
      }
    }).catch(() => {});
  }, [authLoading, user, navigate, searchParams]);

  function next() { setStep(s => Math.min(s + 1, 4)); }

  function afterStep1(wsId: string, name: string) {
    setWorkspaceId(wsId);
    setWorkspaceName(name);
    next();
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between px-8 py-5 border-b border-border">
        <span className="font-mono text-xs tracking-widest text-foreground">CONTI-NEWTY</span>
        <StepIndicator current={step} />
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        {step === 1 && (
          <Step1
            onNext={afterStep1}
            workspaceName={workspaceName}
            setWorkspaceName={setWorkspaceName}
          />
        )}
        {step === 2 && <Step2 workspaceId={workspaceId} onNext={next} onSkip={next} />}
        {step === 3 && <Step3 workspaceId={workspaceId} onNext={next} onSkip={next} />}
        {step === 4 && (
          <Step4
            onComplete={() => navigate(`/w/${workspaceId}/home`)}
            workspaceName={workspaceName}
          />
        )}
      </div>
    </div>
  );
};

export default Onboarding;
