import React, { useState } from 'react';
import { InView } from '../motion/InView';
import { ShimmerText } from '../ui/shimmer-bg-text';

function AnimatedIcon({ variant }: { variant: 'orbit' | 'relay' | 'wave' | 'spark' }) {
  return (
    <span className="bento3-icon" data-variant={variant}>
      <span />
    </span>
  );
}

export const BentoGrid: React.FC = () => {
  const [activeTabTile2, setActiveTabTile2] = useState<'deterministic' | 'vector'>('deterministic');
  const [activeCommit, setActiveCommit] = useState(0);
  const [isSandboxRunning, setIsSandboxRunning] = useState(false);

  const commits = [
    { hash: 'e3b0c44', msg: 'fix(operations): adjust latency threshold 200ms', time: '14 mins ago' },
    { hash: '9fa810c', msg: 'docs(architecture): git-mount AWS VPC topology', time: '2 hours ago' },
    { hash: 'd7a1421', msg: 'audit(enclave): lock SHA-256 state on /chicago', time: 'Yesterday' },
  ];

  // Mouse spotlight glow handlers for cards
  const setCardGlow = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty('--bento3-x', `${e.clientX - rect.left}px`);
    target.style.setProperty('--bento3-y', `${e.clientY - rect.top}px`);
  };

  const clearCardGlow = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    target.style.removeProperty('--bento3-x');
    target.style.removeProperty('--bento3-y');
  };

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto relative z-10" id="features">
      <InView>
        <div className="mb-14">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-3">
            ARCHITECTURAL ADVANTAGES // 07 BENTO SUITE
          </p>
          <h2 className="font-serif text-4xl lg:text-5xl font-light leading-tight tracking-tight text-foreground">
            Precision engineering.<br />
            <ShimmerText className="italic">Designed for institutional trust.</ShimmerText>
          </h2>
        </div>
      </InView>

      {/* 4-Tile Bento Grid (Asymmetric 7+5 / 5+7 Linear/Attio Layout with No Gaps) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
        {/* ================= TILE 1: GIT-BACKED PROVENANCE (7 cols) ================= */}
        <div
          onMouseMove={setCardGlow}
          onMouseLeave={clearCardGlow}
          className="md:col-span-7 bg-card/90 border border-border p-6 sm:p-7 rounded-md shadow-xs hover:border-foreground/30 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden isolate"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[11px] px-2.5 py-1 bg-muted text-foreground rounded border border-border font-semibold tracking-wider">
                01 // AUDIT IMMUTABILITY
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground hidden sm:inline">Git Revisions & AST</span>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/80">
                  <AnimatedIcon variant="orbit" />
                </div>
              </div>
            </div>
            <h3 className="font-serif text-2xl font-normal text-foreground mb-2">
              Every thought committed to Git.
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-xl">
              Knowledge isn't trapped in opaque embedding vectors. Every reasoning step, file traversal, and resolution is written as plain Markdown and committed to a standard git repository.
            </p>
          </div>

          {/* Mini Interactive Git Log */}
          <div className="bg-background/90 border border-border/80 rounded p-4 font-mono text-xs space-y-2.5 relative z-10">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-2 border-b border-border/60">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-foreground font-medium">main (branch) — HEAD @ company_brain</span>
              </span>
              <span className="text-muted-foreground">3 COMMITS LOGGED</span>
            </div>
            {commits.map((c, i) => (
              <div
                key={c.hash}
                onClick={() => setActiveCommit(i)}
                className={`p-2 rounded cursor-pointer transition-colors flex items-center justify-between ${
                  activeCommit === i
                    ? 'bg-muted text-foreground border border-border font-semibold'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <span className="text-foreground font-bold">{c.hash}</span>
                  <span className="truncate max-w-[260px]">{c.msg}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{c.time}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>Attestation latency</span>
            <span className="font-bold text-foreground tracking-wide">4.2 ms</span>
          </div>

          {/* Cursor Spotlight Glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 -z-10"
            style={{
              background: 'radial-gradient(220px circle at var(--bento3-x, 50%) var(--bento3-y, 50%), rgba(255,180,0,0.12), transparent 70%)',
            }}
          />
        </div>

        {/* ================= TILE 2: ZERO VECTOR HALLUCINATION (5 cols) ================= */}
        <div
          onMouseMove={setCardGlow}
          onMouseLeave={clearCardGlow}
          className="md:col-span-5 bg-card/90 border border-border p-6 sm:p-7 rounded-md shadow-xs hover:border-foreground/30 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden isolate"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[11px] px-2.5 py-1 bg-muted text-foreground rounded border border-border font-semibold tracking-wider">
                02 // ZERO HALLUCINATION
              </span>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 bg-background border border-border p-0.5 rounded text-[10px] font-mono">
                  <button
                    onClick={() => setActiveTabTile2('deterministic')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      activeTabTile2 === 'deterministic' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Continewty
                  </button>
                  <button
                    onClick={() => setActiveTabTile2('vector')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      activeTabTile2 === 'vector' ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Vector RAG
                  </button>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/80">
                  <AnimatedIcon variant="relay" />
                </div>
              </div>
            </div>
            <h3 className="font-serif text-2xl font-normal text-foreground mb-2">
              Exact AST vs Probabilistic Guesses.
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Traditional vector search hallucinates proximity. Continewty performs deterministic filesystem traversal with line-number precision.
            </p>
          </div>

          <div className="bg-background/90 border border-border/80 rounded p-4 font-mono text-xs relative z-10">
            {activeTabTile2 === 'deterministic' ? (
              <div className="space-y-2 text-emerald-600 dark:text-emerald-400">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>METHOD: AST FILE GREP</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">100% ACCURATE</span>
                </div>
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-700 dark:text-emerald-300 text-[11px]">
                  ✓ Verified: <span className="font-bold text-foreground">chicago_deployment.md:14-22</span><br />
                  ✓ Exact line match with SHA-256 attestation
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-amber-600 dark:text-amber-400">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>METHOD: COSINE SIMILARITY</span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold">~68% APPROX</span>
                </div>
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-700 dark:text-amber-300 text-[11px]">
                  ⚠ Fuzzy chunk match (lost line numbers)<br />
                  ⚠ Prone to context window truncation
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>Traversal accuracy</span>
            <span className="font-bold text-foreground tracking-wide">100% Exact</span>
          </div>

          {/* Cursor Spotlight Glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 -z-10"
            style={{
              background: 'radial-gradient(220px circle at var(--bento3-x, 50%) var(--bento3-y, 50%), rgba(255,180,0,0.12), transparent 70%)',
            }}
          />
        </div>

        {/* ================= TILE 3: MULTIPLAYER COLLABORATION (5 cols) ================= */}
        <div
          onMouseMove={setCardGlow}
          onMouseLeave={clearCardGlow}
          className="md:col-span-5 bg-card/90 border border-border p-6 sm:p-7 rounded-md shadow-xs hover:border-foreground/30 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden isolate"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[11px] px-2.5 py-1 bg-muted text-foreground rounded border border-border font-semibold tracking-wider">
                03 // SHARED REALTIME
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground hidden sm:inline">Human + Agent Workspace</span>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/80">
                  <AnimatedIcon variant="wave" />
                </div>
              </div>
            </div>
            <h3 className="font-serif text-2xl font-normal text-foreground mb-2">
              Humans & agents in lockstep.
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Real-time multiplayer knowledge canvas where human decisions and autonomous agent actions execute side by side with live presence.
            </p>
          </div>

          <div className="bg-background/90 border border-border/80 rounded p-4 font-mono text-xs space-y-2 relative z-10">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-foreground font-semibold">Agent & Lead Engineer Active</span>
            </div>
            <div className="p-2 bg-muted rounded border border-border flex items-center justify-between">
              <span className="text-muted-foreground text-[11px]">Action Approval</span>
              <span className="text-[10px] px-2 py-0.5 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded font-bold">
                APPROVED
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>Sync protocol</span>
            <span className="font-bold text-foreground tracking-wide">CRDT / Git</span>
          </div>

          {/* Cursor Spotlight Glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 -z-10"
            style={{
              background: 'radial-gradient(220px circle at var(--bento3-x, 50%) var(--bento3-y, 50%), rgba(255,180,0,0.12), transparent 70%)',
            }}
          />
        </div>

        {/* ================= TILE 4: CRYPTOGRAPHIC ENCLAVES (7 cols) ================= */}
        <div
          onMouseMove={setCardGlow}
          onMouseLeave={clearCardGlow}
          className="md:col-span-7 bg-card/90 border border-border p-6 sm:p-7 rounded-md shadow-xs hover:border-foreground/30 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden isolate"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[11px] px-2.5 py-1 bg-muted text-foreground rounded border border-border font-semibold tracking-wider">
                04 // ENTERPRISE ENCLAVE
              </span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted-foreground hidden sm:inline">Isolated Execution</span>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/80">
                  <AnimatedIcon variant="spark" />
                </div>
              </div>
            </div>
            <h3 className="font-serif text-2xl font-normal text-foreground mb-2">
              Granular policies. Zero unauthorized writes.
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-xl">
              Agents operate inside strictly isolated policy containers. Every file read, git commit, or API query is evaluated against deterministic team authorization policies.
            </p>
          </div>

          <div className="bg-background/90 border border-border/80 rounded p-4 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div className="space-y-1">
              <div className="text-foreground font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>SANDBOX: POLICY_CONTAINER_V2</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Attestation: <span className="text-emerald-600 dark:text-emerald-400 font-bold">SHA-256 VALIDATED (e3b0c4...)</span>
              </p>
            </div>
            <button
              onClick={() => setIsSandboxRunning(!isSandboxRunning)}
              className="px-3 py-1.5 bg-primary text-primary-foreground border border-border rounded text-[11px] font-bold transition-colors cursor-pointer self-start sm:self-auto"
            >
              {isSandboxRunning ? 'HALT SANDBOX' : 'TEST AUDIT'}
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>Security posture</span>
            <span className="font-bold text-foreground tracking-wide">Enclave v2 // Verified</span>
          </div>

          {/* Cursor Spotlight Glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 -z-10"
            style={{
              background: 'radial-gradient(220px circle at var(--bento3-x, 50%) var(--bento3-y, 50%), rgba(255,180,0,0.12), transparent 70%)',
            }}
          />
        </div>
      </div>
    </section>
  );
};

export default BentoGrid;
