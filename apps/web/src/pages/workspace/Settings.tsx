import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { api, WorkspaceSummary, UserProfile } from '../../lib/api-client';
import { Download, CheckCircle2, RefreshCw, Save, Sliders, AlertTriangle, User, KeyRound, Shield, Mail, Sparkles, Trash2 } from 'lucide-react';

export const Settings: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const navigate = useNavigate();

  // Workspace settings state
  const [name, setName] = useState(workspace?.name || '');
  const [description, setDescription] = useState(workspace?.description || '');
  const [exporting, setExporting] = useState(false);
  const [savingWorkspace, setSavingWorkspace] = useState(false);

  // User profile state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  // Global alerts
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // BYOK Credential state
  const [credentials, setCredentials] = useState<Array<{ id: string; kind: string; provider: string; label: string; createdAt: string }>>([]);
  const [byokProvider, setByokProvider] = useState('claude');
  const [byokKey, setByokKey] = useState('');
  const [byokLabel, setByokLabel] = useState('');
  const [savingByok, setSavingByok] = useState(false);

  useEffect(() => {
    if (workspace) {
      setName(workspace.name || '');
      setDescription(workspace.description || '');
    }
  }, [workspace]);

  useEffect(() => {
    // Load current user profile
    api.getMe().then((res) => {
      if (res?.user) {
        setUser(res.user);
        setProfileName(res.user.name || '');
        setAvatarUrl(res.user.avatarUrl || '');
      }
    }).catch((err) => {
      console.error('Failed to load user profile', err);
    });

    // Load BYOK credentials
    api.listCredentials(workspace?.id).then(setCredentials).catch(() => {});
  }, []);

  const handleExportZip = async () => {
    try {
      setExporting(true);
      setError(null);
      const url = await api.downloadWorkspaceZip(workspace.id);
      window.location.assign(url);
    } catch (e: any) {
      setError(e.message || 'Export error');
    } finally {
      setExporting(false);
    }
  };

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSavingWorkspace(true);
    setError(null);
    setSuccess(null);

    try {
      await api.updateWorkspace(workspace.id, {
        name: name.trim(),
        description: description.trim(),
      });
      setSuccess('Workspace settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save workspace settings');
    } finally {
      setSavingWorkspace(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await api.updateProfile({
        name: profileName.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });
      if (res?.user) {
        setUser(res.user);
        setSuccess('Profile updated successfully!');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) return;

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setSavingPassword(true);
    setError(null);
    setSuccess(null);

    try {
      await api.updateProfile({
        currentPassword,
        newPassword,
      });
      setSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const userInitials = (user?.name || user?.email || 'U').substring(0, 2).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8 animate-fade-in text-foreground">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <p className="font-mono text-xs text-primary font-bold uppercase tracking-wider mb-1">
          Identity & Workspace Configuration
        </p>
        <h1 className="font-serif text-3xl font-light text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal operator profile, security credentials, and workspace preferences for <strong className="text-foreground">{workspace?.name}</strong>.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded bg-destructive/10 border border-destructive/20 text-destructive font-mono text-xs flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs flex items-center gap-2">
          <CheckCircle2 size={14} />
          <span>{success}</span>
        </div>
      )}

      {/* User Profile Card */}
      <form onSubmit={handleSaveProfile} className="p-6 bg-card border border-border rounded shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground uppercase tracking-wider">
            <User size={16} className="text-primary" />
            <span>Operator Profile</span>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold border border-primary/20">
            {user?.role || 'USER'}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="relative group">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={profileName || 'Avatar'}
                className="w-16 h-16 rounded-full object-cover border-2 border-primary/40"
                onError={() => setAvatarUrl('')}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-secondary border border-border flex items-center justify-center font-mono text-lg font-bold text-foreground">
                {userInitials}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>{user?.name || 'Operator'}</span>
              <span className="text-xs text-muted-foreground font-mono">({user?.email})</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Your profile is visible to all collaborators in {workspace?.name}.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-1.5 font-semibold">
              DISPLAY NAME
            </label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g. Dilshad Ali Khan"
              className="w-full px-3.5 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground transition-colors"
            />
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-1.5 font-semibold">
              SOVEREIGN EMAIL (READ-ONLY)
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2 bg-background/50 border border-border/50 rounded text-muted-foreground font-mono text-xs cursor-not-allowed">
              <Mail size={13} className="text-muted-foreground" />
              <span>{user?.email || 'Loading...'}</span>
            </div>
          </div>
        </div>

        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5 font-semibold">
            AVATAR IMAGE URL (OPTIONAL)
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
            className="w-full px-3.5 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground transition-colors"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingProfile}
            className="px-5 py-2 bg-primary text-primary-foreground font-mono text-xs font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
          >
            {savingProfile ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>SAVING PROFILE...</span>
              </>
            ) : (
              <>
                <Save size={13} />
                <span>UPDATE PROFILE</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Security & Password Card */}
      <form onSubmit={handleChangePassword} className="p-6 bg-card border border-border rounded shadow-sm space-y-5">
        <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-3">
          <KeyRound size={15} className="text-primary" />
          <span>Security &amp; Password</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-1.5 font-semibold">
              CURRENT PASSWORD
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground transition-colors"
            />
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-1.5 font-semibold">
              NEW PASSWORD
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground transition-colors"
            />
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-1.5 font-semibold">
              CONFIRM NEW PASSWORD
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground transition-colors"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingPassword || !newPassword}
            className="px-5 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border font-mono text-xs font-semibold rounded transition-colors disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
          >
            {savingPassword ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>UPDATING PASSWORD...</span>
              </>
            ) : (
              <>
                <Shield size={13} />
                <span>CHANGE PASSWORD</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Workspace Properties Form */}
      <form onSubmit={handleSaveWorkspace} className="p-6 bg-card border border-border rounded shadow-sm space-y-5">
        <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground uppercase tracking-wider border-b border-border pb-3">
          <Sliders size={15} className="text-primary" />
          <span>Workspace Properties</span>
        </div>

        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5 font-semibold">
            WORKSPACE NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2 bg-background border border-border rounded text-foreground font-mono text-sm focus:outline-none focus:border-foreground transition-colors"
            required
          />
        </div>

        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5 font-semibold">
            PURPOSE &amp; DESCRIPTION
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Operational workspace purpose..."
            className="w-full px-3.5 py-2 bg-background border border-border rounded text-foreground font-sans text-xs focus:outline-none focus:border-foreground leading-relaxed transition-colors"
          />
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={savingWorkspace || !name.trim()}
            className="px-5 py-2 bg-primary text-primary-foreground font-mono text-xs font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
          >
            {savingWorkspace ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>SAVING...</span>
              </>
            ) : (
              <>
                <Save size={13} />
                <span>SAVE WORKSPACE CHANGES</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Data Portability Card */}
      <div className="p-6 bg-card border border-border rounded shadow-sm space-y-3">

        {/* BYOK API Keys Card */}
        <div className="border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground uppercase tracking-wider mb-3">
            <Sparkles size={15} className="text-primary" />
            <span>Bring Your Own Key (BYOK)</span>
          </div>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Supply your own AI provider API keys. Your key is encrypted with AES-256-GCM and never stored in plain text.
          </p>

          {/* No key warning */}
          {credentials.length === 0 && (
            <div className="flex items-start gap-3 p-4 mb-4 rounded-lg bg-amber-950/30 border border-amber-500/40">
              <KeyRound size={16} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-mono text-xs font-bold text-amber-300 mb-1">No API key configured</div>
                <p className="text-xs text-white/60 leading-relaxed">
                  The Ask agent cannot run without an AI provider key. Add a Claude, Gemini, or OpenAI key below — it's AES-256 encrypted and only used for your requests.
                </p>
              </div>
            </div>
          )}

          {/* Existing keys */}
          {credentials.length > 0 && (
            <div className="space-y-2 mb-4">
              {credentials.map((cred) => (
                <div key={cred.id} className="flex items-center justify-between px-3 py-2 bg-background border border-border rounded">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold uppercase">
                      {cred.provider}
                    </span>
                    <span className="font-mono text-xs text-foreground">{cred.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{cred.kind}</span>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        await api.revokeCredential(cred.id);
                        setCredentials(prev => prev.filter(c => c.id !== cred.id));
                        setSuccess('Credential revoked');
                        setTimeout(() => setSuccess(null), 3000);
                      } catch (e: any) { setError(e.message); }
                    }}
                    className="text-muted-foreground hover:text-destructive p-1"
                    title="Revoke key"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new key form */}
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={byokProvider}
              onChange={(e) => setByokProvider(e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground"
            >
              <option value="claude">Claude (Anthropic)</option>
              <option value="gemini">Gemini (Google)</option>
              <option value="openai">OpenAI / Codex</option>
            </select>
            <input
              type="password"
              value={byokKey}
              onChange={(e) => setByokKey(e.target.value)}
              placeholder="sk-ant-... or AIza..."
              className="flex-1 px-3 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground"
            />
            <input
              type="text"
              value={byokLabel}
              onChange={(e) => setByokLabel(e.target.value)}
              placeholder="Label (optional)"
              className="px-3 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground w-36"
            />
            <button
              onClick={async () => {
                if (!byokKey.trim()) return;
                setSavingByok(true);
                setError(null);
                try {
                  const newCred = await api.storeCredential({
                    provider: byokProvider,
                    secret: byokKey.trim(),
                    label: byokLabel.trim() || undefined,
                    workspaceId: workspace?.id,
                  });
                  setCredentials(prev => [{ ...newCred, kind: 'BYOK', createdAt: new Date().toISOString() }, ...prev]);
                  setByokKey('');
                  setByokLabel('');
                  setSuccess('API key stored securely');
                  setTimeout(() => setSuccess(null), 3000);
                } catch (e: any) { setError(e.message); }
                finally { setSavingByok(false); }
              }}
              disabled={savingByok || !byokKey.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground font-mono text-xs font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              {savingByok ? <RefreshCw size={12} className="animate-spin" /> : <KeyRound size={12} />}
              <span>{savingByok ? 'ENCRYPTING...' : 'ADD KEY'}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground uppercase tracking-wider">
          <Download size={15} className="text-emerald-400" />
          <span>Data Portability &amp; Backup</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Download your complete living filesystem, metadata manifests, and notes into an unencrypted standard ZIP archive.
        </p>

        <button
          type="button"
          onClick={handleExportZip}
          disabled={exporting}
          className="px-5 py-2 rounded bg-secondary hover:bg-secondary/80 border border-border text-foreground font-mono text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-sm"
        >
          {exporting ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              <span>PACKING ARCHIVE...</span>
            </>
          ) : (
            <>
              <Download size={13} />
              <span>DOWNLOAD WORKSPACE ZIP ARCHIVE</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
export default Settings;

