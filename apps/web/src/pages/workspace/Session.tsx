import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  XCircle,
  Sparkles,
  Users,
  Crown,
  Eye,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Clock,
  Zap,
  ArrowRight,
  Shield,
  Sliders
} from 'lucide-react';
import { api, SessionDetail, SessionEvent, SessionParticipant } from '../../lib/api-client';
import { useAuth } from '../../context/AuthContext';
import {
  joinSessionRoom,
  leaveSessionRoom,
  requestDriver as socketRequestDriver,
  approveDriver as socketApproveDriver,
  handoffDriver as socketHandoffDriver,
  onSessionEvent,
  onDriverChanged,
  onParticipantChanged
} from '../../lib/socket';
import { SessionTimeline } from '../../components/workspace/SessionTimeline';
import { RedirectComposer } from '../../components/workspace/RedirectComposer';
import { getSocket } from '../../lib/socket';

export const Session: React.FC = () => {
  const { workspaceId, sessionId } = useParams<{ workspaceId: string; sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [distillLoading, setDistillLoading] = useState(false);
  const [distilledSkills, setDistilledSkills] = useState<any[]>([]);
  const [discussionThread, setDiscussionThread] = useState<any | null>(null);
  const [discussionMessages, setDiscussionMessages] = useState<any[]>([]);
  const [discussionDraft, setDiscussionDraft] = useState('');

  const loadSession = async () => {
    if (!workspaceId || !sessionId) return;
    try {
      const data = await api.getSession(workspaceId, sessionId);
      setSession(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [workspaceId, sessionId]);

  useEffect(() => {
    if (!workspaceId || !sessionId) return;
    let disposed = false;
    (async () => {
      const title = `Live session: ${session?.title || sessionId}`;
      const threads = await api.listThreads(workspaceId);
      let thread = threads.find((item: any) => item.title === title);
      if (!thread) thread = await api.createThread(workspaceId, title);
      if (disposed) return;
      setDiscussionThread(thread);
      setDiscussionMessages(await api.listThreadMessages(workspaceId, thread.id));
    })().catch(() => {});
    return () => { disposed = true; };
  }, [workspaceId, sessionId, session?.title]);

  useEffect(() => {
    if (!workspaceId || !discussionThread) return;
    const socket = getSocket();
    const handleMessage = (message: any) => {
      if (message.threadId !== discussionThread.id) return;
      setDiscussionMessages((previous) => previous.some((item) => item.id === message.id) ? previous : [...previous, message]);
    };
    socket.on('message.created', handleMessage);
    return () => { socket.off('message.created', handleMessage); };
  }, [workspaceId, discussionThread?.id]);

  const sendDiscussionMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!workspaceId || !discussionThread || !discussionDraft.trim()) return;
    const message = await api.postThreadMessage(workspaceId, discussionThread.id, discussionDraft.trim());
    setDiscussionMessages((previous) => [...previous, message]);
    setDiscussionDraft('');
  };

  // Realtime Socket Room Management
  useEffect(() => {
    if (!sessionId || !workspaceId || !user) return;

    joinSessionRoom(workspaceId, sessionId);

    const cleanupEvent = onSessionEvent((event: SessionEvent) => {
      setSession((prev: SessionDetail | null) => {
        if (!prev) return prev;
        const exists = prev.events.some((e: SessionEvent) => e.id === event.id);
        const updatedEvents = exists ? prev.events : [...prev.events, event];

        let updatedStatus = prev.status;
        const eventType = String(event.type).toUpperCase().replace(/\./g, '_');
        if (eventType === 'SESSION_STARTED') updatedStatus = 'RUNNING';
        if (eventType === 'SESSION_PAUSED') updatedStatus = 'PAUSED';
        if (eventType === 'SESSION_RESUMED') updatedStatus = 'RUNNING';
        if (eventType === 'SESSION_COMPLETED') updatedStatus = 'COMPLETED';
        if (eventType === 'SESSION_FAILED') updatedStatus = 'FAILED';
        if (eventType === 'SESSION_CANCELLED') updatedStatus = 'CANCELLED';

        return {
          ...prev,
          status: updatedStatus,
          events: updatedEvents
        };
      });
    });

    const cleanupDriver = onDriverChanged((data: any) => {
      setSession((prev: SessionDetail | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          driverId: data.driverId || prev.driverId,
          activeDriverRequestId: data.activeDriverRequestId ?? prev.activeDriverRequestId
        };
      });
    });

    const cleanupParticipants = onParticipantChanged((data: any) => {
      setSession((prev: SessionDetail | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          participants: data.participants || prev.participants
        };
      });
    });

    return () => {
      cleanupEvent();
      cleanupDriver();
      cleanupParticipants();
      leaveSessionRoom(sessionId);
    };
  }, [sessionId, user]);

  const isDriver = session?.driverId === user?.id;
  const isAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const canControl = isDriver || isAdmin;

  const handleStart = async () => {
    if (!workspaceId || !sessionId) return;
    setActionLoading(true);
    try {
      await api.startSession(workspaceId, sessionId);
      await loadSession();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!workspaceId || !sessionId) return;
    setActionLoading(true);
    try {
      await api.pauseSession(workspaceId, sessionId);
      await loadSession();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!workspaceId || !sessionId) return;
    setActionLoading(true);
    try {
      await api.resumeSession(workspaceId, sessionId);
      await loadSession();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!workspaceId || !sessionId) return;
    if (!confirm('Are you sure you want to cancel this live session?')) return;
    setActionLoading(true);
    try {
      await api.cancelSession(workspaceId, sessionId);
      await loadSession();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestDriver = async () => {
    if (!sessionId || !workspaceId) return;
    try {
      socketRequestDriver(workspaceId, sessionId);
      await api.requestDriver(workspaceId, sessionId);
      setSuccessNotice('Driver access requested. Waiting for current Driver or Admin approval.');
      setTimeout(() => setSuccessNotice(null), 4000);
      await loadSession();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleApproveDriver = async (requesterId: string) => {
    if (!sessionId || !workspaceId) return;
    try {
      socketApproveDriver(workspaceId, sessionId, requesterId);
      await api.approveDriver(workspaceId, sessionId, requesterId);
      setSuccessNotice('Driver handed off successfully.');
      setTimeout(() => setSuccessNotice(null), 4000);
      await loadSession();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleHandoff = async (newDriverId: string) => {
    if (!sessionId || !workspaceId) return;
    try {
      socketHandoffDriver(workspaceId, sessionId, newDriverId);
      await api.handoffDriver(workspaceId, sessionId, newDriverId);
      setSuccessNotice('Driver control handed off.');
      setTimeout(() => setSuccessNotice(null), 4000);
      await loadSession();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRedirect = async (instruction: string, reason?: string, forceInterrupt?: boolean) => {
    if (!workspaceId || !sessionId) return;
    try {
      await api.submitRedirect(workspaceId, sessionId, {
        instruction,
        reason,
        forceInterrupt
      });
      setSuccessNotice(forceInterrupt ? 'Interrupt redirect applied!' : 'Redirect submitted to agent queue.');
      setTimeout(() => setSuccessNotice(null), 3500);
      await loadSession();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDistill = async () => {
    if (!workspaceId || !sessionId) return;
    setDistillLoading(true);
    try {
      const skills = await api.distillSession(workspaceId, sessionId);
      setDistilledSkills(skills);
      setSuccessNotice(`Distilled ${skills.length} candidate skill(s) from live human redirects!`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDistillLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-muted-foreground font-mono text-xs flex items-center justify-center gap-2">
        <RefreshCw size={14} className="animate-spin text-primary" />
        <span>Connecting to Live Control Room...</span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4 text-muted-foreground">
        <p className="font-serif text-xl font-light text-foreground">Session not found</p>
        <Link
          to={`/w/${workspaceId}/live`}
          className="font-mono text-xs text-primary underline underline-offset-4"
        >
          Return to Live Work
        </Link>
      </div>
    );
  }

  const driverParticipant = session.participants?.find((p: SessionParticipant) => p.userId === session.driverId);
  const pendingRequests = session.participants?.filter((p: SessionParticipant) => p.role === 'REQUESTING_DRIVER') || [];

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] text-foreground animate-fade-in">
      {/* Top Header */}
      <div className="bg-card border-b border-border px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/w/${workspaceId}/live`)}
            className="p-2 rounded bg-background hover:bg-secondary text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
            title="Back to sessions"
          >
            <ArrowLeft size={14} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-serif text-2xl font-light text-foreground">
                {session.title}
              </h1>
              <span
                className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wider ${
                  session.status === 'RUNNING'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse'
                    : session.status === 'PAUSED'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : session.status === 'COMPLETED'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'bg-secondary text-muted-foreground border border-border'
                }`}
              >
                {session.status}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 max-w-xl truncate font-sans">
              {session.goal}
            </p>
          </div>
        </div>

        {/* Top Control Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {session.status === 'CREATED' && (
            <button
              onClick={handleStart}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-500 text-black font-mono text-xs font-semibold rounded hover:bg-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <Play size={13} className="fill-current" />
              <span>START AGENT</span>
            </button>
          )}

          {session.status === 'RUNNING' && (
            <button
              onClick={handlePause}
              disabled={actionLoading}
              className="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 font-mono text-xs font-semibold rounded hover:bg-amber-500/20 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <Pause size={13} className="fill-current" />
              <span>PAUSE</span>
            </button>
          )}

          {session.status === 'PAUSED' && (
            <button
              onClick={handleResume}
              disabled={actionLoading}
              className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono text-xs font-semibold rounded hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
            >
              <Play size={13} className="fill-current" />
              <span>RESUME</span>
            </button>
          )}

          {(session.status === 'RUNNING' || session.status === 'PAUSED') && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-destructive/10 text-destructive border border-destructive/30 font-mono text-xs font-semibold rounded hover:bg-destructive/20 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <XCircle size={13} />
              <span>CANCEL</span>
            </button>
          )}

          <button
            onClick={handleDistill}
            disabled={distillLoading}
            className="px-4 py-2 bg-primary text-primary-foreground font-mono text-xs font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Distill permanent rules from human steering in this session"
          >
            <Sparkles size={13} className={distillLoading ? 'animate-spin' : ''} />
            <span>DISTILL SKILLS</span>
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {error && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-6 py-2.5 text-xs text-destructive font-mono flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="hover:opacity-80">✕</button>
        </div>
      )}
      {successNotice && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2.5 text-xs text-emerald-400 font-mono flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={13} />
            {successNotice}
          </span>
          <button onClick={() => setSuccessNotice(null)} className="hover:opacity-80">✕</button>
        </div>
      )}

      {/* Collaboration Status Bar */}
      <div className="bg-secondary/70 border-b border-border px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground uppercase text-[10px] tracking-wider">Driver:</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-background border border-border text-foreground font-semibold">
              <Crown size={12} className="text-amber-400" />
              <span>{driverParticipant?.user?.name || driverParticipant?.user?.email || (isDriver ? 'You' : 'Workspace Driver')}</span>
            </div>
          </div>

          <div className="h-4 w-px bg-border" />

          <div>
            {isDriver ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Active Driver. Your redirects steer agent decisions immediately.
              </span>
            ) : (
              <div className="flex items-center gap-2.5">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Eye size={12} />
                  Observing session.
                </span>
                <button
                  onClick={handleRequestDriver}
                  className="px-2.5 py-0.5 rounded bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary font-semibold transition-colors cursor-pointer"
                >
                  REQUEST DRIVER WHEEL
                </button>
              </div>
            )}
          </div>
        </div>

        {pendingRequests.length > 0 && canControl && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded">
            <ShieldAlert size={13} className="text-amber-400" />
            <span className="text-xs text-amber-300">
              {pendingRequests[0].user?.name || 'Observer'} requested Driver control:
            </span>
            <button
              onClick={() => handleApproveDriver(pendingRequests[0].userId)}
              className="px-2 py-0.5 bg-emerald-500 text-black text-[10px] font-bold rounded cursor-pointer hover:bg-emerald-400"
            >
              APPROVE HANDOFF
            </button>
          </div>
        )}
      </div>

      {/* Main Two-Column Control Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Live Timeline */}
        <div className="lg:col-span-8 p-6 overflow-y-auto border-r border-border space-y-6">
          <SessionTimeline events={session.events || []} currentDriverId={session.driverId} />
        </div>

        {/* Right Column: Steering, Skills, Participants */}
        <div className="lg:col-span-4 p-6 overflow-y-auto space-y-6 bg-card/40">
          <div className="p-5 bg-card border border-border rounded shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="font-mono text-xs font-bold uppercase tracking-wider">Team discussion</div>
              <span className="font-mono text-[10px] text-emerald-400">LIVE ROOM</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {discussionMessages.length === 0 ? (
                <div className="text-xs text-muted-foreground">Discuss evidence and steer the agent together.</div>
              ) : discussionMessages.map((message: any) => (
                <div key={message.id} className="rounded border border-border bg-background p-2">
                  <div className="font-mono text-[10px] text-primary">{message.author?.name || message.author?.email || 'Collaborator'}</div>
                  <div className="text-xs text-foreground mt-1 whitespace-pre-wrap">{message.content}</div>
                </div>
              ))}
            </div>
            <form onSubmit={sendDiscussionMessage} className="flex gap-2">
              <input
                value={discussionDraft}
                onChange={(event) => setDiscussionDraft(event.target.value)}
                placeholder="Add context for the room..."
                className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
              />
              <button type="submit" disabled={!discussionDraft.trim()} className="rounded bg-foreground px-3 py-1.5 font-mono text-[10px] text-background disabled:opacity-40">SEND</button>
            </form>
          </div>

          {/* Live Steering Panel */}
          <RedirectComposer
            sessionId={sessionId || ''}
            isDriver={isDriver}
            isAdmin={isAdmin}
            isPaused={session.status === 'PAUSED'}
            onRedirect={async (instruction: string, evidence?: string, force?: boolean) => {
              await handleRedirect(instruction, evidence, force);
            }}
            disabled={session.status !== 'RUNNING' && session.status !== 'PAUSED'}
          />

          {/* Distilled Skills Panel */}
          <div className="p-5 bg-card border border-border rounded shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground uppercase tracking-wider">
                <Sparkles size={14} className="text-primary" />
                <span>Distilled Skills</span>
              </div>
              <Link
                to={`/w/${workspaceId}/corrections`}
                className="font-mono text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <span>CATALOG</span>
                <ArrowRight size={11} />
              </Link>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Human interventions in this session are synthesized into reusable rules that future agents follow automatically.
            </p>

            {distilledSkills.length > 0 ? (
              <div className="space-y-2 pt-2">
                {distilledSkills.map((sk) => (
                  <div key={sk.id} className="p-3 bg-background border border-border rounded space-y-1 font-mono">
                    <div className="text-xs font-semibold text-foreground">{sk.rule}</div>
                    <div className="text-[11px] text-muted-foreground font-sans line-clamp-2">{sk.rationale}</div>
                    <div className="text-[10px] text-muted-foreground">Confidence: {Math.round((sk.confidence || 0.8) * 100)}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded bg-background border border-border text-center text-xs text-muted-foreground font-mono">
                Click DISTILL SKILLS anytime to generate rules from your redirects.
              </div>
            )}
          </div>

          {/* Participants Panel */}
          <div className="p-5 bg-card border border-border rounded shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground uppercase tracking-wider">
                <Users size={14} className="text-primary" />
                <span>Active Operators</span>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {session.participants?.length || 1} online
              </span>
            </div>

            <div className="space-y-2">
              {session.participants?.map((p: SessionParticipant) => {
                const isThisDriver = p.userId === session.driverId;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 rounded bg-background border border-border"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded bg-secondary border border-border flex items-center justify-center text-[10px] font-bold text-foreground shrink-0 font-mono">
                        {(p.user?.name?.[0] || p.user?.email?.[0] || 'U').toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="text-xs text-foreground font-medium truncate">
                          {p.user?.name || p.user?.email || 'User'}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground uppercase">
                          {isThisDriver ? 'Driver' : p.role}
                        </div>
                      </div>
                    </div>

                    {isDriver && !isThisDriver && (
                      <button
                        onClick={() => handleHandoff(p.userId)}
                        className="font-mono text-[10px] px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground border border-border transition-colors cursor-pointer"
                      >
                        PASS WHEEL
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
