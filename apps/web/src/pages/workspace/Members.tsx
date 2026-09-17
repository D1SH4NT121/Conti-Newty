import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, WorkspaceSummary, WorkspaceMemberItem } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
import { UserPlus, Mail, Check, Copy, Trash2, Key, Users } from 'lucide-react';

export const Members: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const { user } = useAuth();
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ email: string; inviteUrl: string } | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const list = await api.getWorkspaceMembers(workspace.id);
      setMembers(list);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
    // Load or create join code
    if (workspace?.organizationId) {
      api
        .createJoinCode(workspace.organizationId, {
          workspaceId: workspace.id,
          role: 'member',
        })
        .then((res) => {
          if (res?.joinCode?.code) {
            setJoinCode(res.joinCode.code);
          }
        })
        .catch(() => {});
    }
  }, [workspace?.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setError(null);
    setInviteResult(null);

    try {
      const orgId = workspace.organizationId || (await api.getMe()).user?.organizationId;
      if (!orgId) throw new Error('No organization ID associated with workspace');

      const res = await api.createInvite(orgId, {
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole.toUpperCase(),
        workspaceId: workspace.id,
      });

      const fullUrl = `${window.location.origin}${res.invite.inviteUrl}`;
      setInviteResult({
        email: res.invite.email,
        inviteUrl: fullUrl,
      });
      setInviteEmail('');
      await loadMembers();
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the workspace?')) return;
    try {
      await api.removeWorkspaceMember(workspace.id, memberId);
      await loadMembers();
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  const handleCopy = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in text-foreground">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <p className="font-mono text-[10px] text-[#ff7597] font-bold tracking-widest uppercase mb-1">
          ACCESS CONTROL &amp; TEAM MULTIPLAYER
        </p>
        <h1 className="font-serif text-3xl font-light text-white">Workspace Members</h1>
        <p className="text-sm text-white/60 mt-1 max-w-2xl">
          Manage authorized collaborators and provision access tokens for {workspace?.name}.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 font-mono text-xs">
          {error}
        </div>
      )}

      {/* Quick Join Code Card */}
      {joinCode && (
        <div className="p-6 bg-[#141312] border border-white/8 rounded-xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Key size={16} className="text-emerald-400" />
              <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                Instant Workspace Join Code
              </span>
            </div>
            <p className="text-xs text-white/50 leading-relaxed">
              Teammates can paste this code at <code className="text-white/80">/enter</code> to
              instantly gain access to this workspace.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-4 py-2 rounded-lg bg-black/60 border border-white/15 font-mono text-sm font-bold text-emerald-400 tracking-wider">
              {joinCode}
            </div>
            <button
              onClick={() => handleCopy(joinCode, 'code')}
              className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedCode ? 'COPIED' : 'COPY'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Invite Collaborator Form */}
      <div className="p-6 bg-[#141312] border border-white/8 rounded-xl shadow-md space-y-4">
        <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
          <UserPlus size={16} className="text-[#ff7597]" />
          <span>Invite New Collaborator</span>
        </div>

        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Mail size={14} className="absolute left-3.5 top-3.5 text-white/40" />
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@institution.com"
              className="w-full pl-9 pr-4 py-2.5 bg-[#0c0b0a] border border-white/12 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-white/40"
              required
            />
          </div>

          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as any)}
            className="px-3 py-2.5 bg-[#0c0b0a] border border-white/12 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-white/40"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="viewer">Viewer</option>
          </select>

          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            className="px-5 py-2.5 bg-white text-black hover:bg-emerald-400 hover:text-black font-mono text-xs font-bold rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            {inviting ? 'CREATING...' : 'SEND INVITATION →'}
          </button>
        </form>

        {inviteResult && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 space-y-2 animate-fade-in font-mono text-xs">
            <div className="font-bold flex items-center gap-1.5 text-emerald-400">
              <Check size={14} />
              <span>Invite link generated for {inviteResult.email}!</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={inviteResult.inviteUrl}
                className="flex-1 px-3 py-1.5 bg-black/60 border border-emerald-500/30 rounded text-emerald-200 text-xs font-mono select-all"
              />
              <button
                onClick={() => handleCopy(inviteResult.inviteUrl, 'link')}
                className="px-3 py-1.5 bg-emerald-500 text-black hover:bg-emerald-400 font-bold rounded text-xs flex items-center gap-1 cursor-pointer"
              >
                {copiedLink ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedLink ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Members Roster List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between font-mono text-xs text-white/50 uppercase font-bold tracking-wider">
          <div className="flex items-center gap-2">
            <Users size={14} />
            <span>ACTIVE MEMBERS ({members.length})</span>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center bg-[#141312] border border-white/8 rounded-xl font-mono text-xs text-white/40">
            Loading team members...
          </div>
        ) : (
          <div className="border border-white/8 bg-[#141312] rounded-xl overflow-hidden shadow-md divide-y divide-white/8">
            {members.map((m) => {
              const displayName = m.user?.name || m.user?.email?.split('@')[0] || 'Member';
              const isMe = m.userId === user?.id;

              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-4 hover:bg-[#181716] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {m.user?.avatarUrl ? (
                      <img
                        src={m.user.avatarUrl}
                        alt={displayName}
                        className="w-8 h-8 rounded-full object-cover border border-white/15"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-mono text-xs font-bold shrink-0">
                        {displayName[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate flex items-center gap-2">
                        <span>{displayName}</span>
                        {isMe && (
                          <span className="font-mono text-[9px] px-1.5 py-0.2 bg-white/10 text-white/80 rounded border border-white/10">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-xs text-white/40 truncate">{m.user?.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs px-2.5 py-1 bg-white/5 border border-white/10 text-white/80 rounded-md capitalize font-semibold">
                      {m.role}
                    </span>
                    {!isMe && (
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        className="p-1.5 text-white/30 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
export default Members;
