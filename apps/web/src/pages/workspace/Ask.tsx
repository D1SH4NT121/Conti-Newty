import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext, useSearchParams, Link } from 'react-router-dom';
import { api, WorkspaceSummary, TaskResponse, AgentConfig, AgentTurn } from '../../lib/api-client';
import { getSocket, joinTaskRoom, leaveTaskRoom } from '../../lib/socket';
import { Eye, Users, KeyRound, Plus, X, ChevronDown } from 'lucide-react';

interface LiveEvent { type: string; payload: any; ts: number; }

const PROVIDERS = [
  { id: 'gemini', label: 'Gemini (Google)', color: '#60a5fa', bg: 'bg-blue-950/40 border-blue-500/40', dot: 'bg-blue-400' },
  { id: 'bedrock', label: 'AWS Bedrock (Nova)', color: '#f59e0b', bg: 'bg-amber-950/40 border-amber-500/40', dot: 'bg-amber-400' },
  { id: 'claude', label: 'Claude', color: '#ff7597', bg: 'bg-pink-950/40 border-pink-500/40', dot: 'bg-[#ff7597]' },
  { id: 'openai', label: 'GPT-4o', color: '#10b981', bg: 'bg-emerald-950/40 border-emerald-500/40', dot: 'bg-emerald-400' },
];

const PRESET_ROLES = ['Researcher', 'Critic', 'Summarizer', 'Devil\'s Advocate', 'Fact Checker'];

const providerStyle = (provider: string) =>
  PROVIDERS.find(p => p.id === provider) || PROVIDERS[0];

const DEFAULT_AGENTS: AgentConfig[] = [
  { role: 'Researcher', provider: 'gemini' }
];

export const Ask: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const sharedTaskId = searchParams.get('task') || null;

  const [prompt, setPrompt] = useState(searchParams.get('q') || '');
  const [agents, setAgents] = useState<AgentConfig[]>(DEFAULT_AGENTS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TaskResponse | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(sharedTaskId);
  const [watchers, setWatchers] = useState(1);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [activeTurns, setActiveTurns] = useState<AgentTurn[]>([]);
  const [currentAgent, setCurrentAgent] = useState<{ role: string; provider: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Socket: join task room
  useEffect(() => {
    if (!activeTaskId || !workspace?.id) return;
    const socket = getSocket();
    joinTaskRoom(activeTaskId, workspace.id);

    const handleEvent = (data: { taskId: string; type: string; payload: any; ts: number }) => {
      if (data.taskId !== activeTaskId) return;
      setLiveEvents(prev => [...prev, { type: data.type, payload: data.payload, ts: data.ts }]);

      if (data.type === 'AGENT_TURN_STARTED') {
        setCurrentAgent({ role: data.payload.agentRole, provider: data.payload.provider });
      }
      if (data.type === 'AGENT_TURN_COMPLETED') {
        setCurrentAgent(null);
        setActiveTurns(prev => [...prev, {
          agentRole: data.payload.agentRole,
          provider: data.payload.provider,
          answer: data.payload.answer,
          citations: data.payload.citations || [],
          verifiedCitations: data.payload.verifiedCitations || []
        }]);
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    const handleWatchers = (data: { taskId: string; count: number }) => {
      if (data.taskId === activeTaskId) setWatchers(data.count);
    };

    socket.on('task.event', handleEvent);
    socket.on('task.watchers', handleWatchers);
    return () => {
      leaveTaskRoom(activeTaskId, workspace.id);
      socket.off('task.event', handleEvent);
      socket.off('task.watchers', handleWatchers);
    };
  }, [activeTaskId, workspace?.id]);

  // Load shared task
  useEffect(() => {
    if (!sharedTaskId || !workspace?.id) return;
    api.getTask(workspace.id, sharedTaskId).then(task => {
      if (task.status === 'COMPLETED') {
        const completedEvent = [...task.events].reverse().find(e => e.type === 'TASK_COMPLETED');
        if (completedEvent) {
          try {
            const p = JSON.parse(completedEvent.payload);
            setResult({ taskId: sharedTaskId, status: 'COMPLETED', answer: p.answer, citations: p.citations, verifiedCitations: p.verifiedCitations, turns: p.turns });
            if (p.turns) setActiveTurns(p.turns);
          } catch {}
        }
        setPrompt(task.description || '');
      }
      setLiveEvents(task.events.map(e => ({ type: e.type, payload: JSON.parse(e.payload), ts: new Date(e.createdAt).getTime() })));
    }).catch(() => {});
  }, [sharedTaskId, workspace?.id]);

  const handleAsk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setLiveEvents([]);
    setActiveTurns([]);
    setCurrentAgent(null);
    setActiveTaskId(null);
    setWatchers(1);

    try {
      const res = await api.createTask(workspace.id, prompt, undefined, agents);
      setActiveTaskId(res.taskId);
      setSearchParams({ task: res.taskId }, { replace: true });
      setResult(res);
      if (res.turns) setActiveTurns(res.turns);
    } catch (err: any) {
      setError(err.message || 'Execution error');
    } finally {
      setLoading(false);
    }
  };

  const addAgent = () => {
    if (agents.length >= 4) return;
    setAgents(prev => [...prev, { role: 'Critic', provider: 'openai' }]);
  };

  const removeAgent = (i: number) => setAgents(prev => prev.filter((_, idx) => idx !== i));

  const updateAgent = (i: number, patch: Partial<AgentConfig>) =>
    setAgents(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a));

  const shareUrl = activeTaskId ? `${window.location.origin}/w/${workspace.id}/ask?task=${activeTaskId}` : null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6 animate-fade-in text-foreground">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] text-[#ff7597] font-bold tracking-widest uppercase mb-1">RELAY MODE</p>
          <h1 className="font-serif text-3xl font-light text-white">What would you like to <em>know?</em></h1>
        </div>
        {activeTaskId && (
          <div className="flex items-center gap-2 shrink-0 pt-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-600/40 font-mono text-[10px] text-emerald-300">
              <Eye size={10} className="animate-pulse" />
              <span>{watchers} watching</span>
            </div>
            {shareUrl && (
              <button
                onClick={() => navigator.clipboard.writeText(shareUrl)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-white/20 bg-white/5 hover:border-white/40 font-mono text-[10px] text-white/70 hover:text-white transition-colors rounded-lg cursor-pointer"
              >
                <Users size={10} /><span>SHARE SESSION</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Relay Mode toggle */}
      <div>
        <button
          onClick={() => setShowAgentPanel(v => !v)}
          className="flex items-center gap-2 font-mono text-[10px] text-white/50 hover:text-white/80 transition-colors cursor-pointer"
        >
          <div className="flex -space-x-1">
            {agents.map((a, i) => {
              const s = providerStyle(a.provider);
              return <div key={i} className={`w-4 h-4 rounded-full border border-[#141312] ${s.dot}`} />;
            })}
          </div>
          <span className="uppercase tracking-widest">{agents.length === 1 ? 'RELAY MODE OFF' : `RELAY MODE — ${agents.length} STEPS`}</span>
          <ChevronDown size={10} className={`transition-transform ${showAgentPanel ? 'rotate-180' : ''}`} />
        </button>

        {showAgentPanel && (
          <div className="mt-3 border border-white/10 bg-[#0d0d0f] rounded-xl p-4 space-y-3">
            <div className="font-mono text-[10px] text-white/40 uppercase tracking-widest mb-1">Relay Mode — A fixed, ordered relay of up to 4 roles (e.g. Draft → Critique → Fact-check → Finalize), each seeing the prior step's output. Off by default.</div>
            <div className="font-mono text-[10px] text-white/25 mb-2">Steps run sequentially. Intermediate steps use the cheapest model tier; the final step uses the strong model — overridable per step.</div>
            {agents.map((agent, i) => {
              const s = providerStyle(agent.provider);
              return (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${s.bg}`}>
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                  <span className="font-mono text-[10px] text-white/40 w-4 shrink-0">{i + 1}.</span>

                  {/* Role input */}
                  <input
                    value={agent.role}
                    onChange={e => updateAgent(i, { role: e.target.value })}
                    placeholder="Role (e.g. Researcher)"
                    list={`roles-${i}`}
                    className="flex-1 bg-transparent border-b border-white/15 text-white font-mono text-xs focus:outline-none focus:border-white/40 pb-0.5 min-w-0"
                  />
                  <datalist id={`roles-${i}`}>
                    {PRESET_ROLES.map(r => <option key={r} value={r} />)}
                  </datalist>

                  {/* Provider select */}
                  <select
                    value={agent.provider}
                    onChange={e => updateAgent(i, { provider: e.target.value as AgentConfig['provider'] })}
                    className="bg-transparent border border-white/15 text-white font-mono text-[10px] px-2 py-1 rounded focus:outline-none focus:border-white/40 cursor-pointer"
                  >
                    {PROVIDERS.map(p => <option key={p.id} value={p.id} className="bg-[#141312]">{p.label}</option>)}
                  </select>

                  {agents.length > 1 && (
                    <button onClick={() => removeAgent(i)} className="text-white/30 hover:text-red-400 transition-colors cursor-pointer">
                      <X size={12} />
                    </button>
                  )}
                </div>
              );
            })}
            {agents.length < 4 && (
              <button
                onClick={addAgent}
                className="flex items-center gap-1.5 font-mono text-[10px] text-white/40 hover:text-white/70 transition-colors cursor-pointer"
              >
                <Plus size={10} /> ADD AGENT
              </button>
            )}
          </div>
        )}
      </div>

      {/* Query Input */}
      <form onSubmit={handleAsk} className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Ask anything about your Company Brain..."
          disabled={loading}
          className="flex-1 px-4 py-3 bg-[#141312] border border-white/12 text-white font-serif text-base focus:outline-none focus:border-white/40 transition-colors placeholder-white/30 shadow-inner rounded-lg disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="font-mono text-xs font-bold tracking-widest px-6 py-3 bg-white text-black hover:bg-[#ff7597] hover:text-black transition-colors rounded-lg disabled:opacity-40 flex items-center gap-2 cursor-pointer shadow-md"
        >
          {loading ? 'RUNNING...' : 'ASK →'}
        </button>
      </form>

      {/* Error */}
      {error && (() => {
        const isKeyError = error.toLowerCase().includes('unconfigured provider') || error.toLowerCase().includes('api key') || error.toLowerCase().includes('valid api key');
        return isKeyError ? (
          <div className="border border-amber-500/40 bg-amber-950/20 p-5 rounded-xl space-y-3">
            <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-300 uppercase">
              <KeyRound size={14} /><span>No AI Provider Configured</span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">Add your API key — it's encrypted and never shared.</p>
            <Link to={`/w/${workspace.id}/settings`} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-mono text-xs font-bold rounded-lg hover:bg-amber-300 transition-colors cursor-pointer">
              <KeyRound size={12} /> ADD API KEY IN SETTINGS
            </Link>
          </div>
        ) : (
          <div className="border border-red-500/30 bg-red-950/40 p-4 rounded-lg font-mono text-xs text-red-300">ERROR: {error}</div>
        );
      })()}

      {/* Live Agent Chat Thread */}
      {(activeTurns.length > 0 || loading || liveEvents.length > 0) && (
        <div className="space-y-1">
          {/* Status bar */}
          <div className="flex items-center gap-2 font-mono text-[10px] text-white/40 pb-2">
            <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-[#ff7597] animate-pulse' : 'bg-white/20'}`} />
            <span className="uppercase tracking-widest">{loading ? 'RELAY RUNNING' : 'RELAY COMPLETE'}</span>
            <span className="ml-auto">{activeTurns.length}/{agents.length} steps</span>
          </div>

          {/* Agent turn bubbles */}
          {activeTurns.map((turn, i) => {
            const s = providerStyle(turn.provider);
            return (
              <div key={i} className={`border rounded-xl p-5 space-y-3 ${s.bg}`}>
                {/* Agent header */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <span className="font-mono text-xs font-bold" style={{ color: s.color }}>{turn.agentRole}</span>
                  <span className="font-mono text-[10px] text-white/30 uppercase">{turn.provider}</span>
                  {i < activeTurns.length - 1 && (
                    <span className="ml-auto font-mono text-[10px] text-white/20 uppercase">relayed →</span>
                  )}
                </div>

                {/* Answer */}
                <div className="font-serif text-base text-white/90 leading-relaxed whitespace-pre-wrap">
                  {turn.answer}
                </div>

                {/* Citations */}
                {turn.verifiedCitations && turn.verifiedCitations.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {turn.verifiedCitations.map((c, ci) => (
                      <span key={ci} className="font-mono text-[10px] px-2 py-0.5 bg-black/30 border border-white/10 rounded text-white/50">
                        {c.filePath}:{c.startLine}–{c.endLine}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing indicator for current agent */}
          {loading && currentAgent && (
            <div className={`border rounded-xl p-5 ${providerStyle(currentAgent.provider).bg}`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${providerStyle(currentAgent.provider).dot}`} />
                <span className="font-mono text-xs font-bold" style={{ color: providerStyle(currentAgent.provider).color }}>
                  {currentAgent.role}
                </span>
                <span className="font-mono text-[10px] text-white/30 uppercase">{currentAgent.provider}</span>
                <span className="font-mono text-[10px] text-white/40 ml-2 animate-pulse">reasoning...</span>
              </div>
            </div>
          )}

          {/* Waiting for first agent */}
          {loading && !currentAgent && activeTurns.length === 0 && (
            <div className="border border-white/10 rounded-xl p-5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white/20 animate-pulse" />
                <span className="font-mono text-[10px] text-white/40 animate-pulse">Gathering workspace context...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && liveEvents.length === 0 && (
        <div className="border-t border-white/10 pt-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { n: '1', t: 'CONFIGURE', d: 'Open Relay Mode and add up to 4 steps, each with a role and provider. Intermediate steps auto-route to the cheapest model; the final step uses the strong model. Override per step.' },
              { n: '2', t: 'RELAY', d: 'Steps run in order. Each one sees the prior steps\' outputs and can draft, critique, fact-check, or finalize — building on what came before.' },
              { n: '3', t: 'SHARE', d: 'Any teammate opens the same session URL and watches all relay steps work live — multiplayer by default.' },
            ].map(s => (
              <div key={s.n} className="border border-white/8 bg-[#141312] p-4 rounded-xl">
                <div className="font-mono text-xs font-bold text-white mb-1">{s.n}. {s.t}</div>
                <p className="text-xs text-white/60 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="border border-amber-500/20 bg-amber-950/10 rounded-xl p-4 flex items-start gap-3">
            <span className="text-amber-400 text-lg shrink-0">📁</span>
            <div>
              <div className="font-mono text-xs font-bold text-amber-300 mb-1">Start by populating your Company Brain</div>
              <p className="text-xs text-white/50 leading-relaxed mb-3">
                Go to <strong className="text-white/70">Company Brain</strong> and seed an ICM template. Agents can only answer questions about what's in the folder.
              </p>
              <Link to={`/w/${workspace.id}/brain`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 border border-white/20 hover:border-white/40 text-white font-mono text-[10px] font-bold rounded-lg transition-colors cursor-pointer">
                OPEN COMPANY BRAIN →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ask;
