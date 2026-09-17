import React, { useEffect, useMemo, useRef, useState } from "react";

const STYLE_ID = "bento3-animations";

export interface BentoFlow {
  id: string;
  variant: "orbit" | "relay" | "wave" | "spark" | "loop";
  meta: string;
  title: string;
  description: string;
  statLabel: string;
  statValue: string;
  codeSnippet?: string;
}

export interface BentoMetric {
  label: string;
  value: string;
}

const defaultFlows: BentoFlow[] = [
  {
    id: "01",
    variant: "orbit",
    meta: "Audit Immutability",
    title: "Every Thought Committed to Git",
    description:
      "Knowledge isn't trapped in opaque embedding vectors. Every reasoning step, file traversal, and resolution is written as plain Markdown and committed to a standard git repository.",
    statLabel: "Attestation latency",
    statValue: "4.2 ms",
  },
  {
    id: "02",
    variant: "relay",
    meta: "Deterministic AST",
    title: "Exact AST vs Probabilistic Guesses",
    description:
      "Traditional vector search hallucinates proximity. Continewty performs deterministic filesystem traversal with line-number precision and cryptographic SHA-256 verification.",
    statLabel: "Traversal accuracy",
    statValue: "100%",
  },
  {
    id: "03",
    variant: "wave",
    meta: "Multiplayer Canvas",
    title: "Humans & Agents in Lockstep",
    description:
      "Real-time multiplayer knowledge canvas where human decisions and autonomous agent actions execute side by side with live presence and co-signed approvals.",
    statLabel: "Sync protocol",
    statValue: "CRDT / Git",
  },
  {
    id: "04",
    variant: "spark",
    meta: "Policy Enclave",
    title: "Granular Policies. Zero Drift",
    description:
      "Agents operate inside strictly isolated policy containers. Every file read, git commit, or API query is evaluated against deterministic team authorization policies.",
    statLabel: "Security posture",
    statValue: "Enclave v2",
  },
  {
    id: "05",
    variant: "loop",
    meta: "Continuous Memory",
    title: "Institutional Memory Synthesis",
    description:
      "Post-incident post-mortems and Slack discussions write back into the Git knowledge graph so institutional learning compounds automatically across team turnover.",
    statLabel: "Vector lock-in",
    statValue: "0%",
  },
];

const defaultMetrics: BentoMetric[] = [
  { label: "Traversal Speed", value: "4.2 ms" },
  { label: "Attestation Confidence", value: "100% SHA-256" },
  { label: "Vector Lock-In", value: "0% Pure Git" },
];

const palettes = {
  dark: {
    surface: "bg-background text-foreground",
    heading: "text-white",
    muted: "text-zinc-400",
    capsule: "bg-white/5 border-white/10 text-white/80",
    card: "bg-card/75 backdrop-blur-sm",
    cardBorder: "border-border hover:border-zinc-500/50",
    metric: "bg-card/60 border-border text-zinc-300",
    headingAccent: "bg-white/10",
    toggleSurface: "bg-white/10",
    toggle: "border-white/15 text-white",
    button: "border-white/15 text-white hover:border-white/40 hover:bg-white/10",
    gridColor: "rgba(255, 255, 255, 0.05)",
    overlay:
      "radial-gradient(ellipse at 50% 0%, rgba(20,20,20,0.5) 0%, rgba(10,10,10,0.85) 100%)",
    focusGlow: "rgba(255, 255, 255, 0.12)",
    iconStroke: "#f8fafc",
    iconTrail: "rgba(148, 163, 184, 0.55)",
  },
  light: {
    surface: "bg-slate-100 text-neutral-900",
    heading: "text-neutral-900",
    muted: "text-neutral-600",
    capsule: "bg-white/70 border-neutral-200 text-neutral-700",
    card: "bg-white/80",
    cardBorder: "border-neutral-200",
    metric: "bg-white border-neutral-200 text-neutral-600",
    headingAccent: "bg-neutral-900/10",
    toggleSurface: "bg-white",
    toggle: "border-neutral-300 text-neutral-900",
    button: "border-neutral-300 text-neutral-900 hover:border-neutral-500 hover:bg-neutral-900/5",
    gridColor: "rgba(17, 17, 17, 0.08)",
    overlay:
      "linear-gradient(180deg, rgba(248,250,252,0.96) 0%, rgba(241,245,249,0.68) 45%, rgba(248,250,252,0.96) 100%)",
    focusGlow: "rgba(15, 23, 42, 0.15)",
    iconStroke: "#111827",
    iconTrail: "rgba(30, 41, 59, 0.42)",
  },
};

const getRootTheme = (): "dark" | "light" => {
  if (typeof document === "undefined") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  }

  const root = document.documentElement;
  if (root.classList.contains("dark")) return "dark";
  if (root.dataset?.theme === "dark" || root.getAttribute("data-theme") === "dark") return "dark";
  if (root.classList.contains("light")) return "light";
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
};

interface BentoMonochromeProps {
  flows?: BentoFlow[];
  metrics?: BentoMetric[];
  title?: string;
  subtitle?: string;
  tagline?: string;
}

export const BentoMonochrome: React.FC<BentoMonochromeProps> = ({
  flows = defaultFlows,
  metrics = defaultMetrics,
  title = "Precision engineering built for institutional trust.",
  subtitle = "Deterministic AST traversal, immutable git revisions, and cryptographic policy enclaves without opaque vector hallucinations.",
  tagline = "ARCHITECTURAL ADVANTAGES // 07 BENTO SUITE",
}) => {
  const [theme, setTheme] = useState<"dark" | "light">(() => getRootTheme());
  const [introReady, setIntroReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.innerHTML = `
      @keyframes bento3-card-in {
        0% { opacity: 0; transform: translate3d(0, 24px, 0) scale(0.98); filter: blur(8px); }
        100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: blur(0); }
      }
      @keyframes bento3-flare {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes bento3-dash {
        0% { transform: translateX(-25%); opacity: 0; }
        30% { opacity: 1; }
        70% { opacity: 1; }
        100% { transform: translateX(25%); opacity: 0; }
      }
      @keyframes bento3-wave {
        0% { transform: translateX(-45%); }
        100% { transform: translateX(45%); }
      }
      @keyframes bento3-pulse {
        0% { transform: scale(0.8); opacity: 0.6; }
        70% { opacity: 0.05; }
        100% { transform: scale(1.35); opacity: 0; }
      }
      .bento3-card {
        opacity: 0;
        transform: translate3d(0, 24px, 0);
        filter: blur(8px);
        transition: border-color 300ms ease, background 300ms ease;
      }
      .bento3-card[data-visible="true"] {
        animation: bento3-card-in 600ms cubic-bezier(0.22, 0.68, 0, 1) forwards;
        animation-delay: var(--bento3-delay, 0ms);
      }
      .bento3-icon {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 2.75rem;
        width: 2.75rem;
        border-radius: 9999px;
        overflow: hidden;
        isolation: isolate;
      }
      .bento3-icon::before,
      .bento3-icon::after {
        content: "";
        position: absolute;
        inset: 4px;
        border-radius: inherit;
        border: 1px solid var(--bento3-icon-trail);
        opacity: 0.45;
      }
      .bento3-icon::after {
        inset: 10px;
        opacity: 0.2;
      }
      .bento3-icon[data-variant="orbit"] span {
        position: absolute;
        height: 140%;
        width: 3px;
        background: linear-gradient(180deg, transparent, var(--bento3-icon-stroke) 55%, transparent);
        transform-origin: center;
        animation: bento3-flare 8s linear infinite;
      }
      .bento3-icon[data-variant="relay"] span {
        position: absolute;
        inset: 14px;
        border-top: 1px solid var(--bento3-icon-stroke);
        border-bottom: 1px solid var(--bento3-icon-stroke);
        transform: skewX(-15deg);
      }
      .bento3-icon[data-variant="relay"] span::before,
      .bento3-icon[data-variant="relay"] span::after {
        content: "";
        position: absolute;
        height: 1px;
        width: 120%;
        left: -10%;
        background: linear-gradient(90deg, transparent, var(--bento3-icon-stroke), transparent);
        animation: bento3-dash 2.6s ease-in-out infinite;
      }
      .bento3-icon[data-variant="relay"] span::after {
        top: 70%;
        animation-delay: 0.9s;
      }
      .bento3-icon[data-variant="wave"] span {
        position: absolute;
        inset: 10px;
        border-radius: 999px;
        overflow: hidden;
      }
      .bento3-icon[data-variant="wave"] span::before {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent 5%, var(--bento3-icon-stroke) 50%, transparent 95%);
        transform: translateX(-45%);
        animation: bento3-wave 2.8s ease-in-out infinite alternate;
      }
      .bento3-icon[data-variant="spark"] span {
        position: absolute;
        inset: 0;
      }
      .bento3-icon[data-variant="spark"] span::before,
      .bento3-icon[data-variant="spark"] span::after {
        content: "";
        position: absolute;
        inset: 10px;
        border-radius: 9999px;
        border: 1px solid var(--bento3-icon-stroke);
        opacity: 0.28;
        animation: bento3-pulse 2.8s ease-out infinite;
      }
      .bento3-icon[data-variant="spark"] span::after {
        animation-delay: 0.9s;
      }
      .bento3-icon[data-variant="loop"] span {
        position: absolute;
        inset: 10px;
      }
      .bento3-icon[data-variant="loop"] span::before,
      .bento3-icon[data-variant="loop"] span::after {
        content: "";
        position: absolute;
        height: 1px;
        width: 100%;
        top: 50%;
        left: 0;
        background: linear-gradient(90deg, transparent, var(--bento3-icon-stroke), transparent);
      }
      .bento3-icon[data-variant="loop"] span::before {
        transform: rotate(90deg);
      }
      .bento3-icon[data-variant="loop"] span::after {
        opacity: 0.4;
        transform: rotate(0deg);
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (style.parentNode) style.remove();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      setIntroReady(true);
      setVisible(true);
      return;
    }
    const frame = window.requestAnimationFrame(() => setIntroReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    const syncTheme = () => {
      const next = getRootTheme();
      setTheme((prev) => (prev === next ? prev : next));
    };

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });

    const media =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    media?.addEventListener("change", syncTheme);

    return () => {
      observer.disconnect();
      media?.removeEventListener("change", syncTheme);
    };
  }, []);

  useEffect(() => {
    if (!sectionRef.current || typeof window === "undefined") return;
    const node = sectionRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const palette = useMemo(() => palettes[theme] || palettes.dark, [theme]);

  const containerStyle = useMemo(
    () =>
      ({
        "--bento3-grid-color": palette.gridColor,
        "--bento3-focus-glow": palette.focusGlow,
        "--bento3-icon-stroke": palette.iconStroke,
        "--bento3-icon-trail": palette.iconTrail,
      } as React.CSSProperties),
    [palette.gridColor, palette.focusGlow, palette.iconStroke, palette.iconTrail]
  );

  return (
    <div
      className={`relative w-full overflow-hidden transition-colors duration-500 ${palette.surface}`}
      style={containerStyle}
    >
      <section
        ref={sectionRef}
        className={`relative z-10 mx-auto flex max-w-7xl flex-col gap-10 py-16 px-6 md:gap-14 ${
          introReady && visible ? "" : "opacity-0"
        }`}
      >
        <div className="flex flex-col gap-4 max-w-3xl">
          <div className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest ${palette.muted}`}>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {tagline}
          </div>
          <h2 className={`font-serif text-4xl lg:text-5xl font-light leading-tight ${palette.heading}`}>
            {title}
          </h2>
          <p className={`font-sans text-sm sm:text-base ${palette.muted} leading-relaxed max-w-2xl`}>
            {subtitle}
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
          {flows.map((flow, index) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              palette={palette}
              index={index}
              visible={visible}
            />
          ))}
        </div>

        {/* Metrics Bar */}
        <div
          className={`grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border p-5 ${palette.cardBorder} ${palette.card}`}
        >
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className={`rounded-lg border px-5 py-4 font-mono text-center ${palette.metric}`}
            >
              <span className={`block text-[11px] ${palette.muted} tracking-wider uppercase`}>
                {metric.label}
              </span>
              <span className={`mt-1 block text-lg font-bold ${palette.heading} tracking-wide`}>
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

function FlowCard({
  flow,
  palette,
  index,
  visible,
}: {
  flow: BentoFlow;
  palette: BentoPalette;
  index: number;
  visible: boolean;
}) {
  const cardRef = useRef<HTMLElement | null>(null);

  const setGlow = (event: React.MouseEvent<HTMLElement>) => {
    const target = cardRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--bento3-x", `${event.clientX - rect.left}px`);
    target.style.setProperty("--bento3-y", `${event.clientY - rect.top}px`);
  };

  const clearGlow = () => {
    const target = cardRef.current;
    if (!target) return;
    target.style.removeProperty("--bento3-x");
    target.style.removeProperty("--bento3-y");
  };

  return (
    <article
      ref={cardRef}
      className={`bento3-card group relative overflow-hidden rounded-xl border ${palette.cardBorder} ${palette.card} p-6 transition-all duration-300 shadow-sm hover:shadow-md`}
      data-visible={visible}
      style={{ "--bento3-delay": `${index * 80}ms` } as React.CSSProperties}
      onMouseMove={setGlow}
      onMouseLeave={clearGlow}
    >
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${palette.capsule}`}>
            {flow.id} // {flow.meta}
          </span>
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${palette.cardBorder} bg-background/80`}
          >
            <AnimatedIcon variant={flow.variant} />
          </div>
        </div>

        <div className="space-y-2 mt-1">
          <h3 className={`font-serif text-xl sm:text-2xl font-normal leading-tight ${palette.heading} transition-colors`}>
            {flow.title}
          </h3>
          <p className={`font-sans text-xs sm:text-sm leading-relaxed ${palette.muted}`}>
            {flow.description}
          </p>
        </div>

        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between font-mono text-[11px] text-zinc-400">
          <span className={palette.muted}>{flow.statLabel}</span>
          <span className={`font-bold ${palette.heading} tracking-wide`}>{flow.statValue}</span>
        </div>
      </div>

      {/* Interactive Cursor Spotlight */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(180px circle at var(--bento3-x, 50%) var(--bento3-y, 50%), var(--bento3-focus-glow), transparent 70%)`,
        }}
      />
    </article>
  );
}

function AnimatedIcon({ variant }: { variant: BentoFlow["variant"] }) {
  return (
    <span className="bento3-icon" data-variant={variant}>
      <span />
    </span>
  );
}

export default BentoMonochrome;
