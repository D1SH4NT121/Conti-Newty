import React, { useEffect, useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { api, WorkspaceSummary, WorkspaceFileEntry } from '../../lib/api-client';
import { ArrowRight, Clock } from 'lucide-react';

interface RecentTask {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  COMPLETED: { dot: 'bg-emerald-400', label: 'text-emerald-400' },
  RUNNING:   { dot: 'bg-amber-400 animate-pulse', label: 'text-amber-400' },
  PENDING:   { dot: 'bg-amber-400 animate-pulse', label: 'text-amber-400' },
  FAILED:    { dot: 'bg-red-400', label: 'text-red-400' },
  CANCELLED: { dot: 'bg-white/30', label: 'text-white/40' },
};

export const Home: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const navigate = useNavigate();
  const [files, setFiles] = useState<WorkspaceFileEntry[]>([]);
  const [tasks, setTasks] = useState<RecentTask[]>([]);
  const [quickQuestion, setQuickQuestion] = useState('');
  const [filesLoading, setFilesLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) return;
    api.listFiles(workspace.id, '', true)
      .then(setFiles)
      .catch(console.error)
      .finally(() => setFilesLoading(false));
    api.listTasks(workspace.id, 5)
      .then(setTasks)
      .catch(console.error)
      .finally(() => setTasksLoading(false));
  }, [workspace?.id]);

  const handleQuickAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuestion.trim()) return;
    navigate(`/w/${workspace.id}/ask?q=${encodeURIComponent(quickQuestion.trim())}`);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10 animate-fade-in text-foreground">
      <div className="mb-10">
        <p className="font-mono text-[10px] text-[#ff7597] font-bold tracking-widest mb-2 uppercase">
          {workspace?.name} • INSTITUTIONAL MEMORY
        </p>
        <h1 className="font-serif text-4xl font-light text-white mb-6 tracking-tight">
          What are you working on?
        </h1>
        <form onSubmit={handleQuickAsk} className="flex gap-2 max-w-2xl">
          <input
            type="text"
            value={quickQuestion}
            onChange={(e) => setQuickQuestion(e.target.value)}
            placeholder="Ask your company anything..."
            className="flex-1 px-4 py-3.5 bg-[#141312] border border-white/12 text-white font-serif text-lg focus:outline-none focus:border-white/40 transition-colors placeholder-white/30 shadow-inner rounded-lg"
          />
          <button
            type="submit"
            className="font-mono text-xs font-bold tracking-widest px-6 py-3.5 bg-white text-black hover:bg-emerald-400 hover:text-black transition-colors rounded-lg flex items-center gap-2 cursor-pointer shadow-md"
          >
            ASK <ArrowRight size={14} />
          </button>
        </form>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">
          {/* Living Filesystem */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[10px] font-bold text-white/50 tracking-widest uppercase">
                LIVING FILESYSTEM
              </span>
              <Link
                to={`/w/${workspace?.id}/brain`}
                className="font-mono text-[10px] font-bold text-accent hover:underline transition-colors uppercase flex items-center gap-1"
              >
                Explore all <ArrowRight size={10} />
              </Link>
            </div>

            {filesLoading ? (
              <div className="border border-white/10 bg-[#141312] p-12 text-center rounded-xl">
                <div className="font-mono text-xs text-white/40 animate-pulse">READING DIRECTORY INDEX...</div>
              </div>
            ) : files.length === 0 ? (
              <div className="border border-white/10 bg-[#141312] p-12 text-center rounded-xl">
                <div className="font-mono text-[10px] font-bold text-white/40 mb-4 uppercase">NO ACTIVE KNOWLEDGE</div>
                <Link
                  to={`/w/${workspace?.id}/brain`}
                  className="inline-block font-mono text-[10px] font-bold px-5 py-2.5 border border-white/20 text-white/80 hover:border-white hover:text-white transition-colors uppercase rounded-md"
                >
                  CREATE DOCUMENT
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {files.slice(0, 5).map((file) => (
                  <button
                    key={file.path}
                    onClick={() => navigate(`/w/${workspace?.id}/brain?file=${encodeURIComponent(file.path)}`)}
                    className="w-full flex items-center gap-4 bg-[#141312] border border-white/8 hover:border-white/20 hover:bg-[#181716] transition-all px-5 py-4 text-left group rounded-xl cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white group-hover:text-accent transition-colors truncate">
                        {file.name}
                      </div>
                      <div className="font-mono text-[10px] text-white/40 mt-1 uppercase truncate">{file.path}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[10px] px-2 py-0.5 bg-white/5 border border-white/10 text-white/60 rounded uppercase">
                        {file.isDirectory ? 'DIR' : 'FILE'}
                      </span>
                      <ArrowRight size={14} className="text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* File count stat — only shown when there are files */}
          {!filesLoading && files.length > 0 && (
            <div className="bg-[#141312] border border-white/8 rounded-xl p-6 shadow-md">
              <div className="font-mono text-[10px] font-bold text-white/50 tracking-widest uppercase mb-2">
                INDEXED OBJECTS
              </div>
              <div className="text-3xl font-serif font-light text-white">
                {files.length}{' '}
                <span className="text-sm font-mono text-white/40 uppercase ml-1">
                  {files.length === 1 ? 'object' : 'objects'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — real agent task history */}
        <div className="space-y-10">
          <section>
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
              <span className="font-mono text-[10px] font-bold text-white/50 tracking-widest uppercase">
                RECENT AGENT TASKS
              </span>
              <Link
                to={`/w/${workspace?.id}/agents`}
                className="font-mono text-[10px] font-bold text-accent hover:underline uppercase"
              >
                All →
              </Link>
            </div>

            {tasksLoading ? (
              <div className="font-mono text-[10px] text-white/30 animate-pulse py-4">LOADING...</div>
            ) : tasks.length === 0 ? (
              <div className="border border-white/8 bg-[#141312] rounded-xl p-5 text-center">
                <div className="font-mono text-[10px] text-white/30 uppercase mb-3">No tasks yet</div>
                <button
                  onClick={() => navigate(`/w/${workspace?.id}/ask`)}
                  className="font-mono text-[10px] font-bold px-4 py-2 border border-white/20 text-white/70 hover:border-white hover:text-white transition-colors uppercase rounded-md cursor-pointer"
                >
                  RUN FIRST TASK →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  const style = STATUS_STYLES[task.status] ?? STATUS_STYLES.CANCELLED;
                  return (
                    <button
                      key={task.id}
                      onClick={() => navigate(`/w/${workspace?.id}/agents`)}
                      className="w-full text-left group border border-white/8 bg-[#141312] hover:border-white/20 transition-all p-4 rounded-xl shadow-sm cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
                        <span className="font-mono text-[11px] text-white font-bold uppercase truncate flex-1">
                          {task.title}
                        </span>
                        <span className={`font-mono text-[9px] font-bold uppercase shrink-0 ${style.label}`}>
                          {task.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-[10px] text-white/40 pl-3.5">
                        <Clock size={9} />
                        <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
export default Home;
