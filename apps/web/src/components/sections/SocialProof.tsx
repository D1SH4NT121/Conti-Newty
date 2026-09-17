import React from 'react';
import { InView } from '../motion/InView';

export const SocialProof: React.FC = () => {
  const logos = [
    { name: 'KINETIC INFRA', tag: 'SERIES B' },
    { name: 'LATENCY LABS', tag: 'FINTECH' },
    { name: 'VECTORSHIFT AI', tag: 'SECURITY' },
    { name: 'ORBITAL CLOUD', tag: 'DEVTOOLS' },
    { name: 'NEXUS DYNAMICS', tag: 'ENTERPRISE' },
  ];

  return (
    <section className="py-16 px-6 max-w-7xl mx-auto border-t border-border relative z-10">
      <InView>
        <div className="text-center mb-8">
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
            TRUSTED BY INSTITUTIONAL ENGINEERING & REASONING TEAMS
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 items-center justify-center opacity-70 dark:opacity-60">
          {logos.map((l) => (
            <div
              key={l.name}
              className="flex flex-col items-center justify-center py-4 px-2 text-center group cursor-default"
            >
              <span className="font-mono text-xs font-semibold tracking-wider text-foreground group-hover:text-primary transition-colors">
                {l.name}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground tracking-widest mt-1">
                [{l.tag}]
              </span>
            </div>
          ))}
        </div>
      </InView>
    </section>
  );
};
