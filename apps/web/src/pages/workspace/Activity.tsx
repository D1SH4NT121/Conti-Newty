import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { WorkspaceSummary } from '../../lib/api-client';
import { Bot, User, FileText, ArrowRight, ShieldCheck, GitPullRequest } from 'lucide-react';

type Tab = 'ALL' | 'PEOPLE' | 'AGENTS' | 'DOCUMENTS' | 'ACTIONS';

export const Activity: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('ALL');

  const activities = [
    {
      id: '1',
      actor: 'AgentRunner (Deep Research)',
      type: 'AGENT',
      category: 'AGENTS',
      msg: 'Executed traversal query over /knowledge and /sops',
      target: 'docs/chicago_project_review.md',
      targetUrl: `/w/${workspace.id}/brain`,
      hash: 'sha256-4f9e2b10a8d3...',
      time: '2 minutes ago',
      icon: <Bot size={14} className="text-primary" />,
      iconBg: 'bg-primary/10 text-primary border-primary/20'
    },
    {
      id: '2',
      actor: 'Sarah Chen (Admin)',
      type: 'PERSON',
      category: 'PEOPLE',
      msg: 'Updated living documentation',
      target: 'sops/incident-response.md',
      targetUrl: `/w/${workspace.id}/brain`,
      hash: 'sha256-8861be5b14f8...',
      time: '14 minutes ago',
      icon: <User size={14} className="text-foreground" />,
      iconBg: 'bg-secondary text-foreground border-border'
    },
    {
      id: '3',
      actor: 'Cryptographic Validator',
      type: 'AGENT',
      category: 'ACTIONS',
      msg: 'Verified 14-line coordinate hash fingerprint [Lines 11–24]',
      target: 'sops/incident-response.md',
      targetUrl: `/w/${workspace.id}/brain`,
      hash: 'sha256-100% MATCH',
      time: '18 minutes ago',
      icon: <ShieldCheck size={14} className="text-emerald-400" />,
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    },
    {
      id: '4',
      actor: 'Institutional Scribe',
      type: 'AGENT',
      category: 'DOCUMENTS',
      msg: 'Proposed documentation patch for SLA Escalation Matrix',
      target: 'sops/sla-matrix.md',
      targetUrl: `/w/${workspace.id}/work`,
      hash: 'proposal-pr-104',
      time: '42 minutes ago',
      icon: <GitPullRequest size={14} className="text-amber-400" />,
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    },
    {
      id: '5',
      actor: 'Lead Architect (Owner)',
      type: 'PERSON',
      category: 'PEOPLE',
      msg: 'Imported ICM Founder Template knowledge corpus',
      target: '14 Markdown Files',
      targetUrl: `/w/${workspace.id}/brain`,
      hash: 'archive-icm-seed',
      time: '1 hour ago',
      icon: <User size={14} className="text-foreground" />,
      iconBg: 'bg-secondary text-foreground border-border'
    }
  ];

  const tabs: Tab[] = ['ALL', 'PEOPLE', 'AGENTS', 'DOCUMENTS', 'ACTIONS'];
  
  const filtered = activities.filter(e => {
    if (tab === 'ALL') return true;
    if (tab === 'PEOPLE') return e.type === 'PERSON';
    if (tab === 'AGENTS') return e.type === 'AGENT';
    if (tab === 'DOCUMENTS') return e.category === 'DOCUMENTS' || e.target.endsWith('.md');
    if (tab === 'ACTIONS') return e.category === 'ACTIONS';
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <p className="font-mono text-xs text-primary font-bold uppercase tracking-wider mb-1">
          Audit & Provenance Ledger
        </p>
        <h1 className="font-serif text-3xl font-light text-foreground">Activity</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chronological record of all human, agent, and cryptographic events in <strong className="text-foreground">{workspace?.name}</strong>.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border mb-6 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`font-mono text-xs px-3 py-1.5 rounded transition-colors ${
              tab === t 
                ? 'bg-foreground text-background font-bold' 
                : 'bg-card text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((act) => (
          <div 
            key={act.id} 
            className="flex items-start justify-between gap-4 bg-card border border-border p-4 rounded hover:border-foreground/30 transition-colors"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 mt-0.5 border ${act.iconBg}`}>
                {act.icon}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-foreground text-xs">{act.actor}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">—</span>
                  <span className="text-xs text-foreground/90">{act.msg}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-[10px] font-mono text-muted-foreground">
                  <button 
                    onClick={() => act.targetUrl && navigate(act.targetUrl)}
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <FileText size={11} />
                    <span>{act.target}</span>
                  </button>
                  <span>•</span>
                  <span className="bg-background px-1.5 py-0.5 rounded border border-border text-foreground/80">
                    {act.hash}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`font-mono text-[10px] px-2 py-0.5 rounded border font-semibold ${
                act.type === 'AGENT' 
                  ? 'bg-primary/10 text-primary border-primary/20' 
                  : 'bg-secondary text-foreground border-border'
              }`}>
                {act.type}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                {act.time}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
