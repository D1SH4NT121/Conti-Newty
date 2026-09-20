import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  CornerDownRight,
  Pause,
  XCircle,
  Zap,
  BookOpen,
  UserCheck,
  RotateCcw,
  SkipBack,
  SkipForward,
  Film
} from 'lucide-react';

export interface TimelineEvent {
  id?: string;
  type: string;
  actorId?: string | null;
  payload?: any;
  createdAt?: string | Date;
}

interface SessionTimelineProps {
  events: TimelineEvent[];
  currentDriverId?: string | null;
}

export const SessionTimeline: React.FC<SessionTimelineProps> = ({ events, currentDriverId }) => {
  const [replayMode, setReplayMode] = useState(false);
  const [scrubIndex, setScrubIndex] = useState(events.length);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const timerRef = useRef<any>(null);

  // Sync scrub index if not in replay mode
  useEffect(() => {
    if (!replayMode) {
      setScrubIndex(events.length);
    }
  }, [events.length, replayMode]);

  // Handle Playback timer
  useEffect(() => {
    if (isPlaying && replayMode) {
      const interval = Math.max(250, 1000 / playbackSpeed);
      timerRef.current = setInterval(() => {
        setScrubIndex((curr) => {
          if (curr >= events.length) {
            setIsPlaying(false);
            return curr;
          }
          return curr + 1;
        });
      }, interval);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, replayMode, playbackSpeed, events.length]);

  const getEventBadge = (type: string) => {
    switch (type) {
      case 'SESSION_STARTED':
        return { icon: Play, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Session Started' };
      case 'SESSION_COMPLETED':
        return { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Session Completed' };
      case 'SESSION_PAUSED':
        return { icon: Pause, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Session Paused' };
      case 'SESSION_FAILED':
        return { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20', label: 'Session Failed' };
      case 'SESSION_CANCELLED':
        return { icon: XCircle, color: 'text-muted-foreground', bg: 'bg-secondary border-border', label: 'Session Cancelled' };
      case 'REDIRECT_SUBMITTED':
        return { icon: CornerDownRight, color: 'text-primary', bg: 'bg-primary/10 border-primary/20', label: 'Human Steering Applied' };
      case 'AGENT_STEP_INTERRUPTED':
        return { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Step Interrupted' };
      case 'CORRECTION_CAPTURED':
        return { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Correction Captured' };
      case 'SKILL_PROPOSED':
        return { icon: Lightbulb, color: 'text-primary', bg: 'bg-primary/10 border-primary/20', label: 'Skill Distilled' };
      case 'SKILL_CONFIRMED':
        return { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Skill Confirmed' };
      case 'SKILLS_APPLIED':
        return { icon: BookOpen, color: 'text-primary', bg: 'bg-primary/10 border-primary/20', label: 'Learned Rules Applied' };
      case 'DRIVER_APPROVED':
      case 'DRIVER_HANDOFF':
        return { icon: UserCheck, color: 'text-primary', bg: 'bg-primary/10 border-primary/20', label: 'Driver Changed' };
      default:
        return { icon: Zap, color: 'text-muted-foreground', bg: 'bg-secondary border-border', label: type };
    }
  };

  const formatPayload = (payload: any) => {
    if (!payload) return null;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        return <div className="mt-1 font-mono text-xs text-foreground/80">{payload}</div>;
      }
    }

    if (payload.instruction) {
      return (
        <div className="mt-2 p-3 rounded bg-secondary/80 border border-border text-xs text-foreground font-sans">
          <span className="font-mono text-[11px] font-semibold text-primary uppercase mr-2">Operator Guidance:</span>
          &ldquo;{payload.instruction}&rdquo;
          {payload.force && (
            <span className="ml-2 font-mono text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 font-semibold">
              FORCE INTERRUPT
            </span>
          )}
        </div>
      );
    }

    if (payload.appliedSkills && Array.isArray(payload.appliedSkills) && payload.appliedSkills.length > 0) {
      return (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {payload.appliedSkills.map((s: any, idx: number) => (
            <span
              key={idx}
              className="font-mono text-[10px] px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-semibold uppercase"
            >
              {s.title || s.rule}
            </span>
          ))}
        </div>
      );
    }

    if (payload.output) {
      return (
        <div className="mt-2 p-3 rounded bg-background border border-border text-xs text-foreground font-mono whitespace-pre-wrap leading-relaxed">
          {payload.output}
        </div>
      );
    }

    if (payload.error) {
      return <div className="mt-1.5 font-mono text-xs text-destructive">{payload.error}</div>;
    }

    return null;
  };

  if (!events || events.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground font-mono text-xs">
        No events recorded for this session yet. Start the agent to begin execution.
      </div>
    );
  }

  const visibleEvents = replayMode ? events.slice(0, Math.max(1, scrubIndex)) : events;

  return (
    <div className="space-y-4">
      {/* Replay Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-card border border-border rounded shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setReplayMode(!replayMode);
              if (replayMode) {
                setIsPlaying(false);
                setScrubIndex(events.length);
              } else {
                setScrubIndex(1);
              }
            }}
            className={`px-3 py-1.5 rounded font-mono text-xs font-semibold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
              replayMode
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            <Film size={13} />
            <span>{replayMode ? 'REPLAY ACTIVE' : 'REPLAY SCRUBBER'}</span>
          </button>

          {replayMode && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setScrubIndex(1)}
                className="p-1.5 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
                title="Restart replay"
              >
                <RotateCcw size={13} />
              </button>
              <button
                onClick={() => setScrubIndex((i) => Math.max(1, i - 1))}
                className="p-1.5 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
                title="Previous step"
              >
                <SkipBack size={13} />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-1.5 rounded font-medium transition-all cursor-pointer ${
                  isPlaying
                    ? 'bg-amber-500 text-black'
                    : 'bg-emerald-500 text-black'
                }`}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause size={13} className="fill-current" /> : <Play size={13} className="fill-current" />}
              </button>
              <button
                onClick={() => setScrubIndex((i) => Math.min(events.length, i + 1))}
                className="p-1.5 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border transition-colors cursor-pointer"
                title="Next step"
              >
                <SkipForward size={13} />
              </button>
            </div>
          )}
        </div>

        {replayMode && (
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <input
              type="range"
              min={1}
              max={events.length}
              value={scrubIndex}
              onChange={(e) => {
                setScrubIndex(Number(e.target.value));
                setIsPlaying(false);
              }}
              className="flex-1 h-1.5 bg-secondary rounded cursor-pointer accent-primary"
            />
            <span className="font-mono text-xs text-foreground shrink-0">
              {scrubIndex} / {events.length}
            </span>

            <div className="flex items-center gap-1 shrink-0">
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold transition-colors cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground border border-border'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {visibleEvents.map((ev, index) => {
          const badge = getEventBadge(ev.type);
          const Icon = badge.icon;
          const timeStr = ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString() : '';
          const isCurrentScrubEvent = replayMode && index === visibleEvents.length - 1;

          return (
            <div
              key={ev.id || index}
              className={`p-4 rounded border transition-all ${
                isCurrentScrubEvent
                  ? 'bg-card border-foreground/40 shadow-md ring-1 ring-primary/30'
                  : 'bg-card border-border hover:border-foreground/20'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded border shrink-0 ${badge.bg} ${badge.color}`}>
                    <Icon size={14} />
                  </div>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {badge.label}
                  </span>
                </div>

                {timeStr && (
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {timeStr}
                  </span>
                )}
              </div>

              {formatPayload(ev.payload)}
            </div>
          );
        })}
      </div>
    </div>
  );
};
