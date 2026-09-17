import React, { useEffect, useState } from 'react';
import { api, WorkspaceSummary } from '../lib/api-client';
import { useAuth } from '../context/AuthContext';
import { CreateWorkspaceModal } from '../components/CreateWorkspaceModal';

export const WorkspaceSelector: React.FC<{ onSelect: (workspace: WorkspaceSummary) => void }> = ({ onSelect }) => {
  const { user, logout } = useAuth();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchWorkspaces = () => {
    setLoading(true);
    api.getWorkspaces()
      .then(setWorkspaces)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0f12] text-[#e1e4ea] flex flex-col items-center justify-center px-4 font-sans antialiased">
      <div className="w-full max-w-2xl border border-[#23272e] bg-[#12151a] p-8 shadow-2xl">
        <div className="flex items-center justify-between pb-6 border-b border-[#23272e] mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">Authenticated Identity</span>
            </div>
            <div className="text-sm font-medium text-white">{user?.name || user?.email}</div>
            <div className="text-xs font-mono text-[#8b949e]">Role: {user?.role}</div>
          </div>
          <button
            onClick={logout}
            className="text-xs font-mono text-[#8b949e] hover:text-white px-3 py-1.5 border border-[#282e38] hover:border-[#484f58] transition-colors"
          >
            Sign Out
          </button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-light text-white mb-1 tracking-tight">Select Knowledge Workspace</h2>
            <p className="text-xs text-[#8b949e]">Choose or initialize an active workspace with living filesystem.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-xs font-medium bg-[#8B263E] hover:bg-[#A32F4C] text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>+</span> New Workspace
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono text-[#8b949e]">Loading active workspaces...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-950/40 border border-red-800/60 text-red-300 text-xs font-mono mb-4">
            {error}
          </div>
        ) : workspaces.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-[#8b949e]">
            No workspaces found for your account.
          </div>
        ) : (
          <div className="space-y-3">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => onSelect(ws)}
                className="w-full text-left p-4 border border-[#23272e] bg-[#161a21] hover:border-emerald-500/60 hover:bg-[#1b2029] transition-all duration-150 group"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-sm text-white group-hover:text-emerald-300 transition-colors">
                    {ws.name}
                  </div>
                  <span className="font-mono text-[10px] tracking-wider uppercase px-2 py-0.5 bg-[#23272e] text-[#8b949e] group-hover:border-emerald-500/40">
                    {ws.role}
                  </span>
                </div>
                <div className="text-xs text-[#8b949e] mb-2">{ws.description || 'General company workspace.'}</div>
                <div className="font-mono text-[10px] text-[#6e7681]">ID: {ws.id}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <CreateWorkspaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={(ws) => {
          fetchWorkspaces();
          onSelect(ws);
        }}
      />
    </div>
  );
};
