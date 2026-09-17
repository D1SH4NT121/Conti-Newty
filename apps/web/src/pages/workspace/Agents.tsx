import React from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { WorkspaceSummary } from '../../lib/api-client';
import { Bot, Sparkles, CheckCircle2, Shield, Cpu, ArrowRight, Play, Terminal } from 'lucide-react';

export const Agents: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const navigate = useNavigate();

  const agents = [
    {
      id: 'agent-research',
      name: 'Deep Research Agent',
      role: 'Filesystem Traversal & Synthesis',
      model: 'Antigravity Reasoning v2 / GPT-4o',
      status: 'active',
      description: 'Navigates markdown hierarchies, extracts exact verbatim line spans, and produces grounded citations.',
      stats: { tasksCompleted: 142, avgConfidence: '99.4%', latency: '1.2s' },
      suggestedQuery: 'Perform deep research across all SOPs and summarize operational protocols.'
    },
    {
      id: 'agent-scribe',
      name: 'Institutional Scribe',
      role: 'Documentation & Living Updates',
      model: 'Claude 3.5 Sonnet / Antigravity Native',
      status: 'active',
      description: 'Monitors workspace changes, proposes atomic documentation patches, and records institutional memory.',
      stats: { tasksCompleted: 89, avgConfidence: '98.8%', latency: '0.8s' },
      suggestedQuery: 'Draft a new incident response runbook template for production database anomalies.'
    },
    {
      id: 'agent-validator',
      name: 'Cryptographic Provenance Validator',
      role: 'SHA-256 Grounding & Integrity',
      model: 'Deterministic Engine (Native)',
      status: 'active',
      description: 'Computes cryptographic hashes over verbatim file coordinates to guarantee zero‑hallucination compliance.',
      stats: { tasksCompleted: 310, avgConfidence: '100%', latency: '4ms' },
      suggestedQuery: 'Verify SHA-256 coordinate integrity hashes across all workspace files.'
    },
    {
      id: 'agent-builder',
      name: 'Software Generator',
      role: 'Sandboxed Micro‑App Creation',
      model: 'Antigravity CodeRunner',
      status: 'ready',
      description: 'Synthesizes interactive operational tools and executes them within sandboxed WebAssembly/Node VM.',
      stats: { tasksCompleted: 24, avgConfidence: '97.2%', latency: '2.4s' },
      suggestedQuery: 'Generate an interactive JSON token decoder utility.'
    }
  ];

  const handleLaunchMission = (query: string) => {
    navigate(`/w/${workspace.id}/ask?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8 border-b border-border pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-primary font-bold uppercase tracking-wider mb-1">
            Autonomous Agent Roster
          </p>
          <h1 className="font-serif text-3xl font-light text-foreground">
            Workspace Agents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configured autonomous agents operating within <strong className="text-foreground">{workspace?.name}</strong>. Each agent has bounded filesystem access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/w/${workspace.id}/ask`)}
            className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground font-mono text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Sparkles size={14} />
            <span>Open Reasoning Engine</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map(agent => (
          <div
            key={agent.id}
            className="p-6 rounded border border-border bg-card hover:border-foreground/40 transition-colors flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-background border border-border flex items-center justify-center text-foreground">
                    <Bot size={20} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="font-serif text-lg font-medium text-foreground">
                      {agent.name}
                    </h2>
                    <div className="text-xs text-muted-foreground">
                      {agent.role}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-semibold border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{agent.status}</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {agent.description}
              </p>

              <div className="flex items-center gap-2 mb-4 p-2 rounded bg-background border border-border text-xs font-mono text-muted-foreground">
                <Cpu size={12} className="text-foreground shrink-0" />
                <span className="truncate">Engine: <strong className="text-foreground">{agent.model}</strong></span>
              </div>
            </div>

            <div>
              <div className="grid grid-cols-3 gap-2 py-3 border-t border-border text-center font-mono text-xs text-muted-foreground">
                <div>
                  <div className="text-[10px] text-muted-foreground">TASKS</div>
                  <div className="text-sm font-bold text-foreground">{agent.stats.tasksCompleted}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">ACCURACY</div>
                  <div className="text-sm font-bold text-foreground">{agent.stats.avgConfidence}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">LATENCY</div>
                  <div className="text-sm font-bold text-foreground">{agent.stats.latency}</div>
                </div>
              </div>

              <div className="pt-3 border-t border-border">
                <button
                  onClick={() => handleLaunchMission(agent.suggestedQuery)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded bg-secondary hover:bg-secondary/80 text-foreground font-mono text-xs transition-colors border border-border"
                >
                  <Play size={12} className="text-primary fill-primary" />
                  <span>Launch Mission Prompt</span>
                  <ArrowRight size={12} className="ml-auto text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
