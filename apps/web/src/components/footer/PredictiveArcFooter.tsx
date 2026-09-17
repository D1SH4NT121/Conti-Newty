import React from 'react';
import PredictiveArc from '../originkit/ui/predictive-arc';

interface PredictiveArcFooterProps {
  onEnterWorkspace?: () => void;
}

export const PredictiveArcFooter: React.FC<PredictiveArcFooterProps> = () => {
  return (
    <footer className="relative border-t border-white/10 bg-[#181515] text-[#F4F1EA] overflow-hidden">
      {/* Top Precision Bar (Conti-Newty Minimalist Nav Strip) */}
      <div className="border-b border-white/10 bg-[#181515]/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-6 font-mono text-xs text-zinc-300">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-[#FFA100]" />
            <span className="font-bold text-white tracking-wider">CONTI-NEWTY</span>
            <span className="text-zinc-400">— Institutional Memory for Autonomous Reasoning</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <a href="#problem" className="hover:text-white transition-colors">Problem</a>
            <a href="#traversal" className="hover:text-white transition-colors">Mechanism</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#integrations" className="hover:text-white transition-colors">Agent MCP</a>
          </div>

          <div className="text-zinc-400">
            <span>© 2026 CONTI-NEWTY // Git-Backed Truth</span>
          </div>
        </div>
      </div>

      {/* Main Originkit Predictive Arc Rising From Bottom Horizon */}
      <div className="relative w-full min-h-[440px] md:min-h-[480px] flex flex-col justify-between">
        <PredictiveArc
          background="#181515"
          baseColor="#FFA100"
          accentColor="#FBDA0C"
          highlight="#FFC400"
          density={120}
          dotSize={380}
          speed={100}
          arch={{ peak: 35, archHeight: 70, thickness: 160, falloff: 250 }}
          pointer={{ enabled: true, radius: 240, strength: 60 }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'auto',
          }}
        />

        {/* Ambient Top Subtle Vignette */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#181515] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FFA100]/25 to-transparent" />

        {/* Foreground Content Container */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-6 pt-12 pb-8 flex flex-col justify-between h-full pointer-events-none">
          {/* Center Showcase Section */}
          <div className="py-6 md:py-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-7 space-y-4">
              <h3 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-light text-white tracking-tight leading-[1.15]">
                Permanent context for <br />
                <span className="italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-[#FFC400]">
                  autonomous intelligence.
                </span>
              </h3>
              <p className="font-sans text-sm sm:text-base text-zinc-300 max-w-xl leading-relaxed">
                Connect reasoning agents to a mathematically verifiable, Git-backed memory substrate. Zero hallucinations. Exact traversability.
              </p>
            </div>

            {/* Navigation & Protocol Columns */}
            <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 gap-6 font-mono text-xs pointer-events-auto">
              <div>
                <h4 className="text-white font-semibold tracking-wider uppercase mb-3 text-[11px]">
                  Navigation
                </h4>
                <ul className="space-y-2.5 text-zinc-400">
                  <li><a href="#problem" className="hover:text-white transition-colors">Problem</a></li>
                  <li><a href="#traversal" className="hover:text-white transition-colors">Mechanism</a></li>
                  <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                  <li><a href="#integrations" className="hover:text-white transition-colors">Agent MCP</a></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-semibold tracking-wider uppercase mb-3 text-[11px]">
                  Protocol
                </h4>
                <ul className="space-y-2.5 text-zinc-400">
                  <li><span className="hover:text-white transition-colors cursor-pointer">Deterministic Tree</span></li>
                  <li><span className="hover:text-white transition-colors cursor-pointer">Context Engine</span></li>
                  <li><span className="hover:text-white transition-colors cursor-pointer">Branch Handoff</span></li>
                  <li><span className="hover:text-white transition-colors cursor-pointer">Git State L2</span></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-semibold tracking-wider uppercase mb-3 text-[11px]">
                  System
                </h4>
                <ul className="space-y-2.5 text-zinc-400">
                  <li><span className="hover:text-white transition-colors cursor-pointer">CLI &amp; SDK</span></li>
                  <li><span className="hover:text-white transition-colors cursor-pointer">API Specs</span></li>
                  <li><span className="hover:text-white transition-colors cursor-pointer">Status Page</span></li>
                  <li><span className="hover:text-white transition-colors cursor-pointer">Security</span></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Metabar */}
          <div className="pt-6 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs text-zinc-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] pointer-events-auto">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFA100]" />
              <span className="font-bold text-white tracking-wider">CONTI-NEWTY</span>
              <span className="hidden sm:inline text-zinc-300">— Git-Backed Truth</span>
            </div>

            <div className="text-center text-zinc-200 text-[11px] font-medium">
              Move pointer across to inspect predictive curvature
            </div>

            <div className="flex items-center gap-4 text-[11px] text-zinc-300">
              <span>© 2026 CONTI-NEWTY</span>
              <span className="text-zinc-500">//</span>
              <span>ALL REASONING RECORDED</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
