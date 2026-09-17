import React, { useState, useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api, WorkspaceSummary, TaskResponse, VerifiedCitation } from '../../lib/api-client';
import { ShieldCheck, FileText, RefreshCw } from 'lucide-react';

interface Stage {
  label: string;
  detail: string;
  status: 'pending' | 'running' | 'done';
}

export const Ask: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [prompt, setPrompt] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TaskResponse | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [clientVerified, setClientVerified] = useState<Record<string, boolean | null>>({});
  const [verifying, setVerifying] = useState<Record<string, boolean>>({});

  const handleAsk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setClientVerified({});

    setStages([
      { label: 'QUERY', detail: `Received: "${prompt}"`, status: 'running' },
      { label: 'DISCOVER', detail: 'AgentRunner scanning living filesystem...', status: 'pending' },
      { label: 'GROUND', detail: 'Extracting verbatim source line coordinates...', status: 'pending' },
      { label: 'PROVENANCE', detail: 'Computing SHA-256 slice fingerprint...', status: 'pending' },
      { label: 'ANSWER', detail: 'Delivering verified grounded completion', status: 'pending' },
    ]);

    try {
      setStages((prev) =>
        prev.map((s, i) =>
          i === 0 ? { ...s, status: 'done' } : i === 1 ? { ...s, status: 'running' } : s
        )
      );

      const res = await api.createTask(workspace.id, prompt);

      setStages((prev) => prev.map((s) => ({ ...s, status: 'done' })));
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Execution error');
      setStages((prev) =>
        prev.map((s) =>
          s.status === 'running' ? { ...s, status: 'done', detail: 'Failed' } : s
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchParams.get('q')) {
      handleAsk();
    }
  }, []);

  const handleIndependentVerify = async (citation: VerifiedCitation, idx: number) => {
    try {
      setVerifying((prev) => ({ ...prev, [idx]: true }));
      const raw = await api.getRawFile(workspace.id, citation.filePath);
      const lines = raw.content.split('\n');
      const start = Math.max(1, citation.startLine);
      const end = Math.min(lines.length, citation.endLine);
      const slice = lines.slice(start - 1, end).join('\n');

      const encoder = new TextEncoder();
      const data = encoder.encode(slice);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      setClientVerified((prev) => ({
        ...prev,
        [idx]: hashHex.toLowerCase() === citation.contentHash.toLowerCase(),
      }));
    } catch (err) {
      setClientVerified((prev) => ({ ...prev, [idx]: false }));
    } finally {
      setVerifying((prev) => ({ ...prev, [idx]: false }));
    }
  };

  const suggestQuestions = [
    'What is our incident response escalation SOP?',
    'What are the core engineering team policies?',
    'Show deployment rollback protocols',
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in text-foreground">
      {/* Header */}
      <div>
        <p className="font-mono text-[10px] text-[#ff7597] font-bold tracking-widest uppercase mb-2">
          AUTONOMOUS REASONING ENGINE
        </p>
        <h1 className="font-serif text-3xl font-light text-white">
          What would you like to <em>know?</em>
        </h1>
        <p className="font-mono text-xs text-white/50 mt-1">
          Grounded in living filesystem:{' '}
          <span className="text-white/80">data/workspaces/{workspace.id}/</span>
        </p>
      </div>

      {/* Query Input Box */}
      <div className="space-y-3">
        <form onSubmit={handleAsk} className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask anything about your Company Brain..."
            disabled={loading}
            className="flex-1 px-4 py-3 bg-[#141312] border border-white/12 text-white font-serif text-base focus:outline-none focus:border-white/40 transition-colors placeholder-white/30 shadow-inner rounded-lg disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="font-mono text-xs font-bold tracking-widest px-6 py-3 bg-white text-black hover:bg-emerald-400 hover:text-black transition-colors rounded-lg disabled:opacity-40 flex items-center gap-2 cursor-pointer shadow-md"
          >
            {loading ? 'REASONING...' : 'ASK →'}
          </button>
        </form>

        {!result && !loading && (
          <div className="flex gap-2 flex-wrap pt-1">
            {suggestQuestions.map((q) => (
              <button
                key={q}
                onClick={() => setPrompt(q)}
                className="font-mono text-[10.5px] px-3 py-1.5 border border-white/10 bg-[#141312] text-white/70 hover:border-white/30 hover:text-white transition-colors rounded-md truncate cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="border border-red-500/30 bg-red-950/40 p-4 rounded-lg font-mono text-xs text-red-300">
          ERROR: {error}
        </div>
      )}

      {/* Live Traversal Terminal-like Output */}
      {stages.length > 0 && (
        <div className="bg-[#121216] border border-white/10 text-white rounded-xl p-5 shadow-lg space-y-4 font-mono text-xs animate-fade-in">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] tracking-widest text-white/50 uppercase font-bold">
              NAVIGATION AGENT
            </span>
            <span className="text-[10px] text-emerald-400 ml-auto font-bold uppercase">
              {loading ? 'TRAVERSING' : 'COMPLETE'}
            </span>
          </div>
          <div className="space-y-2">
            {stages.map((st, i) => (
              <div key={i} className="flex items-start gap-4">
                <span className="text-[10px] text-white/40 w-24 shrink-0 uppercase font-bold">
                  {st.label}
                </span>
                <span
                  className={`text-[11px] ${
                    st.status === 'done'
                      ? 'text-white/80'
                      : st.status === 'running'
                      ? 'text-amber-300 animate-pulse'
                      : 'text-white/30'
                  }`}
                >
                  {st.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-6 animate-fade-in">
          {/* Answer Card */}
          <div className="border border-white/10 bg-[#141312] p-6 rounded-xl shadow-lg space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3">
              <span className="font-mono text-[10px] font-bold text-[#ff7597] tracking-widest uppercase">
                ANSWER
              </span>
              <div className="h-px flex-1 bg-white/10" />
              <span className="font-mono text-[10px] text-white/40 uppercase">
                TASK: {result.taskId.slice(0, 8)}
              </span>
            </div>

            <div className="font-serif text-lg text-white leading-relaxed whitespace-pre-wrap">
              &ldquo;{result.answer}&rdquo;
            </div>

            {/* Citations section */}
            {result.verifiedCitations && result.verifiedCitations.length > 0 && (
              <div className="pt-6 border-t border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold text-white/50 tracking-widest uppercase">
                    VERIFICATION EVIDENCE ({result.verifiedCitations.length})
                  </span>
                  <span className="font-mono text-[10px] px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 rounded font-bold uppercase">
                    100% SHA-256 GROUNDED
                  </span>
                </div>

                <div className="space-y-3">
                  {result.verifiedCitations.map((cit, idx) => (
                    <div
                      key={idx}
                      className="border border-white/8 bg-[#181716] p-4 rounded-xl space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <FileText size={14} className="text-[#ff7597]" />
                          <span className="font-bold text-white">{cit.filePath}</span>
                          <span className="text-white/30">·</span>
                          <span className="text-white/60">
                            Lines {cit.startLine}–{cit.endLine}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-white/50">
                            SHA:{' '}
                            <code className="text-white/90">
                              {cit.contentHash.slice(0, 10)}...
                            </code>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleIndependentVerify(cit, idx)}
                            disabled={verifying[idx]}
                            className="font-mono text-[10px] px-2.5 py-1 border border-white/15 bg-white/5 hover:border-white/30 text-white transition-colors rounded flex items-center gap-1 font-bold uppercase cursor-pointer"
                          >
                            {verifying[idx] ? (
                              <RefreshCw size={10} className="animate-spin" />
                            ) : null}
                            <span>{verifying[idx] ? 'AUDITING...' : 'AUDIT HASH'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="bg-[#0c0b0a] border border-white/8 p-3 rounded-lg font-mono text-xs text-white/80 whitespace-pre-wrap leading-relaxed">
                        {cit.snippet}
                      </div>

                      {clientVerified[idx] !== undefined && (
                        <div
                          className={`font-mono text-[11px] font-bold flex items-center gap-1.5 ${
                            clientVerified[idx] ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          <ShieldCheck size={14} />
                          <span>
                            {clientVerified[idx]
                              ? '✓ Proof confirmed: Web Crypto hash matches slice byte-for-byte.'
                              : '✗ Hash Mismatch: Source file has diverged.'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Explainer / Informational Footer */}
      {!result && !loading && (
        <div className="border-t border-white/10 pt-8">
          <div className="font-mono text-[10px] font-bold text-white/50 tracking-widest uppercase mb-4">
            HOW PROVENANCE REASONING WORKS
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-white/8 bg-[#141312] p-4 rounded-xl">
              <div className="font-mono text-xs font-bold text-white mb-1">1. TRAVERSE</div>
              <p className="text-xs text-white/60 leading-relaxed">
                Agent navigates physical markdown hierarchies within the workspace container.
              </p>
            </div>
            <div className="border border-white/8 bg-[#141312] p-4 rounded-xl">
              <div className="font-mono text-xs font-bold text-white mb-1">2. GROUND</div>
              <p className="text-xs text-white/60 leading-relaxed">
                Exact line-level coordinates are extracted verbatim — never synthesized or hallucinated.
              </p>
            </div>
            <div className="border border-white/8 bg-[#141312] p-4 rounded-xl">
              <div className="font-mono text-xs font-bold text-white mb-1">3. PROVE</div>
              <p className="text-xs text-white/60 leading-relaxed">
                Source slices receive cryptographic SHA-256 hashes audit-verifiable directly in the browser.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default Ask;
