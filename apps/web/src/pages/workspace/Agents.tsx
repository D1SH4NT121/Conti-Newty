import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { api, WorkspaceSummary } from '../../lib/api-client';
import { getSocket } from '../../lib/socket';
import { ArrowRight, Play, Users, Clock, RefreshCw } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const STATUS_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  COMPLETED: { dot: 'bg-emerald-400', badge: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40', label: 'COMPLETED' },
  RUNNING:   { dot: 'bg-amber-400 animate-pulse', badge: 'bg-amber-950/60 text-amber-300 border-amber-500/40 animate-pulse', label: 'RUNNING' },
  PENDING:   { dot: 'bg-amber-400 animate-pulse', badge: 'bg-amber-950/60 text-amber-300 border-amber-500/40', label: 'PENDING' },
  FAILED:    { dot: 'bg-red-400', badge: 'bg-red-950/60 text-red-400 border-red-500/40', label: 'FAILED' },
  CANCELLED: { dot: 'bg-white/20', badge: 'bg-white/5 text-white/40 border-white/10', label: 'CANCELLED' },
};

export const Agents: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [running, setRunning] = useState(false);

  const loadTasks = () => {
    if (!workspace?.id) return;
    api.listTasks(workspace.id, 20)
      .then(setTasks)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks();
  }, [workspace?.id]);

  // Live updates via socket
  useEffect(() => {
    if (!workspace?.id) return;
    const socket = getSocket();

    const handleCreated = (data: Task) => {
      setTasks(prev => [data, ...prev.slice(0, 19)]);
    };
    const handleUpdated = (data: { id: string; status: string }) => {
      setTasks(prev => prev.map(t => t.id === data.id ? { ...t, status: data.status } : t));
    };

    socket.on('task.created', handleCreated);
    socket.on('task.updated', handleUpdated);
    return () => {
      socket.off('task.created', handleCreated);
      socket.off('task.updated', handleUpdated);
    };
  }, [workspace?.id]);

  const handleRunTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setRunning(true);
    try {
      navigate(`/w/${workspace.id}/ask?q=${encodeURIComponent(prompt.trim())}`);
    } finally {
      setRunning(false);
    }
  };

  const handleJoin = (task: Task) => {
    navigate(`/w/${workspace.id}/ask?task=${task.id}`);
  };

  const activeTasks = tasks.filter(t => t.status === 'RUNNING' || t.status === 'PENDING');
  const pastTasks = tasks.filter(t => t.status !== 'RUNNING' && t.status !== 'PENDING');

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-10 animate-fade-in text-foreground">
      <div className="border-b border-white/10 pb-6">
        <p className="font-mono text-[10px] text-[#ff7597] font-bold tracking-widest uppercase mb-1">
          MULTIPLAYER AGENT SESSIONS
        </p>
        <h1 className="font-serif text-3xl font-light text-white">Agents</h1>
        <p className="text-sm text-white/50 mt-1">
          Run tasks, watch them live, and share sessions with teammates.
        </p>
      </div>

      {/* Quick run */}
      <form onSubmit={handleRunTask} className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Describe a task for the agent..."
          className="flex-1 px-4 py-3 bg-[#141312] border border-white/12 text-white font-serif text-base focus:outline-none focus:border-white/40 transition-colors placeholder-white/30 rounded-lg"
        />
        <button
          type="submit"
          disabled={running || !prompt.trim()}
          className="font-mono text-xs font-bold tracking-widest px-6 py-3 bg-white text-black hover:bg-emerald-400 hover:text-black transition-colors rounded-lg disabled:opacity-40 flex items-center gap-2 cursor-pointer"
        >
          <Play size={13} className="fill-current" />
          RUN
        </button>
      </form>

      {/* Active tasks */}
      {activeTasks.length > 0 && (
        <section>
          <div className="font-mono text-[10px] font-bold text-white/50 tracking-widest uppercase mb-3">
            ACTIVE NOW — {activeTasks.length}
          </div>
          <div className="space-y-3">
            {activeTasks.map(task => {
              const s = STATUS_STYLES[task.status] ?? STATUS_STYLES.CANCELLED;
              return (
                <div key={task.id} className="border border-amber-500/30 bg-amber-950/10 rounded-xl p-5 flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{task.title}</div>
                    <div className="font-mono text-[10px] text-white/40 mt-0.5 flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(task.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoin(task)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-400 text-black font-mono text-xs font-bold rounded-lg hover:bg-amber-300 transition-colors cursor-pointer shrink-0"
                  >
                    <Users size={12} />
                    JOIN LIVE
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Task history */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[10px] font-bold text-white/50 tracking-widest uppercase">
            TASK HISTORY
          </span>
          <button onClick={loadTasks} className="text-white/30 hover:text-white transition-colors cursor-pointer">
            <RefreshCw size={12} />
          </button>
        </div>

        {loading ? (
          <div className="font-mono text-xs text-white/30 animate-pulse py-8 text-center">LOADING...</div>
        ) : pastTasks.length === 0 ? (
          <div className="border border-white/8 bg-[#141312] rounded-xl p-12 text-center">
            <div className="font-mono text-[10px] text-white/30 uppercase mb-4">No tasks yet</div>
            <button
              onClick={() => navigate(`/w/${workspace.id}/ask`)}
              className="font-mono text-[10px] font-bold px-5 py-2.5 border border-white/20 text-white/70 hover:border-white hover:text-white transition-colors uppercase rounded-md cursor-pointer"
            >
              RUN FIRST TASK →
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {pastTasks.map(task => {
              const s = STATUS_STYLES[task.status] ?? STATUS_STYLES.CANCELLED;
              return (
                <button
                  key={task.id}
                  onClick={() => handleJoin(task)}
                  className="w-full flex items-center gap-4 bg-[#141312] border border-white/8 hover:border-white/20 hover:bg-[#181716] transition-all px-5 py-4 text-left group rounded-xl cursor-pointer"
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white group-hover:text-accent transition-colors truncate">
                      {task.title}
                    </div>
                    <div className="font-mono text-[10px] text-white/40 mt-0.5 flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(task.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <span className={`font-mono text-[10px] px-2 py-0.5 rounded border font-bold uppercase shrink-0 ${s.badge}`}>
                    {s.label}
                  </span>
                  <ArrowRight size={14} className="text-white/20 group-hover:text-white transition-colors shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
export default Agents;
