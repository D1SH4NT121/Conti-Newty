import React, { useState } from 'react';

export interface ProblemSource {
  id: string;
  name: string;
  status: string;
  problem: string;
  path: string;
  icon: React.ReactNode;
  bgGradient: string;
  accentBorder: string;
}

export const PROBLEM_SOURCES: ProblemSource[] = [
  {
    id: 'slack',
    name: 'Slack',
    status: 'SILOED',
    problem: 'Decisions buried in ephemeral conversation threads',
    path: '#operations-alerts // 14,820 unindexed messages',
    bgGradient: 'radial-gradient(ellipse at top left, rgba(224, 30, 90, 0.12), transparent 70%), linear-gradient(180deg, #131118 0%, #0d0c10 100%)',
    accentBorder: 'rgba(224, 30, 90, 0.25)',
    icon: (
      <svg width="30" height="30" viewBox="0 0 122.8 122.8" className="shrink-0">
        <path fill="#E01E5A" d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9z"/>
        <path fill="#E01E5A" d="M32.3 77.6c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"/>
        <path fill="#36C5F0" d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2z"/>
        <path fill="#36C5F0" d="M45.2 32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"/>
        <path fill="#2EB67D" d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2z"/>
        <path fill="#2EB67D" d="M90.5 45.2c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"/>
        <path fill="#ECB22E" d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9z"/>
        <path fill="#ECB22E" d="M77.6 90.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"/>
      </svg>
    ),
  },
  {
    id: 'docs',
    name: 'Google Docs',
    status: 'STALE',
    problem: 'Outdated RFCs and unmaintained architecture proposals',
    path: 'Chicago Depot Review v3.docx (Last updated 11 mos ago)',
    bgGradient: 'radial-gradient(ellipse at top left, rgba(66, 133, 244, 0.12), transparent 70%), linear-gradient(180deg, #10141c 0%, #0c0e14 100%)',
    accentBorder: 'rgba(66, 133, 244, 0.25)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" className="shrink-0">
        <path fill="#4285F4" d="M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"/>
        <path fill="#A1C2FA" d="M15 2v5h5"/>
        <g stroke="#fff" strokeWidth="1.2">
          <line x1="8" y1="12" x2="16" y2="12"/>
          <line x1="8" y1="15.5" x2="16" y2="15.5"/>
          <line x1="8" y1="19" x2="13" y2="19"/>
        </g>
      </svg>
    ),
  },
  {
    id: 'github',
    name: 'GitHub',
    status: 'NO CONTEXT',
    problem: 'Code drift disconnected from incident post-mortems',
    path: 'infra-terraform/modules/chicago.tf',
    bgGradient: 'radial-gradient(ellipse at top left, rgba(255, 255, 255, 0.08), transparent 70%), linear-gradient(180deg, #141416 0%, #0d0d0f 100%)',
    accentBorder: 'rgba(255, 255, 255, 0.2)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff" className="shrink-0">
        <path d="M12 2C6.5 2 2 6.5 2 12c0 4.4 2.9 8.2 6.8 9.5.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .8.1-.7.4-1.1.6-1.4-2.3-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.5-1.4.1-2.8 0 0 .8-.3 2.8 1 .8-.2 1.7-.3 2.5-.3s1.7.1 2.5.3c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.5.1 2.8.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7 1 .7 2v3c0 .3.2.6.7.5A10 10 0 0 0 22 12c0-5.5-4.5-10-10-10z"/>
      </svg>
    ),
  },
  {
    id: 'drive',
    name: 'Google Drive',
    status: 'ISOLATED',
    problem: 'Unsearchable nested folders with broken permissions',
    path: '/Depot Logistics/Chicago 2024/Spreadsheets/',
    bgGradient: 'radial-gradient(ellipse at top left, rgba(0, 172, 71, 0.12), transparent 70%), linear-gradient(180deg, #101614 0%, #0b100e 100%)',
    accentBorder: 'rgba(0, 172, 71, 0.25)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 87.3 78" className="shrink-0">
        <path fill="#0066DA" d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z"/>
        <path fill="#00AC47" d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 47.5C.4 48.9 0 50.45 0 52h27.5z"/>
        <path fill="#EA4335" d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 52c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.87 11.62z"/>
        <path fill="#00832D" d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.15.45-4.5 1.2z"/>
        <path fill="#2684FC" d="M59.8 52H27.5L13.75 75.8c1.35.8 2.9 1.2 4.5 1.2h50.9c1.6 0 3.15-.45 4.5-1.2z"/>
        <path fill="#FFBA00" d="M73.4 26.5L60.65 4.5c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 52h27.45c0-1.55-.4-3.1-1.2-4.5z"/>
      </svg>
    ),
  },
  {
    id: 'jira',
    name: 'Jira',
    status: 'CLOSED',
    problem: 'Ticket context closed and separated from active codebase',
    path: 'OPS-1049: Latency review threshold',
    bgGradient: 'radial-gradient(ellipse at top left, rgba(38, 132, 255, 0.12), transparent 70%), linear-gradient(180deg, #10141a 0%, #0c0e14 100%)',
    accentBorder: 'rgba(38, 132, 255, 0.25)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" className="shrink-0">
        <path fill="#2684FF" d="M11.53 2c0 2.4-2 4.4-4.4 4.4H5.1v2c0 2.4 2 4.4 4.4 4.4h1.9V7.9c0-2.4-2-4.4-4.4-4.4h4.5z"/>
        <path fill="#2684FF" d="M12.47 22c0-2.4 2-4.4 4.4-4.4h2v-2c0-2.4-2-4.4-4.4-4.4h-1.9v9c0 2.4 2 4.4 4.4 4.4h-4.5z" opacity="0.6"/>
        <path fill="#2684FF" d="M12 2h-.5c0 2.4 2 4.4 4.4 4.4h1.9v1.9c0 2.4-2 4.4-4.4 4.4V6.4C13.4 4 15.4 2 17.8 2H12z" opacity="0.35"/>
      </svg>
    ),
  },
  {
    id: 'tribal',
    name: 'Tribal Memory',
    status: 'LOST',
    problem: 'Critical operational SOPs only known by departing leads',
    path: 'Unwritten Lead Engineer deployment checklists',
    bgGradient: 'radial-gradient(ellipse at top left, rgba(255, 138, 128, 0.12), transparent 70%), linear-gradient(180deg, #161112 0%, #0f0b0c 100%)',
    accentBorder: 'rgba(255, 138, 128, 0.25)',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff8a80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M12 3c4 0 5 3 5 5.5S15.5 13 14 13c1.5 1 1 3.5-1 3.5-1.2 0-1.8-.8-2-1.5"/>
        <path d="M12 3c-4 0-5 3-5 5.5S8.5 13 10 13"/>
        <path d="M9 17h6"/>
        <path d="M10 20h4"/>
      </svg>
    ),
  },
];

export const ProblemHoverExpand: React.FC = () => {
  const [expandedIndex, setExpandedIndex] = useState<number>(0); // Default to Slack (0)

  return (
    <div className="w-full">
      {/* Desktop & Tablet: Hover-Expand Column Layout */}
      <div className="hidden md:block bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl overflow-hidden">
        <div className="flex items-stretch h-[440px] border border-white/8 rounded-xl bg-[#111114] overflow-hidden">
          {PROBLEM_SOURCES.map((source, index) => {
            const isExpanded = expandedIndex === index;

            return (
              <div
                key={source.id}
                onMouseEnter={() => setExpandedIndex(index)}
                onClick={() => setExpandedIndex(index)}
                className={`relative flex items-stretch border-r border-white/8 last:border-r-0 cursor-pointer overflow-hidden transition-all duration-600 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  isExpanded ? 'flex-[10] cursor-default' : 'flex-[1] hover:bg-white/[0.03]'
                }`}
                style={{
                  background: isExpanded ? source.bgGradient : undefined,
                }}
              >
                {/* Collapsed Rail (Always rendered for smooth layout & accessibility) */}
                <div
                  className={`flex flex-col items-center justify-between py-6 px-2 w-16 shrink-0 transition-opacity duration-300 select-none ${
                    isExpanded ? 'opacity-0 pointer-events-none absolute left-0 top-0 bottom-0' : 'opacity-100'
                  }`}
                >
                  {/* Subtle miniature brand icon at top */}
                  <div className="w-6 h-6 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-opacity scale-75">
                    {source.icon}
                  </div>

                  {/* Vertical Source Name Label */}
                  <div
                    className="font-mono text-[11.5px] uppercase tracking-[0.2em] text-white/40 font-semibold whitespace-nowrap transition-colors duration-300 group-hover:text-white/80"
                    style={{
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                    }}
                  >
                    {source.name}
                  </div>

                  {/* Small index badge at bottom */}
                  <div className="font-mono text-[9px] text-white/30 font-bold">
                    0{index + 1}
                  </div>
                </div>

                {/* Expanded State Content Panel */}
                <div
                  className={`flex-1 flex flex-col justify-between p-7 sm:p-8 transition-all duration-500 delay-75 ${
                    isExpanded
                      ? 'opacity-100 pointer-events-auto translate-x-0'
                      : 'opacity-0 pointer-events-none translate-x-4 absolute inset-0'
                  }`}
                >
                  {/* Top: Brand Logo + Status Badge */}
                  <div>
                    <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 shadow-inner flex items-center justify-center">
                          {source.icon}
                        </div>
                        <div>
                          <div className="font-mono text-[10px] text-white/50 uppercase tracking-widest">
                            DISCONNECTED SILO 0{index + 1}
                          </div>
                          <h3 className="font-sans text-xl sm:text-2xl font-semibold text-white tracking-tight">
                            {source.name}
                          </h3>
                        </div>
                      </div>

                      <span className="font-mono text-[10px] px-2.5 py-1 bg-red-950/60 text-red-400 border border-red-500/30 rounded-full font-bold tracking-wider shadow-sm">
                        ● {source.status}
                      </span>
                    </div>

                    {/* Middle: Problem Narrative */}
                    <div className="space-y-3 max-w-xl">
                      <div className="font-mono text-[11px] text-red-400/90 font-medium tracking-wide uppercase">
                        Entropy Pattern
                      </div>
                      <p className="font-serif text-2xl sm:text-[26px] font-light leading-snug text-white/95 text-balance">
                        &ldquo;{source.problem}&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Bottom: Monospace File / Thread Reference */}
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <div className="flex items-center gap-2 text-white/60 truncate mr-3">
                        <span className="text-white/40">PATH //</span>
                        <span className="text-white/80 font-mono truncate">{source.path}</span>
                      </div>
                      <span className="text-[10px] text-white/30 uppercase tracking-widest shrink-0">
                        ATT-REQUIRED
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile (<768px): Responsive Stacked Cards Fallback */}
      <div className="grid grid-cols-1 gap-3.5 md:hidden">
        {PROBLEM_SOURCES.map((source, index) => (
          <div
            key={source.id}
            className="p-5 bg-[#111114] border border-white/10 rounded-xl shadow-md flex flex-col justify-between"
            style={{ background: source.bgGradient }}
          >
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded bg-black/40 border border-white/10">
                    {source.icon}
                  </div>
                  <span className="font-mono text-sm font-semibold text-white">
                    {source.name}
                  </span>
                </div>
                <span className="font-mono text-[9px] px-2 py-0.5 bg-red-950/60 text-red-400 border border-red-500/30 rounded-full font-bold">
                  {source.status}
                </span>
              </div>
              <p className="text-sm text-white/85 font-medium leading-relaxed mb-3">
                {source.problem}
              </p>
            </div>
            <div className="font-mono text-[10.5px] text-white/50 truncate pt-2.5 border-t border-white/10">
              {source.path}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProblemHoverExpand;
