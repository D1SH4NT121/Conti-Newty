import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  Play,
  Plus,
  RefreshCw,
  Clock,
  Sparkles,
  ArrowRight,
  Shield,
  BookOpen,
  Radio,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import { api } from '../../lib/api-client';

export const LiveWork: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<any[]>([]);
  const [skillsCount, setSkillsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [sessList, skillsList] = await Promise.all([
        api.listSessions(workspaceId),
        api.listSkills(workspaceId, 'CONFIRMED')
      ]);
      setSessions(sessList);
      setSkillsCount(skillsList.length);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !title.trim() || !goal.trim()) return;

    setCreating(true);
    try {
      const res = await api.createSession(workspaceId, {
        title: title.trim(),
        goal: goal.trim()
      });
      setShowCreateModal(false);
      setTitle('');
      setGoal('');
      navigate(`/w/${workspaceId}/sessions/${res.sessionId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        );
      case 'PAUSED':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold uppercase">
            Paused
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold uppercase">
            Completed
          </span>
        );
      default:
        return (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border font-semibold uppercase">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8 animate-fade-in text-foreground">
      {/* Header */}
      <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-primary font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
            <Radio size={14} className="text-primary animate-pulse" />
            Human-in-the-Loop Multiplayer Intelligence
          </p>
          <h1 className="font-serif text-3xl font-light text-foreground">Live Work Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time collaborative agent execution where human interventions and redirections distill into permanent company memory.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 bg-secondary hover:bg-secondary/80 border border-border rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh sessions"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary text-primary-foreground font-mono text-xs font-semibold rounded hover:opacity-90 transition-opacity flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus size={14} />
            <span>NEW LIVE SESSION</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded bg-destructive/10 border border-destructive/20 text-destructive font-mono text-xs flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-card border border-border rounded shadow-sm space-y-2">
          <div className="flex items-center justify-between font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span>Active Live Sessions</span>
            <Play size={14} className="text-emerald-400" />
          </div>
          <div className="font-serif text-3xl font-light text-foreground">
            {sessions.filter((s) => s.status === 'RUNNING' || s.status === 'CREATED').length}
          </div>
          <p className="text-xs text-muted-foreground">Synchronous multiplayer runs with active driver steering.</p>
        </div>

        <div className="p-5 bg-card border border-border rounded shadow-sm space-y-2">
          <div className="flex items-center justify-between font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span>Confirmed Skills</span>
            <BookOpen size={14} className="text-primary" />
          </div>
          <div className="font-serif text-3xl font-light text-foreground">
            {skillsCount}
          </div>
          <p className="text-xs text-muted-foreground">Learned procedural rules auto-injected into live reasoning.</p>
        </div>

        <div className="p-5 bg-card border border-border rounded shadow-sm space-y-2">
          <div className="flex items-center justify-between font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span>Sovereign Governance</span>
            <Shield size={14} className="text-emerald-400" />
          </div>
          <div className="font-serif text-lg font-light text-foreground pt-1">
            Server-Authoritative Control
          </div>
          <p className="text-xs text-muted-foreground">Driver wheel handoff, observer view, and instant interrupt safety.</p>
        </div>
      </div>

      {/* Sessions Surface */}
      <div className="p-6 bg-card border border-border rounded shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground uppercase tracking-wider">
            <Users size={15} className="text-primary" />
            <span>Live &amp; Recorded Sessions</span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            {sessions.length} total sessions
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground font-mono text-xs flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin text-primary" />
            <span>Loading live sessions...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Sparkles size={28} className="text-muted-foreground mx-auto" />
            <div className="font-serif text-xl font-light text-foreground">No live sessions yet</div>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Launch a multiplayer session with your team. One operator takes the driver seat while the AI executes tasks and learns from your live guidance.
            </p>
            <div className="pt-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border font-mono text-xs font-semibold rounded transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Plus size={13} />
                <span>START FIRST SESSION</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                onClick={() => navigate(`/w/${workspaceId}/sessions/${sess.id}`)}
                className="p-4 rounded bg-background border border-border hover:border-foreground/30 transition-all cursor-pointer group flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-serif text-base font-light text-foreground group-hover:text-primary transition-colors">
                      {sess.title}
                    </span>
                    {getStatusBadge(sess.status)}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {sess.goal}
                  </p>
                </div>

                <div className="flex items-center gap-5 shrink-0">
                  <div className="text-right font-mono text-xs text-muted-foreground hidden sm:block">
                    <div className="flex items-center gap-1.5 justify-end">
                      <Clock size={12} />
                      <span>{new Date(sess.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {sess.participants?.length || 1} operator(s)
                    </div>
                  </div>

                  <div className="p-2 rounded bg-secondary text-muted-foreground group-hover:text-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded shadow-2xl p-6 w-full max-w-lg space-y-5 animate-fade-in">
            <div className="border-b border-border pb-3">
              <p className="font-mono text-xs text-primary font-bold uppercase tracking-wider mb-1">
                Multiplayer Launch
              </p>
              <h3 className="font-serif text-2xl font-light text-foreground">
                Start Live Agent Session
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                You will initiate the session as the Driver. Teammates can join as observers and submit steering recommendations.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive font-mono text-xs flex items-center gap-2">
                <AlertTriangle size={14} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="font-mono text-xs text-muted-foreground block mb-1.5 font-semibold">
                  SESSION TITLE
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Audit Q3 S3 Incident Logs & Reconcile Balances"
                  className="w-full px-3.5 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground transition-colors"
                />
              </div>

              <div>
                <label className="font-mono text-xs text-muted-foreground block mb-1.5 font-semibold">
                  SESSION GOAL / DIRECTIVE
                </label>
                <textarea
                  required
                  rows={4}
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Describe the operational goal. You can intervene, pause, or redirect the agent at any point during live execution."
                  className="w-full px-3.5 py-2 bg-background border border-border rounded text-foreground font-sans text-xs focus:outline-none focus:border-foreground leading-relaxed transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground border border-border font-mono text-xs font-semibold rounded transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={creating || !title.trim() || !goal.trim()}
                  className="px-5 py-2 bg-primary text-primary-foreground font-mono text-xs font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {creating ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>INITIALIZING...</span>
                    </>
                  ) : (
                    <>
                      <Play size={13} />
                      <span>LAUNCH SESSION</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
