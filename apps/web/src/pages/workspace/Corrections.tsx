import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  BookOpen,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  Zap,
  ArrowRight,
  Database,
  Tag,
  AlertTriangle,
  History,
  Shield
} from 'lucide-react';
import { api, SkillEntry, KnowledgeCandidate } from '../../lib/api-client';

export const Corrections: React.FC = () => {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const [mode, setMode] = useState<'KNOWLEDGE' | 'SKILLS'>('KNOWLEDGE');
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [candidates, setCandidates] = useState<KnowledgeCandidate[]>([]);
  const [activeTab, setActiveTab] = useState<'TENTATIVE' | 'CONFIRMED' | 'ALL'>('TENTATIVE');
  const [loading, setLoading] = useState(true);
  const [distilling, setDistilling] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const loadData = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [skillsData, candidatesData] = await Promise.all([
        api.listSkills(workspaceId),
        api.listKnowledgeCandidates(workspaceId, 'ALL'),
      ]);
      setSkills(skillsData);
      setCandidates(candidatesData.candidates);
    } catch (err: any) {
      setError(err.message || 'Failed to load review queues');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const handleDistill = async () => {
    if (!workspaceId) return;
    setDistilling(true);
    try {
      const result = await api.distillKnowledge(workspaceId);
      setSuccessNotice(
        `Synthesis complete: ${result.candidatesCreated} candidates created, ${result.candidatesMerged} merged.`
      );
      setTimeout(() => setSuccessNotice(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Distillation failed');
    } finally {
      setDistilling(false);
    }
  };

  // Skill handlers
  const handleConfirmSkill = async (skillId: string) => {
    if (!workspaceId) return;
    setProcessingId(skillId);
    try {
      await api.confirmSkill(workspaceId, skillId);
      setSuccessNotice('Skill confirmed. This rule will now be auto-injected into future agent sessions.');
      setTimeout(() => setSuccessNotice(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSkill = async (skillId: string) => {
    if (!workspaceId) return;
    setProcessingId(skillId);
    try {
      await api.rejectSkill(workspaceId, skillId);
      setSuccessNotice('Candidate skill rejected.');
      setTimeout(() => setSuccessNotice(null), 3000);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Candidate handlers
  const handleConfirmCandidate = async (candidateId: string) => {
    if (!workspaceId) return;
    setProcessingId(candidateId);
    try {
      await api.confirmKnowledgeCandidate(workspaceId, candidateId);
      setSuccessNotice('Knowledge candidate confirmed into sovereign Tribal Memory!');
      setTimeout(() => setSuccessNotice(null), 4000);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectCandidate = async (candidateId: string) => {
    if (!workspaceId) return;
    setProcessingId(candidateId);
    try {
      await api.rejectKnowledgeCandidate(workspaceId, candidateId);
      setSuccessNotice('Knowledge candidate rejected.');
      setTimeout(() => setSuccessNotice(null), 3000);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Filtering
  const filteredSkills = skills.filter((s) => {
    if (activeTab === 'ALL') return true;
    return s.status === activeTab;
  });

  const filteredCandidates = candidates.filter((c) => {
    if (activeTab === 'ALL') return true;
    return c.status === activeTab;
  });

  const pendingSkillsCount = skills.filter((s) => s.status === 'TENTATIVE').length;
  const pendingCandidatesCount = candidates.filter((c) => c.status === 'TENTATIVE').length;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8 animate-fade-in text-foreground">
      {/* Header */}
      <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-primary font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" />
            Sovereign Knowledge Synthesis
          </p>
          <h1 className="font-serif text-3xl font-light text-foreground">
            Corrections &amp; Skill Catalog
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review knowledge candidates distilled from live operator redirects, Slack messages, Google Drive docs, and Jira tickets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2.5 bg-secondary hover:bg-secondary/80 border border-border rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh review queues"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleDistill}
            disabled={distilling}
            className="px-4 py-2 bg-primary text-primary-foreground font-mono text-xs font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-sm"
          >
            {distilling ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>SYNTHESIZING...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>RUN DISTILLATION</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded bg-destructive/10 border border-destructive/20 text-destructive font-mono text-xs flex items-center gap-2">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      )}

      {successNotice && (
        <div className="p-4 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs flex items-center gap-2">
          <CheckCircle2 size={14} />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Mode Switcher & Filter Toolbar */}
      <div className="p-4 bg-card border border-border rounded shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Mode Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMode('KNOWLEDGE');
              setActiveTab('TENTATIVE');
            }}
            className={`px-4 py-2 font-mono text-xs font-semibold rounded border transition-all cursor-pointer flex items-center gap-2 ${
              mode === 'KNOWLEDGE'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            <Database size={13} />
            <span>TRIBAL MEMORY CANDIDATES</span>
            {pendingCandidatesCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${mode === 'KNOWLEDGE' ? 'bg-primary-foreground text-primary' : 'bg-primary/20 text-primary'}`}>
                {pendingCandidatesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setMode('SKILLS');
              setActiveTab('TENTATIVE');
            }}
            className={`px-4 py-2 font-mono text-xs font-semibold rounded border transition-all cursor-pointer flex items-center gap-2 ${
              mode === 'SKILLS'
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-background text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            <BookOpen size={13} />
            <span>LIVE AGENT SKILLS</span>
            {pendingSkillsCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${mode === 'SKILLS' ? 'bg-primary-foreground text-primary' : 'bg-primary/20 text-primary'}`}>
                {pendingSkillsCount}
              </span>
            )}
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 font-mono text-xs">
          {(['TENTATIVE', 'CONFIRMED', 'ALL'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-secondary text-foreground border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'TENTATIVE' ? 'PENDING REVIEW' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Review Surface */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground font-mono text-xs flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin text-primary" />
          <span>Loading knowledge queue...</span>
        </div>
      ) : mode === 'KNOWLEDGE' ? (
        /* Candidates View */
        <div className="space-y-4">
          {filteredCandidates.length === 0 ? (
            <div className="p-12 text-center bg-card border border-border rounded shadow-sm space-y-3">
              <Database size={28} className="text-muted-foreground mx-auto" />
              <div className="font-serif text-lg font-light text-foreground">
                No knowledge candidates in &ldquo;{activeTab}&rdquo; status
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                Connect Drive, Slack, or Jira from Onboarding / Settings and run synthesis to automatically extract organizational decisions and facts.
              </p>
            </div>
          ) : (
            filteredCandidates.map((cand) => (
              <div
                key={cand.id}
                className="p-6 bg-card border border-border rounded shadow-sm hover:border-foreground/30 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                        cand.status === 'CONFIRMED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : cand.status === 'REJECTED'
                          ? 'bg-destructive/10 text-destructive border border-destructive/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {cand.status}
                    </span>
                    <span className="font-serif text-lg font-light text-foreground">
                      {cand.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                    {cand.sourceConnector && (
                      <span className="px-2 py-0.5 rounded bg-secondary border border-border">
                        SRC: {cand.sourceConnector.toUpperCase()}
                      </span>
                    )}
                    <span>CONFIDENCE: {Math.round((cand.confidence || 0.8) * 100)}%</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {cand.summary}
                </p>

                <div className="bg-background/80 p-3.5 rounded border border-border font-sans text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {cand.content}
                </div>

                {cand.status === 'TENTATIVE' && (
                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                    <button
                      onClick={() => handleRejectCandidate(cand.id)}
                      disabled={processingId === cand.id}
                      className="px-3.5 py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 font-mono text-xs font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle size={13} />
                      <span>REJECT</span>
                    </button>
                    <button
                      onClick={() => handleConfirmCandidate(cand.id)}
                      disabled={processingId === cand.id}
                      className="px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-xs font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} />
                      <span>CONFIRM INTO MEMORY</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Skills View */
        <div className="space-y-4">
          {filteredSkills.length === 0 ? (
            <div className="p-12 text-center bg-card border border-border rounded shadow-sm space-y-3">
              <BookOpen size={28} className="text-muted-foreground mx-auto" />
              <div className="font-serif text-lg font-light text-foreground">
                No agent skills in &ldquo;{activeTab}&rdquo; status
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                Run live sessions with human steering. When you redirect an agent, the system automatically distills recurring procedural rules into this catalog.
              </p>
            </div>
          ) : (
            filteredSkills.map((sk) => (
              <div
                key={sk.id}
                className="p-6 bg-card border border-border rounded shadow-sm hover:border-foreground/30 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                        sk.status === 'CONFIRMED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : sk.status === 'REJECTED'
                          ? 'bg-destructive/10 text-destructive border border-destructive/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {sk.status}
                    </span>
                    <span className="font-serif text-lg font-light text-foreground">
                      {sk.title || sk.rule}
                    </span>
                  </div>

                  <div className="font-mono text-[11px] text-muted-foreground">
                    CONFIDENCE: {Math.round((sk.confidence || 0.8) * 100)}%
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-mono font-semibold text-foreground">
                    RULE DIRECTIVE:
                  </div>
                  <div className="p-3 bg-background/80 rounded border border-border font-mono text-xs text-foreground">
                    {sk.rule}
                  </div>
                </div>

                {sk.rationale && (
                  <div className="space-y-1">
                    <div className="font-mono text-[11px] text-muted-foreground font-semibold uppercase">
                      RATIONALE &amp; EVIDENCE:
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {sk.rationale}
                    </p>
                  </div>
                )}

                {sk.status === 'TENTATIVE' && (
                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                    <button
                      onClick={() => handleRejectSkill(sk.id)}
                      disabled={processingId === sk.id}
                      className="px-3.5 py-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 font-mono text-xs font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <XCircle size={13} />
                      <span>REJECT RULE</span>
                    </button>
                    <button
                      onClick={() => handleConfirmSkill(sk.id)}
                      disabled={processingId === sk.id}
                      className="px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-xs font-semibold rounded transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 size={13} />
                      <span>CONFIRM SKILL</span>
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
