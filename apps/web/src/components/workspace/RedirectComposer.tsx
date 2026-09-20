import React, { useState } from 'react';
import { Send, ShieldAlert, AlertCircle, Radio } from 'lucide-react';

interface RedirectComposerProps {
  sessionId: string;
  isDriver: boolean;
  isAdmin: boolean;
  isPaused?: boolean;
  onRedirect: (instruction: string, evidence?: string, force?: boolean) => Promise<void>;
  disabled?: boolean;
}

export const RedirectComposer: React.FC<RedirectComposerProps> = ({
  isDriver,
  isAdmin,
  isPaused,
  onRedirect,
  disabled
}) => {
  const [instruction, setInstruction] = useState('');
  const [evidence, setEvidence] = useState('');
  const [force, setForce] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = (isDriver || (isAdmin && force)) && instruction.trim().length > 0 && !disabled && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await onRedirect(instruction.trim(), evidence.trim() || undefined, force);
      setInstruction('');
      setEvidence('');
      setForce(false);
    } catch (err: any) {
      setError(err.message || 'Failed to submit redirect');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-5 bg-card border border-border rounded shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground uppercase tracking-wider">
          <Radio size={14} className="text-primary animate-pulse" />
          <span>Steer &amp; Redirect Agent</span>
        </div>
        {isDriver && (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase">
            Active Driver
          </span>
        )}
        {!isDriver && isAdmin && (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-semibold uppercase">
            Admin Authority
          </span>
        )}
        {!isDriver && !isAdmin && (
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-secondary text-muted-foreground border border-border font-semibold uppercase">
            Observer Mode
          </span>
        )}
      </div>

      {isPaused && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-300 font-mono flex items-center gap-2">
          <AlertCircle size={13} className="shrink-0" />
          <span>Session paused. Interventions apply immediately upon resumption.</span>
        </div>
      )}

      {!isDriver && !isAdmin && (
        <div className="p-3 bg-secondary border border-border rounded text-xs text-muted-foreground font-mono flex items-center gap-2">
          <AlertCircle size={13} className="shrink-0 text-muted-foreground" />
          <span>Only the active Driver can redirect execution. Request Driver wheel above.</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive font-mono text-xs flex items-center gap-2">
          <AlertCircle size={13} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5 font-semibold">
            HUMAN STEERING INSTRUCTION
          </label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={(!isDriver && !(isAdmin && force)) || disabled}
            placeholder={
              isDriver
                ? 'e.g., "Do not use mock data; query the real docs/sop-incident-response.md file from the Brain..."'
                : isAdmin && force
                ? 'Admin force interrupt directive...'
                : 'Observer mode — request Driver control to guide agent'
            }
            rows={3}
            className="w-full px-3.5 py-2.5 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed leading-relaxed"
          />
        </div>

        <div>
          <label className="font-mono text-xs text-muted-foreground block mb-1.5 font-semibold">
            EVIDENCE / FILE PATH (OPTIONAL)
          </label>
          <input
            type="text"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            disabled={(!isDriver && !(isAdmin && force)) || disabled}
            placeholder="e.g. docs/product-roadmap.md or error line 42"
            className="w-full px-3.5 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          {!isDriver && isAdmin ? (
            <label className="flex items-center gap-2 text-xs text-amber-400 cursor-pointer select-none font-mono">
              <input
                type="checkbox"
                checked={force}
                onChange={(e) => setForce(e.target.checked)}
                className="rounded border-amber-500/50 bg-background text-amber-500 focus:ring-0"
              />
              <ShieldAlert size={13} />
              <span>Force Override (Admin)</span>
            </label>
          ) : (
            <div />
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-2 bg-primary text-primary-foreground font-mono text-xs font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm ml-auto"
          >
            <Send size={12} />
            <span>{submitting ? 'STEERING...' : 'APPLY REDIRECT'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
