import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, WorkspaceSummary, WorkspaceFileEntry } from '../../lib/api-client';
import { GitPullRequest, Check, X, ArrowRight, FileText, Clock, RefreshCw } from 'lucide-react';

interface ProposedChange {
  id: string;
  workspaceId: string;
  filePath: string;
  originalContent: string;
  proposedContent: string;
  diff: string;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED';
  proposedBy: string;
  reviewedBy?: string | null;
  createdAt: string;
  description?: string;
}

export const Work: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const [files, setFiles] = useState<WorkspaceFileEntry[]>([]);
  const [targetPath, setTargetPath] = useState('sops/incident-response.md');
  const [description, setDescription] = useState('Upgrade P0 on-call escalation SLA from 14 minutes to 18 seconds.');
  const [proposedContent, setProposedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [proposals, setProposals] = useState<ProposedChange[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'queue'>('create');

  const loadData = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const [filesList, changesList] = await Promise.all([
        api.listFiles(workspace.id),
        api.listProposedChanges(workspace.id),
      ]);
      setFiles(filesList);
      setProposals(changesList || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspace?.id]);

  // When targetPath changes, load its current content
  useEffect(() => {
    if (!workspace?.id || !targetPath.trim()) return;
    api
      .getRawFile(workspace.id, targetPath.trim())
      .then((res) => {
        setProposedContent(res.content);
      })
      .catch(() => {
        setProposedContent(`# ${targetPath}\n\nInitial institutional proposal content.\n`);
      });
  }, [workspace?.id, targetPath]);

  const handlePropose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPath.trim() || !proposedContent.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const created = await api.createProposedChange(workspace.id, {
        filePath: targetPath.trim(),
        proposedContent,
        description: description.trim() || undefined,
      });

      setSuccess(`Proposal created for "${targetPath}". Unified diff computed.`);
      setProposals((prev) => [created, ...prev]);
      setActiveTab('queue');
    } catch (err: any) {
      setError(err.message || 'Failed to submit proposal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (changeId: string) => {
    try {
      await api.approveProposedChange(workspace.id, changeId);
      setSuccess('Change approved and committed to living disk storage!');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to approve change');
    }
  };

  const handleReject = async (changeId: string) => {
    try {
      await api.rejectProposedChange(workspace.id, changeId);
      setSuccess('Change proposal rejected.');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to reject change');
    }
  };

  const pendingCount = proposals.filter((p) => p.status === 'PROPOSED').length;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in text-foreground">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <p className="font-mono text-[10px] text-[#ff7597] font-bold tracking-widest uppercase mb-1">
          CHANGE GOVERNANCE &amp; SOVEREIGN ATTESTATIONS
        </p>
        <h1 className="font-serif text-3xl font-light text-white">
          Work &amp; Proposal Review
        </h1>
        <p className="text-sm text-white/60 mt-1 max-w-2xl">
          AI agents and collaborators propose changes via unified diffs. Approvals apply changes
          atomically to living disk storage with cryptographic provenance.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 font-mono text-xs rounded-lg transition-all cursor-pointer ${
            activeTab === 'create'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-white/60 hover:text-white'
          }`}
        >
          Create Proposal
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2 font-mono text-xs rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'queue'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-white/60 hover:text-white'
          }`}
        >
          <span>Review Queue</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[10px] font-bold">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 font-mono text-xs">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-mono text-xs">
          {success}
        </div>
      )}

      {activeTab === 'create' ? (
        /* Propose Form */
        <form onSubmit={handlePropose} className="space-y-6">
          <div className="p-6 bg-[#141312] border border-white/8 rounded-xl shadow-md space-y-4">
            <div className="font-mono text-xs text-white/50 uppercase tracking-wider font-bold">
              PROPOSAL PARAMETERS
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-xs text-white/60 block mb-1.5">
                  TARGET DOCUMENT PATH
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={targetPath}
                    onChange={(e) => setTargetPath(e.target.value)}
                    placeholder="sops/incident-response.md"
                    className="w-full px-3.5 py-2.5 bg-[#0c0b0a] border border-white/12 rounded-lg font-mono text-xs text-white focus:outline-none focus:border-white/40"
                    required
                  />
                  {files.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {files.slice(0, 4).map((f) => (
                        <button
                          key={f.path}
                          type="button"
                          onClick={() => setTargetPath(f.path)}
                          className="text-[10px] font-mono px-2 py-0.5 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded border border-white/10"
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="font-mono text-xs text-white/60 block mb-1.5">
                  CHANGE RATIONALE &amp; DESCRIPTION
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain why this change is necessary..."
                  className="w-full px-3.5 py-2.5 bg-[#0c0b0a] border border-white/12 rounded-lg font-mono text-xs text-white focus:outline-none focus:border-white/40"
                />
              </div>
            </div>

            <div>
              <label className="font-mono text-xs text-white/60 block mb-1.5">
                PROPOSED FILE CONTENT
              </label>
              <textarea
                rows={10}
                value={proposedContent}
                onChange={(e) => setProposedContent(e.target.value)}
                className="w-full p-4 bg-[#0c0b0a] border border-white/12 rounded-lg font-mono text-xs text-white focus:outline-none focus:border-white/40 leading-relaxed font-mono"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !targetPath.trim() || !proposedContent.trim()}
              className="px-6 py-3 bg-white text-black hover:bg-emerald-400 hover:text-black font-mono text-xs font-bold transition-all rounded-lg disabled:opacity-40 flex items-center gap-2 cursor-pointer shadow-md"
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>COMPUTING DIFF...</span>
                </>
              ) : (
                <>
                  <GitPullRequest size={14} />
                  <span>SUBMIT CHANGE PROPOSAL →</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Review Queue */
        <div className="space-y-4">
          {proposals.length === 0 ? (
            <div className="p-12 text-center bg-[#141312] border border-white/8 rounded-xl font-mono text-xs text-white/40">
              No change proposals currently in queue.
            </div>
          ) : (
            proposals.map((p) => (
              <div
                key={p.id}
                className="p-6 bg-[#141312] border border-white/8 rounded-xl shadow-md space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-[#ff7597]" />
                    <span className="font-mono text-xs font-bold text-white">{p.filePath}</span>
                    <span className="text-white/30">·</span>
                    <span className="font-mono text-[11px] text-white/50">
                      {p.description || 'No description provided'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        p.status === 'APPROVED'
                          ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                          : p.status === 'REJECTED'
                          ? 'bg-red-950/60 text-red-400 border border-red-500/40'
                          : 'bg-amber-950/60 text-amber-300 border border-amber-500/40 animate-pulse'
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>

                {/* Diff Viewer */}
                <div className="p-4 bg-[#0c0b0a] border border-white/8 rounded-lg font-mono text-xs text-white/80 overflow-x-auto whitespace-pre-wrap max-h-56 leading-relaxed">
                  {p.diff || 'Unified Diff generated.'}
                </div>

                {p.status === 'PROPOSED' && (
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      onClick={() => handleReject(p.id)}
                      className="px-4 py-2 bg-red-950/40 border border-red-500/30 text-red-300 hover:bg-red-900/60 font-mono text-xs rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <X size={14} />
                      <span>REJECT PROPOSAL</span>
                    </button>
                    <button
                      onClick={() => handleApprove(p.id)}
                      className="px-4 py-2 bg-emerald-500 text-black hover:bg-emerald-400 font-mono text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Check size={14} />
                      <span>APPROVE &amp; APPLY TO DISK</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
export default Work;
