import React, { useEffect, useState } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { api, WorkspaceSummary, WorkspaceFileEntry } from '../../lib/api-client';
import { Brain, GitPullRequest, ShieldCheck, ArrowRight } from 'lucide-react';

export const Home: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const navigate = useNavigate();
  const [files, setFiles] = useState<WorkspaceFileEntry[]>([]);
  const [quickQuestion, setQuickQuestion] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (workspace?.id) {
      api
        .listFiles(workspace.id)
        .then(setFiles)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [workspace?.id]);

  const handleQuickAsk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickQuestion.trim()) return;
    navigate(`/w/${workspace.id}/ask?q=${encodeURIComponent(quickQuestion.trim())}`);
  };

  const agents = [
    {
      name: 'Navigation Agent',
      status: 'ACTIVE',
      step: 'TRAVERSING /operations/chicago',
      color: 'text-emerald-400',
      dotColor: 'bg-emerald-400',
    },
    {
      name: 'Reporting Agent',
      status: 'IDLE',
      step: 'Waiting for next task',
      color: 'text-white/40',
      dotColor: 'bg-white/30',
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-10 animate-fade-in text-foreground">
      {/* Header Section */}
      <div className="mb-10">
        <p className="font-mono text-[10px] text-[#ff7597] font-bold tracking-widest mb-2 uppercase">
          {workspace?.name} • INSTITUTIONAL MEMORY
        </p>
        <h1 className="font-serif text-4xl font-light text-white mb-6 tracking-tight">
          What are you working on?
        </h1>
        <form onSubmit={handleQuickAsk} className="flex gap-2 max-w-2xl relative">
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
          {/* Active Work / Recent Files */}
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

            {loading ? (
              <div className="border border-white/10 bg-[#141312] p-12 text-center rounded-xl">
                <div className="font-mono text-xs text-white/40 animate-pulse">
                  READING DIRECTORY INDEX...
                </div>
              </div>
            ) : files.length === 0 ? (
              <div className="border border-white/10 bg-[#141312] p-12 text-center rounded-xl">
                <div className="font-mono text-[10px] font-bold text-white/40 mb-4 uppercase">
                  NO ACTIVE KNOWLEDGE
                </div>
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
                    onClick={() =>
                      navigate(
                        `/w/${workspace?.id}/brain?file=${encodeURIComponent(file.path)}`
                      )
                    }
                    className="w-full flex items-center gap-4 bg-[#141312] border border-white/8 hover:border-white/20 hover:bg-[#181716] transition-all px-5 py-4 text-left group rounded-xl cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white group-hover:text-accent transition-colors truncate">
                        {file.name}
                      </div>
                      <div className="font-mono text-[10px] text-white/40 mt-1 uppercase truncate">
                        {file.path}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-[10px] px-2 py-0.5 bg-white/5 border border-white/10 text-white/60 rounded uppercase">
                        {file.isDirectory ? 'DIR' : 'FILE'}
                      </span>
                      <ArrowRight
                        size={14}
                        className="text-white/30 group-hover:text-white group-hover:translate-x-0.5 transition-all"
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* System Metrics */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#141312] border border-white/8 rounded-xl p-6 shadow-md hover:border-white/15 transition-all">
              <div className="flex items-center justify-between text-white/50 font-mono text-[10px] font-bold tracking-widest uppercase mb-4">
                <span>INDEXED DOCUMENTS</span>
                <Brain size={16} className="text-[#ff7597]" />
              </div>
              <div className="text-3xl font-serif font-light text-white">
                {files.length}{' '}
                <span className="text-sm font-mono text-white/40 uppercase ml-1">Objects</span>
              </div>
              <p className="text-[10px] font-mono text-white/40 mt-2 uppercase">
                Living disk storage sandbox
              </p>
            </div>

            <div className="bg-[#141312] border border-white/8 rounded-xl p-6 shadow-md hover:border-white/15 transition-all">
              <div className="flex items-center justify-between text-white/50 font-mono text-[10px] font-bold tracking-widest uppercase mb-4">
                <span>PROVENANCE ACCURACY</span>
                <ShieldCheck size={16} className="text-emerald-400" />
              </div>
              <div className="text-3xl font-serif font-light text-white">
                100%{' '}
                <span className="text-sm font-mono text-white/40 uppercase ml-1">SHA-256</span>
              </div>
              <p className="text-[10px] font-mono text-white/40 mt-2 uppercase">
                Cryptographic line-grounding
              </p>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-10">
          <section>
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
              <span className="font-mono text-[10px] font-bold text-white/50 tracking-widest uppercase">
                AGENT ACTIVITY
              </span>
              <Link
                to={`/w/${workspace?.id}/agents`}
                className="font-mono text-[10px] font-bold text-accent hover:underline uppercase"
              >
                All →
              </Link>
            </div>
            <div className="space-y-3">
              {agents.map((a, i) => (
                <div
                  key={i}
                  className="group border border-white/8 bg-[#141312] hover:border-white/20 transition-all p-4 rounded-xl shadow-sm cursor-default"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${a.dotColor} ${
                        a.status === 'ACTIVE' ? 'animate-pulse' : ''
                      }`}
                    />
                    <span className="font-mono text-[11px] text-white font-bold uppercase">
                      {a.name}
                    </span>
                    <span className={`font-mono text-[9px] ml-auto font-bold uppercase ${a.color}`}>
                      {a.status}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-white/50 leading-relaxed italic">
                    {a.step}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
              <span className="font-mono text-[10px] font-bold text-white/50 tracking-widest uppercase">
                SYSTEM STATUS
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#141312] border border-white/8">
                <div className="w-8 h-8 rounded-lg bg-[#2a131a] border border-[#591b2b] flex items-center justify-center text-[#ff7597]">
                  <GitPullRequest size={14} />
                </div>
                <div>
                  <div className="text-[10.5px] font-bold text-white uppercase">
                    GOVERNANCE ACTIVE
                  </div>
                  <div className="font-mono text-[9px] text-white/40 uppercase">
                    Atomic disk writes enabled
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[#141312] border border-white/8">
                <div className="w-8 h-8 rounded-lg bg-[#062419] border border-[#0d4a34] flex items-center justify-center text-emerald-400">
                  <ShieldCheck size={14} />
                </div>
                <div>
                  <div className="text-[10.5px] font-bold text-white uppercase">
                    INTEGRITY VERIFIED
                  </div>
                  <div className="font-mono text-[9px] text-white/40 uppercase">
                    No unauthorized file mutations
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
export default Home;
