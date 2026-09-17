import React, { useEffect, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, WorkspaceFileEntry, WorkspaceSummary } from '../../lib/api-client';

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
  const [open, setOpen] = useState(depth === 0);
  const indent = depth * 14;

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
                style={{ paddingLeft: `${indent + 22}px` }}
                className={`w-full flex items-center gap-2 py-1 px-2 text-left transition-colors ${isSelected ? 'bg-foreground text-background' : 'hover:bg-card text-foreground'}`}
              >
                <span className={`font-mono text-xs ${isSelected ? 'text-background/60' : 'text-muted-foreground'}`}>◧</span>
                <span className={`font-mono text-xs truncate ${isSelected ? 'text-background' : 'text-foreground'}`}>{f.name}</span>
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
  const [files, setFiles] = useState<WorkspaceFileEntry[]>([]);
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

  const isDirty = fileContent !== initialContent;
  const lines = fileContent.split('\n');
  const searchLower = searchQuery.toLowerCase().trim();

  const loadFiles = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      setLoading(true);
      const data = await api.listFiles(workspace.id, '');
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
    if (workspace?.id) loadFiles();
  }, [workspace?.id]);

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

  const tree = buildTree(files);
  const rootFiles = tree.files;
  const topDirs = tree.children;

  const flatFiltered: WorkspaceFileEntry[] = searchLower
    ? files.filter((f) => !f.isDirectory && (f.name.toLowerCase().includes(searchLower) || f.path.toLowerCase().includes(searchLower)))
    : [];

  return (
    <div className="flex h-[calc(100vh-56px)] bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-72 border-r border-border bg-background overflow-y-auto shrink-0 flex flex-col">
        <div className="p-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-mono text-xs text-muted-foreground">COMPANY BRAIN</div>
              <div className="font-mono text-xs text-muted-foreground">{files.filter((f) => !f.isDirectory).length} documents</div>
            </div>
            <div className="flex gap-1">
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
            </div>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full px-2 py-1.5 bg-card border border-border text-foreground text-xs font-mono focus:outline-none focus:border-foreground transition-colors placeholder-muted-foreground"
          />
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {loading ? (
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
            <div className="px-4 py-3 font-mono text-xs text-muted-foreground">No documents yet.</div>
          ) : (
            <>
              {rootFiles.map((f) => {
                const isSelected = selectedPath === f.path;
                return (
                  <button
                    key={f.path}
                    onClick={() => loadFileContent(f.path)}
                    className={`w-full flex items-center gap-2 py-1 px-4 text-left transition-colors ${isSelected ? 'bg-foreground text-background' : 'hover:bg-card text-foreground'}`}
                  >
                    <span className={`font-mono text-xs ${isSelected ? 'text-background/60' : 'text-muted-foreground'}`}>◧</span>
                    <span className={`font-mono text-xs truncate ${isSelected ? 'text-background' : 'text-foreground'}`}>{f.name}</span>
                  </button>
                );
              })}
              {topDirs.map((dir) => (
                <TreeDirItem key={dir.fullPath} dir={dir} depth={0} selected={selectedPath} onSelect={loadFileContent} searchLower="" />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main */}
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
                className="font-mono text-xs px-3 py-1.5 bg-foreground text-background hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-40"
              >
                {saving ? 'SAVING...' : 'SAVE (⌘S)'}
              </button>
              <button
                onClick={handleDelete}
                className="font-mono text-xs px-3 py-1.5 border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors"
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
              <button onClick={() => setShowNewFileModal(true)} className="mt-4 font-mono text-xs px-4 py-2 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
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
      </div>

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
                <button type="button" onClick={() => setShowNewFileModal(false)} className="font-mono text-xs px-4 py-2 border border-border text-muted-foreground hover:border-foreground hover:text-foreground transition-colors">
                  CANCEL
                </button>
                <button type="submit" className="font-mono text-xs px-4 py-2 bg-foreground text-background hover:bg-primary hover:text-primary-foreground transition-colors">
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
