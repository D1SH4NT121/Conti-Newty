import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

// Navigation & Hero Components
import { MarketingNavbar } from '../components/navigation/MarketingNavbar';
import { HeroConvergenceBeam } from '../components/hero/HeroConvergenceBeam';
import { HeroAmbientCards } from '../components/hero/HeroAmbientCards';
import { SpinningBorderButton } from '../components/ui/spinning-border-button';
import { FlameButton } from '../components/ui/flame-button';
import { AnimatedBackgroundLines } from '../components/ui/animated-background-lines';
import { ShimmerText } from '../components/ui/shimmer-bg-text';
import { GradientBars } from '../components/ui/gradient-bars-background';

// Section Components
import { ProofStrip } from '../components/sections/ProofStrip';
import { BentoGrid } from '../components/sections/BentoGrid';
import { AgentIntegration } from '../components/sections/AgentIntegration';
import { SocialProof } from '../components/sections/SocialProof';
import { TextRevealFaqs } from '../components/ui/text-reveal-faqs';
import { CinematicFooter } from '../components/ui/motion-footer';
import { ProblemHoverExpand } from '../components/sections/ProblemHoverExpand';

// Motion Primitives & React Bits
import { InView } from '../components/motion/InView';
import { AnimatedGroup } from '../components/motion/AnimatedGroup';
import { TextScramble } from '../components/motion/TextScramble';
import { AnimatedBackgroundHighlight } from '../components/motion/AnimatedBackground';
import { DecryptedText } from '../components/reactbits/DecryptedText';

// Backgrounds
import { KnowledgeTopologyBackground } from '../components/backgrounds/KnowledgeTopologyBackground';
import { TraversalBeamsBackground } from '../components/backgrounds/TraversalBeamsBackground';
import { AmbientLightRays } from '../components/backgrounds/AmbientLightRays';

/* ==========================================================================
   HERO PRODUCT UI — DOCKED LIVING WORKSPACE SIMULATION
   ========================================================================== */
function HeroDockedUI() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => (s + 1) % 6), 2600);
    return () => clearInterval(t);
  }, []);

  const steps = [
    { label: '01 ASK', query: '"Why did the Chicago deployment miss its target?"', icon: '❓', state: 'PARSING INTENT' },
    { label: '02 TRAVERSE', query: 'Scanning /company_brain/operations/chicago...', icon: '📁', state: 'AST MATCHED' },
    { label: '03 OPEN', query: 'Loaded /operations/chicago_deployment.md', icon: '📄', state: 'FILE MOUNTED' },
    { label: '04 READ', query: 'Lines 14–18: Latency threshold shifted 200ms → 800ms', icon: '🔍', state: 'ANOMALY ISOLATED' },
    { label: '05 ATTEST', query: 'SHA-256: e3b0c44298fc1c149afbf4c8996fb92427ae...', icon: '🛡️', state: 'HASH VERIFIED' },
    { label: '06 RECORD', query: 'Committed remediation SOP to Git (branch: main)', icon: '💾', state: 'IMMUTABLE RECORD' },
  ];

  const current = steps[step];

  return (
    <div className="bg-card border border-border rounded-md shadow-2xl overflow-hidden relative z-20 max-w-4xl mx-auto">
      {/* Chrome Window Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background/80 font-mono text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          <span className="text-muted-foreground ml-2 text-[11px]">continewty-agent // reasoning-runtime</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
            {current.state}
          </span>
        </div>
      </div>

      {/* Terminal Body */}
      <div className="p-6 bg-background/95 font-mono text-xs space-y-4">
        {/* Step Progress Pill Row */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 bg-card border border-border/80 p-1 rounded">
          {steps.map((st, i) => (
            <button
              key={st.label}
              onClick={() => setStep(i)}
              className={`py-1.5 px-2 rounded text-[10px] tracking-wider transition-all text-center cursor-pointer ${
                step === i
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : step > i
                  ? 'text-foreground bg-secondary/50'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Dynamic Execution Feed */}
        <div className="bg-card/70 border border-border/70 p-4 rounded min-h-[90px] flex flex-col justify-center">
          <div className="flex items-center gap-2 text-muted-foreground text-[11px] mb-1">
            <span>{current.icon}</span>
            <span className="text-foreground font-semibold">{current.label}:</span>
          </div>
          <div className="text-foreground text-sm font-medium leading-relaxed flex items-center">
            <span>{current.query}</span>
            <span className="inline-block w-2 h-4 bg-foreground ml-1.5 animate-cursor-blink" />
          </div>
        </div>

        {/* Provenance Metadata Bar */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/60">
          <div className="flex items-center gap-3">
            <span>Storage: <strong className="text-foreground">Git Repository</strong></span>
            <span>Mode: <strong className="text-emerald-500 font-semibold">Deterministic AST</strong></span>
          </div>
          <div className="font-mono text-muted-foreground font-semibold">
            Latency: 4.2ms // Zero Vector Drift
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   MAIN CONTINIEWTY 13-SECTION ARCHITECTURAL LANDING PAGE
   ========================================================================== */
export const Landing: React.FC = () => {
  const navigate = useNavigate();

  const onEnterWorkspace = () => {
    navigate('/demo');
  };

  // Traversal Stepper State (Section 5: Mechanism)
  const [traversalStep, setTraversalStep] = useState(3);
  const [isAutoCycling, setIsAutoCycling] = useState(true);

  useEffect(() => {
    if (!isAutoCycling) return;
    const timer = setInterval(() => {
      setTraversalStep((prev) => (prev % 7) + 1);
    }, 2800);
    return () => clearInterval(timer);
  }, [isAutoCycling]);

  const traversalStates = [
    { num: 1, name: 'QUESTION', label: '01 QUESTION' },
    { num: 2, name: 'DISCOVERY', label: '02 DISCOVERY' },
    { num: 3, name: 'LOCATE', label: '03 LOCATE' },
    { num: 4, name: 'OPEN', label: '04 OPEN' },
    { num: 5, name: 'READ', label: '05 READ' },
    { num: 6, name: 'HASH', label: '06 HASH' },
    { num: 7, name: 'PROVENANCE', label: '07 PROVENANCE' },
  ];

  const evidenceLines = [
    { line: 14, text: 'The terraform configuration drift caused' },
    { line: 15, text: 'the allowed latency threshold to increase' },
    { line: 16, text: 'from 200ms to 800ms during the deployment.', highlight: true },
    { line: 17, text: 'This went undetected until post-deploy monitoring.' },
    { line: 18, text: 'Automated fallback was triggered at 14:08.' },
  ];

  // FAQ State (Section 11)
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does Continewty differ from standard Vector RAG?',
      a: 'Standard RAG splits text into arbitrary chunks and converts them to opaque embeddings. Continewty maintains plain Markdown in a Git repository, using deterministic AST traversal and grep with exact line numbers and SHA-256 verification.',
    },
    {
      q: 'Where is our company knowledge stored?',
      a: 'In a standard Git repository that you own. Continewty connects directly to your GitHub, GitLab, or self-hosted Git remote. There are zero proprietary vector lock-ins.',
    },
    {
      q: 'Can autonomous agents write back to our Company Brain?',
      a: 'Yes, but strictly under policy enclave guardrails. Agents can draft changes or commit verified incident resolutions as git branches/PRs requiring human co-signing before merge.',
    },
    {
      q: 'What happens if a source like Slack or Google Drive is disconnected?',
      a: 'All past synchronized knowledge remains permanently accessible in your immutable Git repository. Continewty never loses historical knowledge when third-party APIs experience downtime.',
    },
    {
      q: 'Is our data used to train any external AI models?',
      a: 'Never. Continewty adheres to strict Zero Data Retention policies. Your code and company context are never used for model fine-tuning or training.',
    },
  ];

  // The 6 Concrete Fragmented Sources (Section 3)
  const fragmentedSources = [
    {
      name: 'Slack',
      status: 'SILOED',
      problem: 'Decisions buried in ephemeral conversation threads',
      path: '#operations-alerts // 14,820 unindexed messages',
      icon: '💬',
    },
    {
      name: 'Google Docs',
      status: 'STALE',
      problem: 'Outdated RFCs and unmaintained architecture proposals',
      path: 'Chicago Depot Review v3.docx (Last updated 11 mos ago)',
      icon: '📄',
    },
    {
      name: 'GitHub',
      status: 'NO CONTEXT',
      problem: 'Code drift disconnected from incident post-mortems',
      path: 'infra-terraform/modules/chicago.tf',
      icon: '🐙',
    },
    {
      name: 'Google Drive',
      status: 'ISOLATED',
      problem: 'Unsearchable nested folders with broken permissions',
      path: '/Depot Logistics/Chicago 2024/Spreadsheets/',
      icon: '📁',
    },
    {
      name: 'Jira',
      status: 'CLOSED',
      problem: 'Ticket context closed and separated from active codebase',
      path: 'OPS-1049: Latency review threshold',
      icon: '🎯',
    },
    {
      name: 'Tribal Memory',
      status: 'LOST',
      problem: 'Critical operational SOPs only known by departing leads',
      path: 'Unwritten Lead Engineer deployment checklists',
      icon: '🧠',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-white/20 selection:text-white relative overflow-x-hidden font-sans">
      {/* ==========================================================================
          1. NAV
          Logo, minimal links, single CTA. Sets the visual grammar.
          ========================================================================== */}
      <MarketingNavbar onEnterWorkspace={onEnterWorkspace} />

      {/* ==========================================================================
          2. HERO
          Headline + serif/italic tagline + ambient floating peripheral source cards.
          ========================================================================== */}
      <section className="relative isolate w-full min-h-[580px] sm:min-h-[640px] lg:min-h-[720px] flex items-center justify-center pt-20 pb-24 overflow-hidden">
        {/* Gradient Bars Background */}
        <GradientBars
          numBars={15}
          gradientFrom="rgb(255, 182, 12)"
          gradientTo="transparent"
          animationDuration={2.2}
          className="pointer-events-none opacity-75"
        />

        {/* Ambient Floating Peripheral Source Cards across full Hero section */}
        <HeroAmbientCards />

        <div className="relative z-10 max-w-7xl mx-auto px-6 w-full flex items-center justify-center">

          <div className="text-center max-w-3xl mx-auto relative z-10">
            <InView>
              <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl font-light leading-[1.08] tracking-tight text-foreground mb-6">
                Scattered context becomes<br />
                <ShimmerText className="italic">traversable, proven truth.</ShimmerText>
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8 font-normal">
                Continewty turns fragmented institutional knowledge across Slack, Docs, GitHub, and Jira into a Git-backed knowledge graph that autonomous agents and engineering teams can reason over step-by-step.
              </p>

              <div className="flex items-center justify-center font-mono text-xs">
                <a href="#traversal" className="inline-block">
                  <SpinningBorderButton className="text-xs py-1">
                    WATCH LIVE TRAVERSAL
                  </SpinningBorderButton>
                </a>
              </div>
            </InView>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          3. PROBLEM — FRAGMENTED CONTEXT
          Six source cards making the pain concrete and specific (no duplicate animation).
          ========================================================================== */}
      <section className="py-24 bg-card/60 border-y border-border relative z-10" id="problem">
        <div className="max-w-7xl mx-auto px-6">
          <InView>
            <div className="max-w-3xl mb-14">
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-3">
                THE PROBLEM // FRAGMENTED CONTEXT
              </p>
              <h2 className="font-serif text-4xl lg:text-5xl font-light leading-tight text-foreground">
                Institutional memory is decaying across<br />
                <ShimmerText className="italic">six disconnected silos.</ShimmerText>
              </h2>
            </div>
          </InView>

          <ProblemHoverExpand />
        </div>
      </section>

      {/* ==========================================================================
          4. PROOF OF RETRIEVAL — THE FILE-TREE "FOUND" PANEL
          Direct answer to problem: concrete query resolving to concrete file & commit.
          ========================================================================== */}
      <section className="py-20 bg-background border-b border-border relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <InView>
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-5 space-y-4">
                <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  PROOF OF RETRIEVAL // WHAT HAPPENS INSTEAD
                </p>
                <h2 className="font-serif text-3xl lg:text-4xl font-light leading-tight text-foreground">
                  One question.<br />
                  <ShimmerText className="italic">One exact, attested file.</ShimmerText>
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Instead of guessing relevance through opaque vector embeddings, Continewty resolves queries to exact Git-mounted Markdown files with line-number precision and cryptographic SHA-256 attestation.
                </p>
              </div>

              <div className="lg:col-span-7 bg-card border border-border p-6 rounded-md shadow-lg">
                <div className="flex items-center justify-between pb-3 border-b border-border mb-4 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span>📁</span>
                    <span className="font-semibold text-foreground">/company_brain/operations/</span>
                  </div>
                  <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                    GIT-MOUNTED
                  </span>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  <div className="p-3 bg-muted border border-border rounded flex items-center justify-between text-foreground font-semibold">
                    <div className="flex items-center gap-2">
                      <span>📄</span>
                      <span>chicago_deployment.md</span>
                    </div>
                    <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded font-bold">
                      FOUND (LINES 14–18)
                    </span>
                  </div>
                  <div className="p-2 text-muted-foreground flex items-center justify-between">
                    <span>└── q3_review.md</span>
                    <span className="text-[10px]">VERIFIED IN TREE</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                  <span>Plain Markdown Files</span>
                  <span className="text-emerald-500 font-semibold">Zero Vector Lock-In</span>
                </div>
              </div>
            </div>
          </InView>
        </div>
      </section>

      {/* ==========================================================================
          5. MECHANISM — LIVE REASONING PIPELINE
          7-step stepper + live terminal panel showing the technical process in motion.
          ========================================================================== */}
      <section className="py-24 border-b border-border bg-card/40 relative overflow-hidden" id="traversal">
        <TraversalBeamsBackground opacity={0.05} />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <InView>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
              <div>
                <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase mb-3">
                  MECHANISM // LIVE REASONING PIPELINE
                </p>
                <h2 className="font-serif text-4xl lg:text-5xl font-light leading-tight text-foreground">
                  From question to evidence,<br />
                  <ShimmerText className="italic">every step visible in real time.</ShimmerText>
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsAutoCycling(!isAutoCycling)}
                  className="font-mono text-xs px-3.5 py-1.5 border border-border bg-card text-foreground hover:border-foreground transition-colors rounded flex items-center gap-2 cursor-pointer"
                >
                  <span className={`w-2 h-2 rounded-full ${isAutoCycling ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                  <span>{isAutoCycling ? 'AUTO CYCLING' : 'PAUSED'}</span>
                </button>
              </div>
            </div>
          </InView>

          {/* Fully Lit Convergence Visual Payoff */}
          <div className="relative mb-12">
            <HeroConvergenceBeam />
          </div>

          {/* 7-Step Traversal State Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-px bg-border mb-8 relative z-10 rounded overflow-hidden shadow-xs">
            {traversalStates.map((st) => {
              const isActive = traversalStep === st.num;
              const isCompleted = traversalStep > st.num;
              return (
                <button
                  key={st.num}
                  onClick={() => {
                    setTraversalStep(st.num);
                    setIsAutoCycling(false);
                  }}
                  className={`p-3 text-left transition-all relative cursor-pointer ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                      : isCompleted
                      ? 'bg-card text-foreground'
                      : 'bg-background text-muted-foreground hover:bg-card'
                  }`}
                >
                  <div className="font-mono text-[10px] tracking-wider mb-1 opacity-70">
                    {st.label}
                  </div>
                  <div className="font-mono text-xs font-semibold flex items-center gap-1.5">
                    {isCompleted && <span className="text-emerald-500 text-[10px]">✓</span>}
                    <span>{st.name}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Traversal Terminal & Verification Engine */}
          <div className="grid lg:grid-cols-12 gap-8 items-start relative z-10">
            {/* Left: Filesystem & Path Traversal (5 cols) */}
            <div className="lg:col-span-5 bg-card border border-border p-6 rounded-md shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <span className="font-mono text-xs text-muted-foreground">COMPANY BRAIN FILESYSTEM</span>
                <span className="font-mono text-[10px] text-emerald-500 font-bold uppercase">
                  {traversalStep >= 3 ? 'PATH MATCHED' : 'TRAVERSING...'}
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                <div className="text-foreground font-semibold flex items-center gap-2">
                  <span>📁</span>
                  <span>/company_brain</span>
                </div>
                <div className="pl-4 space-y-1 text-muted-foreground">
                  <div className="relative py-1 px-2 rounded flex items-center justify-between">
                    {traversalStep >= 3 && (
                      <AnimatedBackgroundHighlight
                        layoutId="active-folder"
                        className="absolute inset-0 bg-primary/10 border border-primary/20 rounded"
                      />
                    )}
                    <span className={`relative z-10 ${traversalStep >= 3 ? 'text-foreground font-semibold' : ''}`}>
                      📁 operations/
                    </span>
                    {traversalStep >= 3 && (
                      <span className="relative z-10 text-[9px] bg-primary text-primary-foreground px-1.5 py-0.2 rounded font-bold">
                        TARGET
                      </span>
                    )}
                  </div>

                  {traversalStep >= 4 && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="pl-6 space-y-1 text-foreground"
                    >
                      <div className="text-foreground font-semibold flex items-center gap-1">
                        <span>📄</span>
                        <span>chicago_deployment.md</span>
                      </div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        <span>📄</span>
                        <span>q3_review.md</span>
                      </div>
                    </motion.div>
                  )}

                  <div className="text-muted-foreground py-0.5">📁 engineering/</div>
                  <div className="text-muted-foreground py-0.5">📁 finance/</div>
                  <div className="text-muted-foreground py-0.5">📁 security/</div>
                </div>
              </div>
            </div>

            {/* Right: Live Terminal Console & Hashing (7 cols) */}
            <div className="lg:col-span-7 bg-[#141311] text-[#F4F1EA] border border-border p-6 rounded-md shadow-lg font-mono text-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-emerald-400 font-bold uppercase tracking-wider text-[11px]">
                    STATE 0{traversalStep}: {traversalStates[traversalStep - 1].name}
                  </span>
                </div>
                <span className="text-[10px] text-white/40">SHA-256 PIPELINE</span>
              </div>

              {/* Terminal Logs */}
              <div className="space-y-2 text-white/80">
                <div>
                  <span className="text-white/40 block text-[10px]">PROMPT QUERY</span>
                  <p className="text-zinc-200 font-serif italic text-base mt-0.5">
                    "Why did the Chicago deployment miss its target?"
                  </p>
                </div>

                {traversalStep >= 2 && (
                  <div className="pt-2 text-emerald-400 text-[11px]">
                    DISCOVERING COMPANY BRAIN: Scanning 847 git-tracked documents...
                  </div>
                )}

                {/* Evidence Lines Reading */}
                {traversalStep >= 5 && (
                  <div className="bg-black/40 border border-white/10 p-3 rounded space-y-1 mt-2">
                    <div className="flex justify-between text-[10px] text-white/40 mb-2 border-b border-white/10 pb-1">
                      <span>chicago_deployment.md</span>
                      <span>Lines 14–18</span>
                    </div>
                    <AnimatedGroup staggerDuration={0.08}>
                      {evidenceLines.map((line) => (
                        <div
                          key={line.line}
                          className={`flex gap-3 text-xs leading-relaxed ${
                            line.highlight ? 'text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded font-semibold' : 'text-white/70'
                          }`}
                        >
                          <span className="text-white/30 w-5 shrink-0 text-right">{line.line}</span>
                          <span>{line.text}</span>
                        </div>
                      ))}
                    </AnimatedGroup>
                  </div>
                )}

                {/* Hashing & Verification */}
                {traversalStep >= 6 && (
                  <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-white/40 block text-[10px]">HASHING SOURCE SHA-256</span>
                      <span className="text-emerald-400 font-mono text-xs">
                        <DecryptedText
                          text="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                          speed={20}
                          maxIterations={6}
                        />
                      </span>
                    </div>
                    {traversalStep >= 7 && (
                      <div className="shrink-0">
                        <span className="font-mono text-xs px-3 py-1 bg-white text-black font-bold rounded tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                          <span>✓</span>
                          <TextScramble duration={0.4}>SHA-256 VERIFIED</TextScramble>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==========================================================================
          6. TRUST / PROVENANCE STRIP
          States architectural guarantees as fact.
          ========================================================================== */}
      <ProofStrip />

      {/* ==========================================================================
          7. FEATURE GRID (BENTO GRID)
          Asymmetric breadth: RBAC permissions, audit log, zero hallucination.
          ========================================================================== */}
      <BentoGrid />

      {/* ==========================================================================
          8. AGENT / INTEGRATION SECTION
          MCP + REST API code snippet for autonomous agents and developer tooling.
          ========================================================================== */}
      <AgentIntegration />

      {/* ==========================================================================
          9. SOCIAL PROOF
          Grayscale technical logo strip.
          ========================================================================== */}
      <SocialProof />

      {/* ==========================================================================
          10. FAQ ACCORDION SECTION (TEXT REVEAL BLURRED STAGGER)
          Handles specific technical objections (disconnected sources, self-hosting).
          ========================================================================== */}
      <div className="border-t border-border bg-background relative z-10">
        <TextRevealFaqs />
      </div>

      {/* ==========================================================================
          13. CINEMATIC FOOTER (Motion Footer with Predictive Arc Horizon)
          ========================================================================== */}
      <CinematicFooter onEnterWorkspace={onEnterWorkspace} />
    </div>
  );
};
