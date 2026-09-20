/**
 * TribalMemory Component
 *
 * Captures and manages organizational knowledge:
 *   - Create entries (decisions, best practices, lessons learned)
 *   - Search by text and tags
 *   - Edit and delete entries
 *   - Export to Brain for agent access
 *
 * Usage:
 *   <TribalMemory workspaceId={workspace.id} />
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api-client';

export interface TribalMemoryEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  authorId: string;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  workspaceId: string;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

type View = 'list' | 'create' | 'edit' | 'view';

export const TribalMemory: React.FC<Props> = ({ workspaceId, onError, onSuccess }) => {
  const [view, setView] = useState<View>('list');
  const [entries, setEntries] = useState<TribalMemoryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<TribalMemoryEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Load entries on mount
  useEffect(() => {
    loadEntries();
  }, [workspaceId]);

  const loadEntries = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.listTribalMemoryEntries(workspaceId);
      setEntries(result.entries);
    } catch (e: any) {
      onError?.(`Failed to load entries: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, onError]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!title.trim()) {
        onError?.('Title is required');
        return;
      }
      if (!content.trim()) {
        onError?.('Content is required');
        return;
      }

      try {
        setLoading(true);
        const tags = tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t);

        const entry = await api.createTribalMemoryEntry(workspaceId, {
          title: title.trim(),
          content: content.trim(),
          tags,
        });

        setTitle('');
        setContent('');
        setTagsInput('');
        setView('list');
        await loadEntries();
        onSuccess?.('Entry created');
      } catch (e: any) {
        onError?.(`Failed to create entry: ${e.message}`);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, title, content, tagsInput, onError, onSuccess, loadEntries]
  );

  const handleUpdate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!selectedEntry) return;

      if (!title.trim()) {
        onError?.('Title is required');
        return;
      }
      if (!content.trim()) {
        onError?.('Content is required');
        return;
      }

      try {
        setLoading(true);
        const tags = tagsInput
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t);

        await api.updateTribalMemoryEntry(workspaceId, selectedEntry.id, {
          title: title.trim(),
          content: content.trim(),
          tags,
        });

        setTitle('');
        setContent('');
        setTagsInput('');
        setSelectedEntry(null);
        setView('list');
        await loadEntries();
        onSuccess?.('Entry updated');
      } catch (e: any) {
        onError?.(`Failed to update entry: ${e.message}`);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, selectedEntry, title, content, tagsInput, onError, onSuccess, loadEntries]
  );

  const handleDelete = useCallback(
    async (entryId: string) => {
      if (!window.confirm('Delete this entry?')) return;

      try {
        setLoading(true);
        await api.deleteTribalMemoryEntry(workspaceId, entryId);
        await loadEntries();
        onSuccess?.('Entry deleted');
      } catch (e: any) {
        onError?.(`Failed to delete entry: ${e.message}`);
      } finally {
        setLoading(false);
      }
    },
    [workspaceId, onError, onSuccess, loadEntries]
  );

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!searchQuery.trim()) {
        await loadEntries();
        return;
      }

      try {
        setSearching(true);
        const result = await api.searchTribalMemoryEntries(workspaceId, { query: searchQuery });
        setEntries(result.entries);
      } catch (e: any) {
        onError?.(`Search failed: ${e.message}`);
      } finally {
        setSearching(false);
      }
    },
    [workspaceId, searchQuery, onError, loadEntries]
  );

  const handleExport = useCallback(async () => {
    try {
      setExporting(true);
      const result = await api.exportTribalMemoryToBrain(workspaceId);
      onSuccess?.(`Exported ${result.entriesExported} entries to Brain`);
    } catch (e: any) {
      onError?.(`Export failed: ${e.message}`);
    } finally {
      setExporting(false);
    }
  }, [workspaceId, onError, onSuccess]);

  // ── Render: List ──────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs uppercase text-white/40">Tribal Memory</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setTitle('');
                setContent('');
                setTagsInput('');
                setSelectedEntry(null);
                setView('create');
              }}
              className="font-mono text-[10px] px-3 py-1.5 bg-white/10 border border-white/20 hover:border-white/40 text-white rounded transition-colors cursor-pointer"
            >
              NEW ENTRY
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || entries.length === 0}
              className="font-mono text-[10px] px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 hover:border-emerald-500/60 text-emerald-300 rounded transition-colors cursor-pointer disabled:opacity-40"
            >
              {exporting ? 'EXPORTING…' : 'EXPORT TO BRAIN'}
            </button>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries…"
            className="flex-1 bg-transparent border border-white/15 text-white font-mono text-xs px-2 py-1 rounded focus:outline-none focus:border-white/40"
          />
          <button
            type="submit"
            disabled={searching}
            className="font-mono text-[10px] px-3 py-1 bg-white/10 border border-white/20 hover:border-white/40 text-white rounded transition-colors cursor-pointer disabled:opacity-40"
          >
            {searching ? 'SEARCHING…' : 'SEARCH'}
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                loadEntries();
              }}
              className="font-mono text-[10px] px-3 py-1 bg-white/5 border border-white/10 text-white/60 rounded transition-colors cursor-pointer"
            >
              CLEAR
            </button>
          )}
        </form>

        {/* Loading */}
        {loading && <div className="font-mono text-[10px] text-white/40">Loading…</div>}

        {/* Entries list */}
        {!loading && entries.length === 0 && (
          <div className="font-mono text-[10px] text-white/30">No entries yet. Create one to get started.</div>
        )}

        {!loading && entries.length > 0 && (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="border border-white/10 bg-white/5 p-3 rounded space-y-2 cursor-pointer hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div
                    onClick={() => {
                      setSelectedEntry(entry);
                      setView('view');
                    }}
                    className="flex-1"
                  >
                    <div className="font-mono text-xs text-white font-semibold">{entry.title}</div>
                    <div className="font-mono text-[9px] text-white/50 mt-1 line-clamp-2">{entry.content}</div>
                  </div>
                </div>

                {entry.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {entry.tags.map((tag) => (
                      <span key={tag} className="font-mono text-[8px] px-2 py-0.5 bg-white/10 text-white/70 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[9px] text-white/40">
                  <span>{entry.authorName}</span>
                  <span>{new Date(entry.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEntry(entry);
                      setTitle(entry.title);
                      setContent(entry.content);
                      setTagsInput(entry.tags.join(', '));
                      setView('edit');
                    }}
                    className="flex-1 font-mono text-[9px] px-2 py-1 bg-white/5 border border-white/15 hover:border-white/30 text-white rounded transition-colors cursor-pointer"
                  >
                    EDIT
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(entry.id);
                    }}
                    className="flex-1 font-mono text-[9px] px-2 py-1 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 text-red-300 rounded transition-colors cursor-pointer"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Render: Create/Edit Form ──────────────────────────────────────────────

  if (view === 'create' || view === 'edit') {
    return (
      <form onSubmit={view === 'create' ? handleCreate : handleUpdate} className="space-y-3 bg-white/5 border border-white/10 p-4 rounded-lg">
        <div className="font-mono text-xs text-white/60">{view === 'create' ? 'Create Entry' : 'Edit Entry'}</div>

        <div>
          <label className="block font-mono text-[10px] text-white/40 mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Decision, best practice, lesson learned…"
            className="w-full bg-transparent border border-white/15 text-white font-mono text-xs px-2 py-1 rounded focus:outline-none focus:border-white/40"
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] text-white/40 mb-1">Content (Markdown)</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Detailed explanation…"
            rows={8}
            className="w-full bg-transparent border border-white/15 text-white font-mono text-xs px-2 py-1 rounded focus:outline-none focus:border-white/40 resize-none"
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] text-white/40 mb-1">Tags (comma-separated)</label>
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="decision, best-practice, lesson-learned"
            className="w-full bg-transparent border border-white/15 text-white font-mono text-xs px-2 py-1 rounded focus:outline-none focus:border-white/40"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 font-mono text-[10px] px-3 py-1.5 bg-white/10 border border-white/20 hover:border-white/40 text-white rounded transition-colors cursor-pointer disabled:opacity-40"
          >
            {loading ? 'SAVING…' : view === 'create' ? 'CREATE' : 'UPDATE'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTitle('');
              setContent('');
              setTagsInput('');
              setSelectedEntry(null);
              setView('list');
            }}
            className="flex-1 font-mono text-[10px] px-3 py-1.5 bg-white/5 border border-white/10 text-white/60 rounded transition-colors cursor-pointer"
          >
            CANCEL
          </button>
        </div>
      </form>
    );
  }

  // ── Render: View Entry ────────────────────────────────────────────────────

  if (view === 'view' && selectedEntry) {
    return (
      <div className="space-y-3 bg-white/5 border border-white/10 p-4 rounded-lg">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-mono text-xs font-semibold text-white">{selectedEntry.title}</h3>
            <div className="font-mono text-[9px] text-white/50 mt-1">
              by {selectedEntry.authorName} · {new Date(selectedEntry.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {selectedEntry.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {selectedEntry.tags.map((tag) => (
              <span key={tag} className="font-mono text-[8px] px-2 py-0.5 bg-white/10 text-white/70 rounded">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="font-mono text-[10px] text-white/80 whitespace-pre-wrap">{selectedEntry.content}</div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setTitle(selectedEntry.title);
              setContent(selectedEntry.content);
              setTagsInput(selectedEntry.tags.join(', '));
              setView('edit');
            }}
            className="flex-1 font-mono text-[9px] px-2 py-1 bg-white/5 border border-white/15 hover:border-white/30 text-white rounded transition-colors cursor-pointer"
          >
            EDIT
          </button>
          <button
            onClick={() => handleDelete(selectedEntry.id)}
            className="flex-1 font-mono text-[9px] px-2 py-1 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 text-red-300 rounded transition-colors cursor-pointer"
          >
            DELETE
          </button>
          <button
            onClick={() => setView('list')}
            className="flex-1 font-mono text-[9px] px-2 py-1 bg-white/5 border border-white/10 text-white/60 rounded transition-colors cursor-pointer"
          >
            BACK
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default TribalMemory;
