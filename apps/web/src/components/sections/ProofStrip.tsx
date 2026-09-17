import React from 'react';
import { InView } from '../motion/InView';

export const ProofStrip: React.FC = () => {
  const proofs = [
    { title: 'SHA-256 PIPELINE', desc: 'Cryptographic step attestation', badge: 'VERIFIED' },
    { title: 'GIT-BACKED STORAGE', desc: 'Plain Markdown repository files', badge: 'NATIVE' },
    { title: 'ZERO VECTOR LOCK-IN', desc: 'Deterministic AST file indexing', badge: '100% OPEN' },
    { title: 'ENCLAVE SANDBOX', desc: 'Zero-trust authorization layer', badge: 'ISOLATED' },
    { title: 'HUMAN-IN-THE-LOOP', desc: 'Realtime approval gates', badge: 'AUDITABLE' },
  ];

  return (
    <section className="py-12 border-y border-border bg-card/60 relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <InView>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {proofs.map((p) => (
              <div key={p.title} className="border-l border-border/80 pl-4 py-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-semibold text-foreground tracking-wider">
                    {p.title}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mb-2">{p.desc}</div>
                <span className="font-mono text-[9px] px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded font-bold uppercase">
                  {p.badge}
                </span>
              </div>
            ))}
          </div>
        </InView>
      </div>
    </section>
  );
};
