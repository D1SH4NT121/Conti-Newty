import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, WorkspaceSummary } from '../../lib/api-client';
import { ShieldCheck, Lock, EyeOff, CheckCircle2, Shield, Plus, RefreshCw, Sparkles } from 'lucide-react';

export const Security: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const [readOnlyPaths, setReadOnlyPaths] = useState<Array<{ id: string; path: string }>>([]);
  const [newPathInput, setNewPathInput] = useState('');
  const [addingPath, setAddingPath] = useState(false);
  
  // Sanitization live test sandbox
  const [sampleText, setSampleText] = useState(
    'Contact founder at alex@acmecorp.io or call +1 (555) 234-5678. API Secret: sk-live-992384102934. Q3 ARR was $4,200,000.'
  );
  const [sanitizedResult, setSanitizedResult] = useState<{ anonymizedText: string; detections: any[] } | null>(null);
  const [testingSanitizer, setTestingSanitizer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSecurityRules = async () => {
    if (!workspace?.id) return;
    try {
      const paths = await api.getReadOnlyPaths(workspace.id);
      setReadOnlyPaths(paths || []);
    } catch (e) {
      console.warn('Could not load read-only paths:', e);
    }
  };

  useEffect(() => {
    loadSecurityRules();
  }, [workspace?.id]);

  const handleAddReadOnlyPath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPathInput.trim()) return;

    setAddingPath(true);
    setError(null);
    try {
      await api.addReadOnlyPath(workspace.id, newPathInput.trim());
      setSuccess(`Read-only rule added for "${newPathInput.trim()}".`);
      setNewPathInput('');
      await loadSecurityRules();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to add rule');
    } finally {
      setAddingPath(false);
    }
  };

  const handleTestSanitizer = async () => {
    if (!sampleText.trim()) return;
    setTestingSanitizer(true);
    setError(null);
    try {
      const res = await api.anonymizeData(workspace.id, { text: sampleText });
      setSanitizedResult(res);
    } catch (err: any) {
      setError(err.message || 'Sanitization failed');
    } finally {
      setTestingSanitizer(false);
    }
  };

  const auditLog = [
    { t: 'Just now', req: 'VERIFY_HASH', agent: 'Provenance Validator', path: 'sops/incident-response.md', result: '100% MATCH', ok: true },
    { t: '4 min ago', req: 'READ_DOCUMENT', agent: 'Navigation Agent', path: 'docs/architecture.md', result: '200 AUTHORIZED', ok: true },
    { t: '12 min ago', req: 'WRITE_ATTEMPT', agent: 'External Agent', path: 'sops/incident-response.md', result: '403 READ_ONLY', ok: false },
    { t: '1 hr ago', req: 'ANONYMIZE_OUTBOUND', agent: 'Security Enclave', path: 'LLM Outbound Buffer', result: 'SCRUBBED', ok: true }
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in text-foreground">
      {/* Header */}
      <div className="border-b border-white/10 pb-6">
        <p className="font-mono text-[10px] text-[#ff7597] font-bold tracking-widest uppercase mb-1">
          ZERO-TRUST ENCLAVE &amp; DATA PRIVACY
        </p>
        <h1 className="font-serif text-3xl font-light text-white">Security &amp; Governance</h1>
        <p className="text-sm text-white/60 mt-1 max-w-2xl">
          Configure physical read-only bounds, real-time outbound secret redaction, and access audit
          trails.
        </p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Immutable Read-Only Bounds */}
        <div className="p-6 bg-[#141312] border border-white/8 rounded-xl shadow-md space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
            <Lock size={15} className="text-[#ff7597]" />
            <span>Immutable Read-Only Bounds</span>
          </div>
          <p className="text-xs text-white/50 leading-relaxed">
            Files matching these paths are blocked from AI write tools, protecting institutional
            specifications from inadvertent overwrites.
          </p>

          <form onSubmit={handleAddReadOnlyPath} className="flex gap-2">
            <input
              type="text"
              value={newPathInput}
              onChange={(e) => setNewPathInput(e.target.value)}
              placeholder="sops/*.md or docs/secret.md"
              className="flex-1 px-3 py-2 bg-[#0c0b0a] border border-white/12 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-white/40"
            />
            <button
              type="submit"
              disabled={addingPath || !newPathInput.trim()}
              className="px-3.5 py-2 bg-white text-black hover:bg-emerald-400 hover:text-black font-mono text-xs font-bold rounded-lg transition-all disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <Plus size={13} />
              <span>ADD</span>
            </button>
          </form>

          <div className="space-y-1.5 pt-2">
            <div className="text-[11px] font-mono text-white/40 uppercase font-semibold">
              ACTIVE IMMUTABLE RULES ({readOnlyPaths.length})
            </div>
            {readOnlyPaths.length === 0 ? (
              <div className="p-3 bg-black/40 border border-white/8 rounded-lg text-white/40 font-mono text-xs">
                No custom read-only rules registered.
              </div>
            ) : (
              readOnlyPaths.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-2.5 bg-black/40 border border-white/8 rounded-lg font-mono text-xs text-white/80"
                >
                  <div className="flex items-center gap-2">
                    <Shield size={13} className="text-emerald-400" />
                    <span>{rule.path}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 rounded font-bold">
                    PROTECTED
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Data Sanitizer Sandbox */}
        <div className="p-6 bg-[#141312] border border-white/8 rounded-xl shadow-md space-y-4">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase tracking-wider">
            <EyeOff size={15} className="text-emerald-400" />
            <span>Outbound Prompt Sanitizer</span>
          </div>
          <p className="text-xs text-white/50 leading-relaxed">
            Test how Conti-Newty scrubs emails, phone numbers, financials, and API keys before
            sending context to external AI providers.
          </p>

          <div className="space-y-2">
            <textarea
              rows={3}
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              className="w-full p-3 bg-[#0c0b0a] border border-white/12 rounded-lg font-mono text-xs text-white focus:outline-none focus:border-white/40 leading-relaxed"
            />
            <button
              type="button"
              onClick={handleTestSanitizer}
              disabled={testingSanitizer || !sampleText.trim()}
              className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/15 text-white font-mono text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {testingSanitizer ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>SCRUBBING...</span>
                </>
              ) : (
                <>
                  <Sparkles size={12} className="text-[#ff7597]" />
                  <span>SCRUB SECRETS &amp; PREVIEW</span>
                </>
              )}
            </button>
          </div>

          {sanitizedResult && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-lg space-y-2 animate-fade-in">
              <div className="font-mono text-[10.5px] font-bold text-emerald-400 uppercase">
                ✓ Redacted Result:
              </div>
              <div className="p-2.5 bg-black/60 rounded font-mono text-xs text-emerald-200/90 whitespace-pre-wrap leading-relaxed">
                {sanitizedResult.anonymizedText}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security Audit Log */}
      <div className="space-y-3">
        <div className="font-mono text-xs text-white/50 uppercase font-bold tracking-wider">
          RECENT ENCLAVE ACCESS LOGS
        </div>

        <div className="border border-white/8 bg-[#141312] rounded-xl overflow-hidden shadow-md divide-y divide-white/8 font-mono text-xs">
          {auditLog.map((log, i) => (
            <div
              key={i}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 gap-2 hover:bg-[#181716] transition-colors ${
                !log.ok ? 'bg-red-950/20' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-white/40 text-[11px] w-20">{log.t}</span>
                <span className="font-bold text-white">{log.req}</span>
                <span className="text-white/30">·</span>
                <span className="text-white/60">{log.agent}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white/50 truncate max-w-xs">{log.path}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    log.ok
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-950/60 text-red-400 border border-red-500/30'
                  }`}
                >
                  {log.result}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default Security;
