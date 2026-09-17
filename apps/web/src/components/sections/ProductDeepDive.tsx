import React, { useState } from 'react';
import { motion } from 'motion/react';
import { InView } from '../motion/InView';

interface FileNode {
  name: string;
  type: 'folder' | 'file';
  path: string;
  size?: string;
  updated?: string;
  content?: string[];
  children?: FileNode[];
}

export const ProductDeepDive: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string>('/operations/chicago_deployment.md');

  const fileContents: Record<string, { lines: string[]; hash: string; verifiedAt: string }> = {
    '/operations/chicago_deployment.md': {
      lines: [
        '# Post-Incident Analysis: Chicago Regional Deployment',
        '',
        '## 1. Timeline & Trigger Event',
        'At 14:02:11 UTC, terraform module infra-terraform/modules/chicago.tf applied',
        'a revised rate-limiter profile.',
        '',
        '## 2. Root Cause Anomaly [LINES 14-18]',
        '14 | The terraform configuration drift caused',
        '15 | the allowed latency threshold to increase',
        '16 | from 200ms to 800ms during the deployment.',
        '17 | This went undetected until post-deploy monitoring.',
        '18 | Automated fallback was triggered at 14:08.',
        '',
        '## 3. Remediation & Verification SOP',
        'Automated health checks reverted to policy profile #1049.',
      ],
      hash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      verifiedAt: '2026-09-13T14:08:22Z',
    },
    '/engineering/architecture_rfc.md': {
      lines: [
        '# RFC-109: Distributed Memory Consensus Model',
        '',
        '## Context',
        'All AI reasoning steps require strict determinism.',
        'Knowledge stores synchronize via standard git remotes.',
        '',
        '## Architecture Invariants',
        '- Zero proprietary vector databases required.',
        '- Deterministic line-level citations across all queries.',
      ],
      hash: 'sha256:88a7c1b44211ef149afbf4c8996fb92427ae41e4649b934ca495991b7852a12b',
      verifiedAt: '2026-09-12T09:30:14Z',
    },
    '/security/enclave_policy.md': {
      lines: [
        '# Enclave Execution Security Policy',
        '',
        '## Rules',
        '1. Agents cannot write to /production without human co-sign.',
        '2. All queries logged to immutable append-only ledger.',
        '3. TLS 1.3 enforced for all git transport synchronization.',
      ],
      hash: 'sha256:77f12e98fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852f89c',
      verifiedAt: '2026-09-11T18:45:00Z',
    },
  };

  const activeDoc = fileContents[selectedFile] || fileContents['/operations/chicago_deployment.md'];

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto relative z-10" id="product">
      <InView>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <p className="font-mono text-xs tracking-widest text-primary uppercase mb-3">
              DEEP-DIVE INSPECTION
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl font-light leading-tight text-foreground">
              Traversable by humans.<br />
              <em>Executable by agents.</em>
            </h2>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
            <span className="px-2 py-1 bg-secondary rounded border border-border">J / K : Navigate</span>
            <span className="px-2 py-1 bg-secondary rounded border border-border">Space : Preview</span>
            <span className="px-2 py-1 bg-secondary rounded border border-border">↵ : Open</span>
          </div>
        </div>
      </InView>

      {/* Living File-Tree & Document Inspection Panel (Attio/Vercel Data Density) */}
      <div className="bg-card border border-border rounded-md shadow-md overflow-hidden grid lg:grid-cols-12">
        {/* Left Column: Interactive File Tree (4 cols) */}
        <div className="lg:col-span-4 border-r border-border p-5 bg-background/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4 font-mono text-xs">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <span className="text-primary">📁</span>
                <span>/company_brain</span>
              </div>
              <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded font-bold border border-emerald-500/20">
                GIT SYNCED
              </span>
            </div>

            <div className="space-y-1 font-mono text-xs">
              <div className="text-muted-foreground py-1 px-2 font-semibold">├── operations/</div>
              <div
                onClick={() => setSelectedFile('/operations/chicago_deployment.md')}
                className={`pl-6 py-2 px-3 rounded cursor-pointer transition-all flex items-center justify-between ${
                  selectedFile === '/operations/chicago_deployment.md'
                    ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
                    : 'text-foreground hover:bg-muted/40'
                }`}
              >
                <span>├── chicago_deployment.md</span>
                <span className="text-[9px] bg-primary text-primary-foreground px-1.5 rounded">ACTIVE</span>
              </div>
              <div className="pl-6 py-1.5 px-3 text-muted-foreground">└── q3_review.md</div>

              <div className="text-muted-foreground py-1 px-2 font-semibold pt-2">├── engineering/</div>
              <div
                onClick={() => setSelectedFile('/engineering/architecture_rfc.md')}
                className={`pl-6 py-2 px-3 rounded cursor-pointer transition-all flex items-center justify-between ${
                  selectedFile === '/engineering/architecture_rfc.md'
                    ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
                    : 'text-foreground hover:bg-muted/40'
                }`}
              >
                <span>└── architecture_rfc.md</span>
              </div>

              <div className="text-muted-foreground py-1 px-2 font-semibold pt-2">├── security/</div>
              <div
                onClick={() => setSelectedFile('/security/enclave_policy.md')}
                className={`pl-6 py-2 px-3 rounded cursor-pointer transition-all flex items-center justify-between ${
                  selectedFile === '/security/enclave_policy.md'
                    ? 'bg-primary/10 text-primary border border-primary/20 font-semibold'
                    : 'text-foreground hover:bg-muted/40'
                }`}
              >
                <span>└── enclave_policy.md</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-border font-mono text-[11px] text-muted-foreground flex justify-between">
            <span>Storage: 847 markdown files</span>
            <span className="text-primary font-semibold">0.0ms Query Latency</span>
          </div>
        </div>

        {/* Right Column: Code & Evidence Reader (8 cols) */}
        <div className="lg:col-span-8 p-6 flex flex-col justify-between bg-card">
          <div>
            {/* Header / Breadcrumb Bar */}
            <div className="flex flex-wrap items-center justify-between pb-3 border-b border-border mb-4 font-mono text-xs gap-3">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <span className="text-muted-foreground">Path:</span>
                <span className="text-primary">{selectedFile}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground text-[10px]">{activeDoc.verifiedAt}</span>
              </div>
            </div>

            {/* Document Content Output with Line Highlights */}
            <div className="bg-background border border-border/80 rounded p-4 font-mono text-xs leading-relaxed space-y-1 overflow-x-auto">
              {activeDoc.lines.map((line, idx) => {
                const isHighlight = line.includes('200ms to 800ms') || line.includes('Root Cause');
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-4 px-2 py-0.5 rounded ${
                      isHighlight ? 'bg-primary/15 text-primary border-l-2 border-primary font-semibold' : 'text-foreground/90'
                    }`}
                  >
                    <span className="text-muted-foreground/50 select-none w-6 text-right shrink-0 text-[11px]">
                      {idx + 1}
                    </span>
                    <span className="whitespace-pre-wrap">{line}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cryptographic Proof Footer */}
          <div className="mt-4 pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 font-bold">✓ PROVENANCE ATTESTED:</span>
              <span className="text-foreground truncate max-w-sm">{activeDoc.hash}</span>
            </div>
            <span className="text-primary font-semibold">ZERO VECTOR DRIFT</span>
          </div>
        </div>
      </div>
    </section>
  );
};
