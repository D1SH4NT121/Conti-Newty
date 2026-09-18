import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { api, WorkspaceSummary, WorkspaceMemberItem } from '../lib/api-client';
import { useAuth } from '../context/AuthContext';
import { MultiplayerCursors } from './workspace/MultiplayerCursors';
import { getSocket } from '../lib/socket';

const NAV_ITEMS: { label: string; path: string; icon: string }[] = [
  { label: 'Home', path: 'home', icon: '\u2302' },
  { label: 'Ask', path: 'ask', icon: '?' },
  { label: 'Work', path: 'work', icon: '\u25EB' },
  { label: 'Company Brain', path: 'brain', icon: '\u25C9' },
  { label: 'Agents', path: 'agents', icon: '\u2B21' },
  { label: 'Software', path: 'software', icon: '\u2699' },
];

const ADMIN_ITEMS: { label: string; path: string; icon: string }[] = [
  { label: 'Members', path: 'members', icon: '\u2687' },
  { label: 'Activity', path: 'activity', icon: '\u224B' },
  { label: 'Security', path: 'security', icon: '\u2297' },
  { label: 'Settings', path: 'settings', icon: '\u2699' },
];

const QUICK_ACCESS: { label: string; path: string }[] = [
  { label: 'Company Brain', path: 'brain' },
  { label: 'Active Work', path: 'work' },
  { label: 'Agents', path: 'agents' },
  { label: 'Activity', path: 'activity' },
];

function SearchModal({ onClose, workspaceId }: { onClose: () => void; workspaceId: string }) {
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const ql = q.trim().toLowerCase();
  const filtered =
    ql.length > 1
      ? [...NAV_ITEMS, ...ADMIN_ITEMS].filter((i) => i.label.toLowerCase().includes(ql)).slice(0, 5)
      : [];

  const go = (path: string) => {
    navigate(`/w/${workspaceId}/${path}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-background border border-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-border px-4">
          <span className="font-mono text-xs text-muted-foreground mr-3">⌘K</span>
          <input
            type="text"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company brain, work, people, agents..."
            className="flex-1 py-4 bg-transparent text-foreground text-sm focus:outline-none placeholder-muted-foreground"
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
          <button
            onClick={onClose}
            className="font-mono text-xs text-muted-foreground hover:text-foreground ml-3"
          >
            ESC
          </button>
        </div>
        {filtered.length > 0 && (
          <div className="max-h-72 overflow-auto">
            {filtered.map((r) => (
              <button
                key={r.path}
                onClick={() => go(r.path)}
                className="w-full flex items-start gap-4 px-4 py-3 hover:bg-card transition-colors text-left border-b border-border last:border-0"
              >
                <span className="font-mono text-xs text-muted-foreground w-16 shrink-0 pt-0.5">
                  GO TO
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground mb-0.5">{r.label}</div>
                  <div className="font-mono text-xs text-muted-foreground mb-0.5">
                    /w/{workspaceId}/{r.path}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        {q.trim().length > 1 && filtered.length === 0 && (
          <div className="p-6 text-center font-mono text-xs text-muted-foreground">
            No results found for &quot;{q}&quot;.
          </div>
        )}
        {q.trim().length <= 1 && (
          <div className="p-4">
            <div className="font-mono text-xs text-muted-foreground mb-2">QUICK ACCESS</div>
            <div className="flex flex-wrap gap-2">
              {QUICK_ACCESS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => go(item.path)}
                  className="font-mono text-xs px-3 py-1.5 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const NOTIF_ITEMS = [
  { id: 'n1', actor: 'System', msg: 'Workspace ready — agents standing by', time: 'now' },
];

function NotifPanel({ onClose, workspaceId }: { onClose: () => void; workspaceId: string }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = NOTIF_ITEMS.filter((n) => !dismissed.has(n.id));

  return (
    <div className="absolute right-0 top-full mt-1 w-80 bg-background border border-border shadow-xl z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-mono text-xs text-foreground">NOTIFICATIONS</span>
        <button
          onClick={onClose}
          className="font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>
      <div className="max-h-80 overflow-auto">
        {visible.length === 0 && (
          <div className="p-6 text-center font-mono text-xs text-muted-foreground">
            No notifications.
          </div>
        )}
        {visible.map((n, i) => (
          <div
            key={n.id}
            className={`px-4 py-3 border-b border-border last:border-0 ${i < 3 ? 'bg-card' : ''}`}
          >
            <div className="flex items-start gap-2">
              {i < 3 && <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />}
              {i >= 3 && <div className="w-1.5 h-1.5 shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground leading-relaxed mb-0.5">
                  {n.actor} — {n.msg}
                </p>
                <span className="font-mono text-xs text-muted-foreground">{n.time}</span>
              </div>
              <button
                onClick={() => setDismissed((d) => new Set([...d, n.id]))}
                className="text-muted-foreground hover:text-foreground text-xs ml-1 shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
      {visible.length > 0 && (
        <div className="px-4 py-2 border-t border-border">
          <Link
            to={`/w/${workspaceId}/activity`}
            onClick={onClose}
            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all activity →
          </Link>
        </div>
      )}
    </div>
  );
}

export const WorkspaceShell: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<WorkspaceSummary | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [liveTaskCount, setLiveTaskCount] = useState(0);
  const [multiplayerEnabled, setMultiplayerEnabled] = useState(() => {
    const saved = localStorage.getItem('anti_multiplayer_enabled');
    return saved !== 'false';
  });

  useEffect(() => {
    api
      .getWorkspaces()
      .then((list) => {
        setWorkspaces(list);
        if (workspaceId) {
          const matched = list.find((w) => w.id === workspaceId);
          if (matched) {
            setCurrentWorkspace(matched);
          } else if (list.length > 0) {
            navigate(`/w/${list[0].id}/home`);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    if (workspaceId) {
      api.getWorkspaceMembers(workspaceId).then(setMembers).catch(console.error);
    }
  }, [workspaceId]);

  // Live task notifications via socket
  useEffect(() => {
    if (!workspaceId) return;
    const socket = getSocket();
    const handleCreated = () => setLiveTaskCount(n => n + 1);
    const handleUpdated = (data: { status: string }) => {
      if (data.status === 'RUNNING') setLiveTaskCount(n => n + 1);
      if (data.status === 'COMPLETED' || data.status === 'FAILED') setLiveTaskCount(n => Math.max(0, n - 1));
    };
    socket.on('task.created', handleCreated);
    socket.on('task.updated', handleUpdated);
    return () => { socket.off('task.created', handleCreated); socket.off('task.updated', handleUpdated); };
  }, [workspaceId]);

  const workspaceName = currentWorkspace?.name ?? 'Workspace';
  const unreadCount = NOTIF_ITEMS.length;

  const isActive = (path: string) => location.pathname.includes(`/${path}`);

  const handleLogout = () => {
    logout();
    navigate('/auth');
    setMobileSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-mono text-xs text-muted-foreground">
        Loading Sovereign Workspace...
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 px-2 py-2 bg-card border border-border">
          <div className="w-6 h-6 bg-foreground rounded-sm flex items-center justify-center text-xs font-mono font-bold text-background shrink-0">
            {(workspaceName[0] ?? 'C').toUpperCase()}
          </div>
          <span className="font-mono text-xs text-foreground truncate font-semibold">
            {workspaceName.toUpperCase()}
          </span>
        </div>
        <select
          value={currentWorkspace?.id || ''}
          onChange={(e) => {
            if (e.target.value === 'new') {
              navigate('/onboarding');
            } else if (e.target.value) {
              navigate(`/w/${e.target.value}/home`);
            }
            setMobileSidebarOpen(false);
          }}
          className="mt-2 w-full bg-transparent border border-border font-mono text-xs text-muted-foreground px-2 py-1.5 outline-none cursor-pointer"
        >
          {workspaces.map((ws) => (
            <option key={ws.id} value={ws.id}>
              {ws.name} ({ws.role})
            </option>
          ))}
          <option value="new">+ New workspace...</option>
        </select>
      </div>
      <nav className="flex-1 p-3 overflow-y-auto">
        <div className="px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
          Surfaces
        </div>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={`/w/${workspaceId}/${item.path}`}
            onClick={() => setMobileSidebarOpen(false)}
            className={`w-full flex items-center gap-3 px-3 py-2 mb-0.5 text-left transition-colors ${
              isActive(item.path)
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-card'
            }`}
          >
            <span className={`text-sm w-4 text-center shrink-0 ${
              isActive(item.path) ? 'text-background' : 'text-muted-foreground'
            }`}>
              {item.icon}
            </span>
            <span className="font-mono text-xs">{item.label}</span>
            {item.path === 'agents' && liveTaskCount > 0 && (
              <span className="ml-auto w-4 h-4 rounded-full bg-amber-400 text-black font-mono text-[9px] font-bold flex items-center justify-center animate-pulse">
                {liveTaskCount}
              </span>
            )}
          </Link>
        ))}
        <div className="pt-4 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground font-bold">
          Management
        </div>
        {ADMIN_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={`/w/${workspaceId}/${item.path}`}
            onClick={() => setMobileSidebarOpen(false)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
              isActive(item.path)
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-card'
            }`}
          >
            <span className="text-sm w-4 text-center shrink-0">{item.icon}</span>
            <span className="font-mono text-xs">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-2 py-1.5 overflow-hidden">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name || user.email}
              className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-foreground flex items-center justify-center text-background font-mono text-xs font-bold shrink-0">
              {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="font-mono text-xs text-foreground truncate font-semibold">
              {(user?.name || user?.email || 'USER').toUpperCase()}
            </div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase truncate">
              {currentWorkspace?.role ?? 'MEMBER'}
            </div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 mt-1 text-left text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
        >
          <span className="text-sm w-4 text-center shrink-0">↩</span>
          <span className="font-mono text-xs">Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden md:flex flex-col w-52 border-r border-border shrink-0">
        {sidebarContent}
      </aside>

      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-52 bg-background border-r border-border flex flex-col">
            {sidebarContent}
          </div>
          <div className="flex-1 bg-foreground/20" onClick={() => setMobileSidebarOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 border-b border-border flex items-center px-4 gap-4 shrink-0">
          <button
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="font-mono text-xs text-muted-foreground hidden md:block">
            {workspaceName.toUpperCase()}
          </span>
          <div className="flex-1" />
          {/* Multiplayer AI Live Presence Indicator & Toggle */}
          <button
            onClick={() => {
              setMultiplayerEnabled((prev) => {
                const next = !prev;
                localStorage.setItem('anti_multiplayer_enabled', String(next));
                return next;
              });
            }}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono tracking-wider transition-all cursor-pointer ${
              multiplayerEnabled
                ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                : 'bg-zinc-900/60 border-zinc-700 text-zinc-400'
            }`}
            title="Toggle live multiplayer AI and human cursor presence"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                multiplayerEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
              }`}
            />
            <span>{multiplayerEnabled ? 'MULTIPLAYER ON' : 'MULTIPLAYER OFF'}</span>
          </button>

          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth={1.5} />
              <path d="m21 21-4.35-4.35" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
            <span className="font-mono text-xs hidden sm:block">Search</span>
            <span className="font-mono text-xs text-muted-foreground hidden sm:block">⌘K</span>
          </button>
          <div className="flex items-center -space-x-1.5">
            {(() => {
              const displayed = members.slice(0, 4);
              const currentUserInList = user && displayed.some((m) => m.userId === user.id);
              const avatarList = currentUserInList || !user
                ? displayed
                : [...displayed.slice(0, 3), null]; // null = current user slot
              return avatarList.map((m, i) => {
                if (m === null) {
                  // Current user slot (not in members list yet)
                  return user?.avatarUrl ? (
                    <img key="me" src={user.avatarUrl} alt={user.name || user.email}
                      title={user.name || user.email}
                      className="w-6 h-6 rounded-full object-cover border-2 border-background shadow-sm" />
                  ) : (
                    <div key="me" title={user?.name || user?.email}
                      className="w-6 h-6 rounded-full bg-foreground border-2 border-background flex items-center justify-center text-background font-mono text-[10px] font-bold">
                      {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                    </div>
                  );
                }
                const memberInitial = (m.user.name?.[0] || m.user.email?.[0] || 'U').toUpperCase();
                return m.user.avatarUrl ? (
                  <img key={m.id} src={m.user.avatarUrl} alt={m.user.name || m.user.email}
                    title={`${m.user.name || m.user.email} (${m.role})`}
                    className="w-6 h-6 rounded-full object-cover border-2 border-background shadow-sm" />
                ) : (
                  <div key={m.id} title={`${m.user.name || m.user.email} (${m.role})`}
                    className="w-6 h-6 rounded-full bg-foreground border-2 border-background flex items-center justify-center text-background font-mono text-[10px] font-bold shadow-sm">
                    {memberInitial}
                  </div>
                );
              });
            })()}
          </div>
          <div className="relative">
            <button
              onClick={() => setNotifOpen(!notifOpen)}
              className="relative w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
            {notifOpen && (
              <NotifPanel onClose={() => setNotifOpen(false)} workspaceId={workspaceId ?? ''} />
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto relative">
          <Outlet context={{ workspace: currentWorkspace }} />
          {/* Live Multiplayer Cursors */}
          <MultiplayerCursors enabled={multiplayerEnabled} workspaceId={workspaceId} />
        </main>

        <div className="md:hidden border-t border-border bg-background flex shrink-0">
          {[
            { path: 'brain', label: 'BRAIN' },
            { path: 'work', label: 'WORK' },
            { path: 'ask', label: 'ASK' },
            { path: 'agents', label: 'AGENTS' },
            { path: 'activity', label: 'ACTIVITY' },
          ].map((item) => (
            <Link
              key={item.path}
              to={`/w/${workspaceId}/${item.path}`}
              className={`flex-1 flex flex-col items-center py-2.5 transition-colors font-mono text-[9px] tracking-wider gap-0.5 ${
                isActive(item.path) ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {searchOpen && (
        <SearchModal onClose={() => setSearchOpen(false)} workspaceId={workspaceId ?? ''} />
      )}
    </div>
  );
};
