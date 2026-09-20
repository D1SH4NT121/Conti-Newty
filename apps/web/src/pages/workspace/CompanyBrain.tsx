import React, { useEffect, useState, useCallback } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  api,
  WorkspaceFileEntry,
  WorkspaceSummary,
  SkillEntry,
  TribalMemoryEntry,
  TribalMemoryHistory,
  TaskResponse,
} from '../../lib/api-client';
import {
  Sparkles,
  BookOpen,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  Layers,
  Database,
  History,
  GitBranch,
  Clock,
  Eye,
  EyeOff,
  User,
  Tag
} from 'lucide-react';

function SeedButton({ workspaceId, onSeeded }: { workspaceId?: string; onSeeded: () => void }) {
  const [seeding, setSeeding] = useState(false);
  const [template, setTemplate] = useState('founder');

  const handleSeed = async () => {
    if (!workspaceId) return;
    setSeeding(true);
    try {
      await api.seedWorkspace(workspaceId, template);
      onSeeded();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="pt-2 space-y-2">
      <select
        value={template}
        onChange={(e) => setTemplate(e.target.value)}
        className="w-full px-2 py-1.5 bg-[#0c0b0a] border border-white/10 rounded text-white/60 font-mono text-[10px] focus:outline-none"
      >
        <option value="founder">Founder ICM — Company Brain starter</option>
        <option value="agency-client">Agency Client Workbench</option>
        <option value="operations-playbook">Operations Playbook</option>
        <option value="minimal">Minimal — Blank with harness only</option>
      </select>
      <button
        onClick={handleSeed}
        disabled={seeding}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-[#ff7597]/20 border border-[#ff7597]/40 text-[#ff7597] font-mono text-[10px] font-bold rounded hover:bg-[#ff7597]/30 transition-colors cursor-pointer disabled:opacity-50"
      >
        <Sparkles size={11} />
        {seeding ? 'SEEDING...' : 'SEED ICM TEMPLATE'}
      </button>
    </div>
  );
}

interface TreeDir {
  name: string;
  fullPath: string;
  children: TreeDir[];
  files: WorkspaceFileEntry[];
}

function buildTree(files: WorkspaceFileEntry[]): TreeDir {
  const root: TreeDir = { name: '', fullPath: '', children: [], files: [] };
  for (const f of files) {
    if (f.isDirectory) continue;
    const parts = f.path.replace(/^\//, '').split('/').filter(Boolean);
    const dirParts = parts.slice(0, -1);
    let node = root;
    let currentPath = '';
    for (const part of dirParts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, fullPath: currentPath, children: [], files: [] };
        node.children.push(child);
      }
      node = child;
    }
    node.files.push(f);
  }
  return root;
}

function getAllFiles(dir: TreeDir): WorkspaceFileEntry[] {
  return [...dir.files, ...dir.children.flatMap(getAllFiles)];
}

function TreeDirItem({
  dir,
  depth,
  selected,
  onSelect,
  searchLower,
}: {
  dir: TreeDir;
  depth: number;
  selected: string | null;
  onSelect: (path: string) => void;
  searchLower: string;
}) {
  const [open, setOpen] = useState(true);
  const indent = depth * 12;

  const matchesSearch = (d: TreeDir): boolean => {
    if (d.files.some((f) => f.name.toLowerCase().includes(searchLower) || f.path.toLowerCase().includes(searchLower))) return true;
    return d.children.some(matchesSearch);
  };

  if (searchLower && !matchesSearch(dir)) return null;

  const visibleFiles = searchLower
    ? dir.files.filter((f) => f.name.toLowerCase().includes(searchLower) || f.path.toLowerCase().includes(searchLower))
    : dir.files;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{ paddingLeft: `${indent + 8}px` }}
        className="w-full flex items-center gap-2 py-1 px-2 text-left hover:bg-card transition-colors"
      >
        <span className="font-mono text-xs text-muted-foreground">{open ? '▾' : '▸'}</span>
        <span className="font-mono text-xs text-foreground font-semibold">{dir.name}/</span>
      </button>
      {(open || !!searchLower) && (
        <>
          {visibleFiles.map((f) => {
            const isSelected = selected === f.path;
            return (
              <button
                key={f.path}
                onClick={() => onSelect(f.path)}
                style={{ paddingLeft: `${indent + 20}px` }}
                className={`w-full flex items-center gap-2 py-1 px-2 text-left transition-colors cursor-pointer ${
                  isSelected ? 'bg-foreground text-background font-semibold' : 'hover:bg-card text-foreground'
                }`}
              >
                <span className="font-mono text-xs text-muted-foreground">◧</span>
                <span className="font-mono text-xs truncate">{f.name}</span>
              </button>
            );
          })}
          {dir.children.map((child) => (
            <TreeDirItem key={child.fullPath} dir={child} depth={depth + 1} selected={selected} onSelect={onSelect} searchLower={searchLower} />
          ))}
        </>
      )}
    </div>
  );
}

export const CompanyBrain: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const [activeTab, setActiveTab] = useState<'documents' | 'skills' | 'tribal'>('documents');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'github' | 'slack' | 'jira' | 'drive'>('all');
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [sourceSearch, setSourceSearch] = useState('');
  const [files, setFiles] = useState<WorkspaceFileEntry[]>([]);
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [tribalEntries, setTribalEntries] = useState<TribalMemoryEntry[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<SkillEntry | null>(null);
  const [selectedTribal, setSelectedTribal] = useState<TribalMemoryEntry | null>(null);
  const [tribalHistory, setTribalHistory] = useState<TribalMemoryHistory | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [tribalLoading, setTribalLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [contentLoading, setContentLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatResult, setChatResult] = useState<TaskResponse | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const isDirty = fileContent !== initialContent;
  const lines = fileContent.split('\n');
  const searchLower = searchQuery.toLowerCase().trim();

  const runBrainChat = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!workspace?.id || !chatPrompt.trim() || chatLoading) return;
    setChatLoading(true);
    setChatError(null);
    try {
      const result = await api.createTask(workspace.id, chatPrompt.trim(), undefined, [
        { role: 'Researcher', provider: 'gemini' },
        { role: 'Critic', provider: 'gemini' },
        { role: 'Synthesizer', provider: 'gemini' },
      ]);
      setChatResult(result);
    } catch (err: any) {
      setChatError(err.message || 'The Company Brain could not answer');
    } finally {
      setChatLoading(false);
    }
  };

  const loadSkills = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      setSkillsLoading(true);
      const data = await api.listSkills(workspace.id, 'CONFIRMED');
      setSkills(data);
      if (data.length > 0 && !selectedSkill) {
        setSelectedSkill(data[0]);
      }
    } catch {
      // Ignore
    } finally {
      setSkillsLoading(false);
    }
  }, [workspace?.id]);

  const loadTribal = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      setTribalLoading(true);
      const data = await api.listTribalEntries(workspace.id, {
        includeSuperseded: showSuperseded,
      });
      setTribalEntries(data.entries);
      if (data.entries.length > 0 && !selectedTribal) {
        setSelectedTribal(data.entries[0]);
      }
    } catch {
      // Ignore
    } finally {
      setTribalLoading(false);
    }
  }, [workspace?.id, showSuperseded]);

  const loadFiles = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      setLoading(true);
      const data = await api.listFiles(workspace.id, '', true);
      setFiles(data);
      if (!selectedPath && data.length > 0) {
        const firstFile = data.find((f) => !f.isDirectory);
        if (firstFile) loadFileContent(firstFile.path);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to list filesystem' });
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    if (workspace?.id) {
      loadFiles();
      loadSkills();
      loadTribal();
    }
  }, [workspace?.id, loadTribal]);

  const loadFileContent = async (filePath: string) => {
    if (!workspace?.id) return;
    try {
      setContentLoading(true);
      setSelectedPath(filePath);
      const res = await api.getRawFile(workspace.id, filePath);
      setFileContent(res.content);
      setInitialContent(res.content);
      setMessage(null);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to load file content' });
    } finally {
      setContentLoading(false);
    }
  };

  const loadHistory = async (entryId: string) => {
    if (!workspace?.id) return;
    try {
      const hist = await api.getTribalMemoryHistory(workspace.id, entryId);
      setTribalHistory(hist);
      setShowHistoryModal(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load version history');
    }
  };

  const handleSave = async () => {
    if (!selectedPath) return;
    try {
      setSaving(true);
      await api.saveFile(workspace.id, selectedPath, fileContent);
      setInitialContent(fileContent);
      setMessage({ type: 'success', text: `Saved ${selectedPath}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPath) return;
    if (!window.confirm(`Delete ${selectedPath}?`)) return;
    try {
      await api.deleteFile(workspace.id, selectedPath);
      setSelectedPath(null);
      setFileContent('');
      setInitialContent('');
      setMessage({ type: 'success', text: 'Deleted file.' });
      loadFiles();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to delete file' });
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFilePath.trim()) return;
    try {
      await api.saveFile(workspace.id, newFilePath.trim(), '# ' + newFilePath.split('/').pop() + '\n\nInitial institutional memory.\n');
      setShowNewFileModal(false);
      const created = newFilePath.trim();
      setNewFilePath('');
      await loadFiles();
      loadFileContent(created);
    } catch (err: any) {
      alert(err.message || 'Failed to create file');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty) handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, selectedPath, fileContent]);

  const documentFiles = files.filter((f) => !f.isDirectory);
  const getFileSource = (file: WorkspaceFileEntry): 'github' | 'slack' | 'jira' | 'drive' => {
    const path = file.path.toLowerCase();
    if (path.includes('slack')) return 'slack';
    if (path.includes('jira')) return 'jira';
    if (path.includes('github') || path.includes('source_manifest') || path.includes('company_brain/docs/')) return 'github';
    return 'drive';
  };
  const sourceFiles = sourceFilter === 'all'
    ? documentFiles
    : documentFiles.filter((file) => getFileSource(file) === sourceFilter);
  const filteredDocumentFiles = documentFiles;
  const filteredTree = buildTree(filteredDocumentFiles);
  const sourceTree = buildTree(sourceFiles);
  const sourceSearchLower = sourceSearch.toLowerCase().trim();
  const selectedSourceLabel = sourceFilter === 'all' ? 'Company Brain' : `${sourceFilter[0].toUpperCase()}${sourceFilter.slice(1)}`;
  const memorySources = [
    { key: 'github' as const, label: 'GitHub', color: 'text-sky-400', count: documentFiles.filter((f) => getFileSource(f) === 'github').length },
    { key: 'slack' as const, label: 'Slack', color: 'text-pink-400', count: documentFiles.filter((f) => getFileSource(f) === 'slack').length },
    { key: 'jira' as const, label: 'Jira', color: 'text-blue-400', count: documentFiles.filter((f) => getFileSource(f) === 'jira').length },
    { key: 'drive' as const, label: 'Drive', color: 'text-emerald-400', count: documentFiles.filter((f) => getFileSource(f) === 'drive').length },
    { label: 'Tribal', color: 'text-amber-400', count: tribalEntries.length },
  ];
  const memoryCategories = [
    { label: 'Projects', hint: 'workstreams and launches' },
    { label: 'Decisions', hint: 'why the team chose' },
    { label: 'People', hint: 'owners and contributors' },
    { label: 'Playbooks', hint: 'repeatable ways of working' },
    { label: 'Risks', hint: 'open blockers and unknowns' },
  ];
  const flatFiltered: WorkspaceFileEntry[] = searchLower
    ? filteredDocumentFiles.filter((f) => f.name.toLowerCase().includes(searchLower) || f.path.toLowerCase().includes(searchLower))
    : [];

  return (
    <div className="flex h-[calc(100vh-56px)] bg-background overflow-hidden">
      {sourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setSourceModalOpen(false)}>
          <div
            className="w-full max-w-2xl max-h-[80vh] flex flex-col border border-border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 p-4 border-b border-border">
              <div>
                <div className="font-mono text-xs uppercase tracking-wider text-primary">{selectedSourceLabel} files</div>
                <div className="font-mono text-[10px] text-muted-foreground">{sourceFiles.length} documents connected to this source</div>
              </div>
              <button
                onClick={() => setSourceModalOpen(false)}
                className="px-2 py-1 font-mono text-xs border border-border text-muted-foreground hover:text-foreground"
              >
                CLOSE
              </button>
            </div>
            <div className="p-3 border-b border-border">
              <input
                autoFocus
                value={sourceSearch}
                onChange={(event) => setSourceSearch(event.target.value)}
                placeholder={`Search ${selectedSourceLabel} files...`}
                className="w-full px-3 py-2 bg-card border border-border text-foreground text-xs font-mono focus:outline-none focus:border-foreground"
              />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto py-2">
              {sourceFiles.length === 0 ? (
                <div className="p-8 text-center font-mono text-xs text-muted-foreground">
                  No {selectedSourceLabel} files are connected yet.
                </div>
              ) : (
                <TreeDirItem
                  dir={sourceTree}
                  depth={0}
                  selected={selectedPath}
                  onSelect={(path) => {
                    setSourceModalOpen(false);
                    setSourceSearch('');
                    loadFileContent(path);
                  }}
                  searchLower={sourceSearchLower}
                />
              )}
            </div>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-background overflow-y-auto shrink-0 flex flex-col">
        <div className="p-4 border-b border-border bg-card/30 space-y-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary font-bold">MEMORY STORE</div>
            <h2 className="font-serif text-xl text-foreground mt-1">Your company, remembered.</h2>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
              Signals from the tools your team already uses, connected by project, person, decision, and time.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {memorySources.map((source) => (
              <button
                key={source.label}
                onClick={() => {
                  if ('key' in source) {
                    setSourceFilter(source.key);
                    setSourceModalOpen(true);
                  } else {
                    setActiveTab('tribal');
                    setSourceFilter('all');
                    loadTribal();
                  }
                }}
                className={`flex items-center justify-between px-2 py-1.5 border bg-background/70 transition-colors ${
                  ('key' in source && sourceFilter === source.key) || (source.label === 'Tribal' && activeTab === 'tribal')
                    ? 'border-foreground bg-card'
                    : 'border-border hover:border-foreground/60'
                }`}
              >
                <span className={`font-mono text-[10px] ${source.color}`}>{source.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{source.count}</span>
              </button>
            ))}
          </div>
          <div className="space-y-1">
            <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Navigate memory</div>
            {memoryCategories.map((category) => (
              <button
                key={category.label}
                onClick={() => { setActiveTab(category.label === 'Decisions' ? 'tribal' : 'documents'); setSearchQuery(category.label === 'Playbooks' ? 'sop' : ''); }}
                className="w-full flex items-center justify-between text-left px-2 py-1.5 hover:bg-card transition-colors"
              >
                <span className="font-mono text-[10px] text-foreground">{category.label}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{category.hint}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Surface Switcher */}
        <div className="flex border-b border-border text-xs font-mono shrink-0">
          <button
            onClick={() => { setActiveTab('documents'); setSourceFilter('all'); }}
            className={`flex-1 py-2 text-center border-b-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-foreground text-foreground font-bold bg-card/40'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            DOCS ({filteredDocumentFiles.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('tribal');
              loadTribal();
            }}
            className={`flex-1 py-2 text-center border-b-2 transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'tribal'
                ? 'border-foreground text-foreground font-bold bg-card/40'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Database size={11} />
            TRIBAL ({tribalEntries.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('skills');
              loadSkills();
            }}
            className={`flex-1 py-2 text-center border-b-2 transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'skills'
                ? 'border-foreground text-foreground font-bold bg-card/40'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BookOpen size={11} />
            SKILLS ({skills.length})
          </button>
        </div>

        <div className="p-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-mono text-xs text-muted-foreground uppercase">
                {activeTab === 'documents'
                  ? 'COMPANY BRAIN'
                  : activeTab === 'tribal' ? 'TRIBAL MEMORY' : 'LEARNED SKILLS'}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {activeTab === 'documents'
                  ? `${filteredDocumentFiles.length} documents`
                  : activeTab === 'tribal'
                  ? `${tribalEntries.length} entries`
                  : `${skills.length} verified rules`}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeTab === 'documents' && (
                <>
                  <button
                    onClick={() => setShowNewFileModal(true)}
                    className="font-mono text-xs px-2 py-1 border border-border bg-card text-foreground hover:border-foreground transition-colors"
                  >
                    + FILE
                  </button>
                  <button
                    onClick={loadFiles}
                    className="font-mono text-xs px-2 py-1 border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ↻
                  </button>
                </>
              )}

              {activeTab === 'tribal' && (
                <>
                  <button
                    onClick={() => setShowSuperseded(!showSuperseded)}
                    className={`font-mono text-[10px] px-2 py-1 border rounded flex items-center gap-1 transition-colors ${
                      showSuperseded
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        : 'border-border bg-card text-zinc-400 hover:text-white'
                    }`}
                    title="Toggle historical / superseded entries"
                  >
                    {showSuperseded ? <Eye size={10} /> : <EyeOff size={10} />}
                    {showSuperseded ? 'ALL' : 'ACTIVE'}
                  </button>
                  <Link
                    to={`/w/${workspace?.id}/corrections`}
                    className="font-mono text-[10px] px-2 py-1 border border-border bg-card text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1 rounded"
                    title="Open Synthesis Queue"
                  >
                    QUEUE <ArrowRight size={10} />
                  </Link>
                </>
              )}

              {activeTab === 'skills' && (
                <Link
                  to={`/w/${workspace?.id}/corrections`}
                  className="font-mono text-[10px] px-2 py-1 border border-border bg-card text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 rounded"
                  title="Open Corrections Queue"
                >
                  QUEUE <ArrowRight size={10} />
                </Link>
              )}
            </div>
          </div>
            <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === 'documents' ? "Search docs..." : activeTab === 'tribal' ? "Search tribal memory..." : "Search skills..."}
            className="w-full px-2 py-1.5 bg-card border border-border text-foreground text-xs font-mono focus:outline-none focus:border-foreground transition-colors placeholder-muted-foreground"
            />
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {activeTab === 'tribal' ? (
            tribalLoading ? (
              <div className="px-4 py-6 font-mono text-xs text-muted-foreground text-center">Loading tribal memory...</div>
            ) : tribalEntries.length === 0 ? (
              <div className="p-4 text-center space-y-3">
                <Database className="w-8 h-8 text-zinc-600 mx-auto" />
                <div className="font-mono text-xs text-muted-foreground">NO TRIBAL MEMORY ENTRIES</div>
                <p className="text-[11px] text-muted-foreground">
                  Ingested connector signals (Slack, Drive, Jira) and manual notes synthesize into confirmed tribal memory.
                </p>
                <Link
                  to={`/w/${workspace?.id}/corrections`}
                  className="inline-block font-mono text-[10px] px-3 py-1.5 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors rounded"
                >
                  Open Synthesis Queue →
                </Link>
              </div>
            ) : (
              <div className="space-y-1 px-2">
                {tribalEntries
                  .filter((t) => !searchLower || t.title.toLowerCase().includes(searchLower) || t.content.toLowerCase().includes(searchLower))
                  .map((entry) => {
                    const isSelected = selectedTribal?.id === entry.id;
                    const isSuperseded = entry.status === 'SUPERSEDED';

                    return (
                      <button
                        key={entry.id}
                        onClick={() => setSelectedTribal(entry)}
                        className={`w-full text-left p-2.5 rounded transition-all border cursor-pointer ${
                          isSelected
                            ? 'bg-foreground text-background border-foreground shadow-sm'
                            : isSuperseded
                            ? 'bg-amber-950/10 border-amber-900/30 text-zinc-400 opacity-70 hover:opacity-100'
                            : 'bg-card/40 border-border hover:border-foreground/40 text-foreground'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            className={`font-mono text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded border ${
                              isSuperseded
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : entry.source === 'auto_distilled'
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                                : 'bg-white/10 text-zinc-300 border-white/20'
                            }`}
                          >
                            {isSuperseded ? 'SUPERSEDED' : entry.source === 'auto_distilled' ? 'AUTO-CAPTURED' : 'MANUAL'}
                          </span>
                          <span className="font-mono text-[9px] text-muted-foreground">
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-xs font-semibold line-clamp-2 leading-tight">
                          {entry.title}
                        </div>
                      </button>
                    );
                  })}
              </div>
            )
          ) : activeTab === 'skills' ? (
            skillsLoading ? (
              <div className="px-4 py-6 font-mono text-xs text-muted-foreground text-center">Loading company skills...</div>
            ) : skills.length === 0 ? (
              <div className="p-4 text-center space-y-3">
                <BookOpen className="w-8 h-8 text-zinc-600 mx-auto" />
                <div className="font-mono text-xs text-muted-foreground">NO CONFIRMED SKILLS</div>
                <p className="text-[11px] text-muted-foreground">
                  Redirects from live multiplayer sessions are distilled into verified procedural skills.
                </p>
                <Link
                  to={`/w/${workspace?.id}/live`}
                  className="inline-block font-mono text-[10px] px-3 py-1.5 border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-colors rounded"
                >
                  Start Live Session →
                </Link>
              </div>
            ) : (
              <div className="space-y-1 px-2">
                {skills
                  .filter((s) => !searchLower || s.rule.toLowerCase().includes(searchLower) || s.triggerPattern.toLowerCase().includes(searchLower))
                  .map((sk) => {
                    const isSelected = selectedSkill?.id === sk.id;
                    return (
                      <button
                        key={sk.id}
                        onClick={() => setSelectedSkill(sk)}
                        className={`w-full text-left p-2.5 rounded transition-all border ${
                          isSelected
                            ? 'bg-foreground text-background border-foreground shadow-sm'
                            : 'bg-card/40 border-border hover:border-foreground/40 text-foreground'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className={`font-mono text-[9px] uppercase font-bold tracking-wider ${
                            isSelected ? 'text-background/80' : 'text-purple-400'
                          }`}>
                            {sk.stableId || 'RULE'}
                          </span>
                          <span className={`font-mono text-[9px] ${
                            isSelected ? 'text-background/70' : 'text-muted-foreground'
                          }`}>
                            {Math.round((sk.confidence || 0.8) * 100)}%
                          </span>
                        </div>
                        <div className="text-xs font-semibold line-clamp-2 leading-tight">
                          {sk.rule}
                        </div>
                      </button>
                    );
                  })}
              </div>
            )
          ) : loading ? (
            <div className="px-4 py-6 font-mono text-xs text-muted-foreground text-center">Traversing filesystem...</div>
          ) : searchLower ? (
            flatFiltered.length === 0 ? (
              <div className="px-4 py-3 font-mono text-xs text-muted-foreground">No results for &quot;{searchQuery}&quot;</div>
            ) : (
              flatFiltered.map((f) => (
                <button
                  key={f.path}
                  onClick={() => { setSelectedPath(f.path); loadFileContent(f.path); setSearchQuery(''); }}
                  className={`w-full flex items-center gap-2 py-1 px-4 text-left transition-colors ${selectedPath === f.path ? 'bg-foreground text-background' : 'hover:bg-card text-foreground'}`}
                >
                  <span className="font-mono text-xs text-muted-foreground">◧</span>
                  <span className="font-mono text-xs truncate">{f.name}</span>
                </button>
              ))
            )
          ) : files.length === 0 ? (
            <div className="px-3 py-4 space-y-3">
              <div className="font-mono text-[10px] text-white/40 uppercase font-bold tracking-wider">ICM STRUCTURE</div>
              {[
                { folder: 'docs/', desc: 'Policies, contracts, references' },
                { folder: 'sops/', desc: 'Standard operating procedures' },
                { folder: 'notes/', desc: 'Meeting notes, decisions' },
                { folder: 'prompts/', desc: 'AI query harness & templates' },
              ].map(f => (
                <div key={f.folder} className="flex items-center gap-2 px-2 py-1.5 rounded border border-white/5 bg-white/3">
                  <span className="font-mono text-xs text-white/30">📁</span>
                  <span className="font-mono text-xs text-white/50 font-semibold">{f.folder}</span>
                  <span className="font-mono text-[10px] text-white/25 truncate">{f.desc}</span>
                </div>
              ))}
              <SeedButton workspaceId={workspace?.id} onSeeded={loadFiles} />
            </div>
          ) : (
            <div>
              {filteredTree.children.map((child) => (
                <TreeDirItem key={child.fullPath} dir={child} depth={0} selected={selectedPath} onSelect={(p) => { setSelectedPath(p); loadFileContent(p); }} searchLower={searchLower} />
              ))}
              {filteredTree.files.map((f) => (
                <button
                  key={f.path}
                  onClick={() => { setSelectedPath(f.path); loadFileContent(f.path); }}
                  className={`w-full flex items-center gap-2 py-1 px-4 text-left transition-colors cursor-pointer ${
                    selectedPath === f.path ? 'bg-foreground text-background font-semibold' : 'hover:bg-card text-foreground'
                  }`}
                >
                  <span className="font-mono text-xs text-muted-foreground">◧</span>
                  <span className="font-mono text-xs truncate">{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Panel */}
      {activeTab === 'tribal' ? (
        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-[#07090e] p-8">
          {selectedTribal ? (
            <div className="max-w-4xl mx-auto w-full space-y-6">
              {/* Header Box */}
              <div className="bg-[#0f131c] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] px-3 py-1 rounded-full font-mono uppercase font-bold tracking-wider border ${
                        selectedTribal.status === 'SUPERSEDED'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : selectedTribal.source === 'auto_distilled'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      {selectedTribal.status}
                    </span>

                    <span className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
                      <User size={12} />
                      {selectedTribal.authorName || 'System'}
                    </span>

                    <span className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
                      <Clock size={12} />
                      {new Date(selectedTribal.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={() => loadHistory(selectedTribal.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  >
                    <GitBranch size={13} className="text-cyan-400" />
                    Version Lineage
                  </button>
                </div>

                <h2 className="text-2xl font-bold text-white tracking-tight">{selectedTribal.title}</h2>

                {selectedTribal.supersedesId && (
                  <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-300 font-mono">
                    <History size={14} />
                    <span>Supersedes prior entry ID: <code className="text-amber-200">{selectedTribal.supersedesId.slice(0, 8)}</code></span>
                  </div>
                )}
              </div>

              {/* Content Body */}
              <div className="bg-[#0f131c] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
                <div className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-wider">
                  KNOWLEDGE CONTENT
                </div>
                <div className="text-sm text-zinc-200 leading-relaxed font-mono whitespace-pre-wrap bg-[#080a10] p-4 rounded-xl border border-white/5">
                  {selectedTribal.content}
                </div>
              </div>

              {/* Tags */}
              {selectedTribal.tags && selectedTribal.tags.length > 0 && (
                <div className="flex items-center gap-2">
                  <Tag size={13} className="text-zinc-500" />
                  {selectedTribal.tags.map((t, idx) => (
                    <span key={idx} className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400">
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="m-auto text-center p-8 text-zinc-500 font-mono text-xs">
              Select a tribal memory entry from the sidebar to view its contents and version history.
            </div>
          )}
        </div>
      ) : activeTab === 'skills' ? (
        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto bg-[#07090e] p-8">
          {selectedSkill ? (
            <div className="max-w-4xl mx-auto w-full space-y-6">
              {/* Header Box */}
              <div className="bg-[#0f131c] border border-white/10 rounded-2xl p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono uppercase font-bold tracking-wider">
                    {selectedSkill.status}
                  </span>
                  <div className="text-xs text-zinc-500 font-mono">
                    Confidence: {Math.round((selectedSkill.confidence || 0.8) * 100)}%
                  </div>
                </div>

                <h2 className="text-xl font-bold text-white tracking-tight">{selectedSkill.rule}</h2>

                {selectedSkill.originSessionId && (
                  <div className="pt-2 border-t border-white/5">
                    <Link
                      to={`/w/${workspace?.id}/sessions/${selectedSkill.originSessionId}`}
                      className="text-xs text-purple-400 hover:underline inline-flex items-center gap-1.5 font-mono"
                    >
                      Jump to Source Multiplayer Session <ExternalLink size={12} />
                    </Link>
                  </div>
                )}
              </div>

              {/* Two Column Context */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0f131c] border border-white/10 rounded-2xl p-5 space-y-2">
                  <div className="font-mono text-[10px] uppercase text-zinc-500 font-bold tracking-wider">
                    TRIGGER CONDITION
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{selectedSkill.triggerPattern}</p>
                </div>

                <div className="bg-[#0f131c] border border-white/10 rounded-2xl p-5 space-y-2">
                  <div className="font-mono text-[10px] uppercase text-zinc-500 font-bold tracking-wider">
                    RATIONALE & JUSTIFICATION
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{selectedSkill.rationale}</p>
                </div>
              </div>

              {/* Example Snippet */}
              {selectedSkill.exampleSnippet && (
                <div className="bg-[#0f131c] border border-white/10 rounded-2xl p-5 space-y-2 font-mono">
                  <div className="text-[10px] uppercase text-zinc-500 font-bold tracking-wider">
                    VERIFICATION CODE / SPECIFICATION
                  </div>
                  <pre className="p-3 rounded-lg bg-[#080a10] border border-white/5 text-xs text-purple-300 overflow-x-auto whitespace-pre-wrap">
                    {selectedSkill.exampleSnippet}
                  </pre>
                </div>
              )}

              {/* Runtime Injection Notice */}
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs text-zinc-300 leading-relaxed">
                  <span className="font-semibold text-white">Active in Agent Runtime: </span>
                  This confirmed skill is automatically retrieved and injected into live agent session prompts whenever relevant workspace tasks match its trigger condition.
                </div>
              </div>
            </div>
          ) : (
            <div className="m-auto text-center p-8 text-zinc-500 font-mono text-xs">
              Select a learned skill from the sidebar to view its procedural specification.
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Topbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background shrink-0 gap-3">
            <div className="min-w-0 flex-1 flex items-center gap-3">
              <span className="font-mono text-xs text-foreground font-semibold truncate">
                {selectedPath ? `/company_brain/${selectedPath}` : 'Select a document'}
              </span>
              {isDirty && (
                <span className="font-mono text-xs px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200">UNSAVED</span>
              )}
              {message && (
                <span className={`font-mono text-xs truncate ${message.type === 'success' ? 'text-accent' : 'text-destructive'}`}>
                  {message.text}
                </span>
              )}
            </div>

            {selectedPath && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="font-mono text-xs px-3 py-1.5 bg-foreground text-background hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {saving ? 'SAVING...' : 'SAVE (⌘S)'}
                </button>
                <button
                  onClick={handleDelete}
                  className="font-mono text-xs px-3 py-1.5 border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors cursor-pointer"
                >
                  DELETE
                </button>
              </div>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 flex overflow-hidden bg-card">
            {contentLoading ? (
              <div className="m-auto font-mono text-xs text-muted-foreground">Reading from living storage...</div>
            ) : selectedPath ? (
              <div className="flex flex-1 overflow-hidden">
                <div className="w-12 py-4 text-right font-mono text-xs text-muted-foreground select-none bg-muted/30 border-r border-border overflow-hidden leading-5">
                  {lines.map((_, i) => (
                    <div key={i} className="pr-2 h-5 flex items-center justify-end">{i + 1}</div>
                  ))}
                </div>
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  spellCheck={false}
                  className="flex-1 p-4 font-mono text-xs leading-5 text-foreground bg-card border-none outline-none resize-none overflow-auto whitespace-pre"
                />
              </div>
            ) : (
              <div className="m-auto text-center p-8">
                <div className="font-mono text-xs text-muted-foreground mb-2">NO DOCUMENT OPEN</div>
                <p className="text-sm text-muted-foreground">Select a file from the Company Brain or create a new one.</p>
                <button onClick={() => setShowNewFileModal(true)} className="mt-4 font-mono text-xs px-4 py-2 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer">
                  + CREATE DOCUMENT
                </button>
              </div>
            )}
          </div>

          {/* Status bar */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-background font-mono text-xs text-muted-foreground">
            <span>Living Storage: <span className="text-foreground">data/workspaces/{workspace?.id}</span></span>
            <span>{selectedPath ? `${lines.length} lines · ${fileContent.length} chars` : 'Ready'}</span>
          </div>

          <div className="border-t border-primary/20 bg-background shrink-0">
            <div className="flex items-center justify-between px-4 py-2">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">CHAT WITH COMPANY MEMORY</div>
                <div className="font-mono text-[9px] text-muted-foreground">Researcher → Critic → Synthesizer</div>
              </div>
              {chatLoading && <span className="font-mono text-[10px] text-amber-400 animate-pulse">REASONING...</span>}
            </div>
            {chatResult && (
              <div className="mx-4 mb-2 max-h-32 overflow-y-auto rounded-lg border border-border bg-card px-3 py-2 text-xs leading-relaxed text-foreground">
                <div className="mb-1 font-mono text-[9px] uppercase tracking-widest text-emerald-400">GROUNDED ANSWER</div>
                <div className="whitespace-pre-wrap">{chatResult.answer}</div>
                {chatResult.citations?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {chatResult.citations.map((citation: any, index: number) => (
                      <span key={`${citation.path || citation.source || index}-${index}`} className="rounded border border-primary/30 px-1.5 py-0.5 font-mono text-[9px] text-primary">
                        {citation.path || citation.source || `Source ${index + 1}`}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {chatError && <div className="mx-4 mb-2 font-mono text-[10px] text-destructive">{chatError}</div>}
            <form onSubmit={runBrainChat} className="flex items-end gap-2 px-4 pb-3">
              <textarea
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                placeholder="Ask about this company..."
                rows={2}
                className="min-h-10 flex-1 resize-none rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatPrompt.trim()}
                className="rounded-lg bg-foreground px-3 py-2 font-mono text-[10px] text-background hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
              >
                ASK →
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Lineage Modal */}
      {showHistoryModal && tribalHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-[#0f131c] border border-white/10 rounded-2xl shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Version Lineage & Supersede Chain</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-zinc-400 hover:text-white font-mono text-xs px-2 py-1 rounded bg-white/5"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {/* Ancestors */}
              {tribalHistory.ancestors.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-mono text-zinc-500 font-bold">Prior Ancestor Versions (Superseded)</div>
                  {tribalHistory.ancestors.map((anc) => (
                    <div key={anc.id} className="p-3 rounded-xl bg-white/3 border border-amber-500/20 text-xs text-zinc-400 font-mono space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-amber-400 font-semibold">{anc.title}</span>
                        <span className="text-[10px] text-zinc-500">{new Date(anc.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="line-clamp-2 text-zinc-400">{anc.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Current Version */}
              <div className="space-y-2">
                <div className="text-[10px] uppercase font-mono text-cyan-400 font-bold">Selected Version</div>
                <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/40 text-xs font-mono space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-sm">{tribalHistory.current.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/30 text-cyan-300 font-bold">
                      {tribalHistory.current.status}
                    </span>
                  </div>
                  <p className="text-zinc-300">{tribalHistory.current.content}</p>
                </div>
              </div>

              {/* Descendants */}
              {tribalHistory.descendants.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-mono text-emerald-500 font-bold">Newer Superseding Versions</div>
                  {tribalHistory.descendants.map((desc) => (
                    <div key={desc.id} className="p-3 rounded-xl bg-white/3 border border-emerald-500/30 text-xs text-zinc-300 font-mono space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-400 font-semibold">{desc.title}</span>
                        <span className="text-[10px] text-zinc-500">{new Date(desc.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="line-clamp-2 text-zinc-400">{desc.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-foreground/20">
          <div className="w-full max-w-md bg-background border border-border shadow-xl p-6">
            <div className="font-mono text-xs text-muted-foreground mb-1">COMPANY BRAIN</div>
            <h3 className="font-serif text-xl font-light text-foreground mb-1">Create document</h3>
            <p className="text-xs text-muted-foreground mb-4">Relative path within living filesystem, e.g. <span className="font-mono text-foreground">sops/deployment-guide.md</span></p>
            <form onSubmit={handleCreateFile} className="space-y-4">
              <input
                type="text"
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
                placeholder="sops/deployment-guide.md"
                autoFocus
                className="w-full px-3 py-2.5 bg-background border border-border text-foreground text-sm focus:outline-none focus:border-foreground transition-colors placeholder-muted-foreground"
              />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowNewFileModal(false)} className="font-mono text-xs px-4 py-2 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors cursor-pointer">
                  CANCEL
                </button>
                <button type="submit" className="font-mono text-xs px-4 py-2 bg-foreground text-background hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer">
                  CREATE →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
