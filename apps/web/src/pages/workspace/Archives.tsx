import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, WorkspaceSummary } from '../../lib/api-client';
import { Download, Upload, ShieldCheck, CheckCircle2, RefreshCw, Link2, PlusCircle } from 'lucide-react';

export const Archives: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; files: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!workspace) return;
    try {
      setExporting(true);
      setError(null);
      const blob = await api.downloadWorkspaceZip(workspace.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workspace.name.toLowerCase().replace(/\s+/g, '-')}-archive.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export archive');
    } finally {
      setExporting(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!workspace) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      setError('Please select a valid .zip archive file.');
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setImportResult(null);

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const result = reader.result as string;
          const base64 = result.split(',')[1] || result;
          const res = await api.uploadWorkspaceZip(workspace.id, base64);
          setImportResult({ count: res.count, files: res.files });
        } catch (uploadErr: any) {
          setError(uploadErr.message || 'Failed to extract archive onto workspace');
        } finally {
          setImporting(false);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file from disk');
        setImporting(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || 'Import failed');
      setImporting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6 animate-fade-in text-foreground">
      <div className="border-b border-white/10 pb-6 mb-6">
        <p className="font-mono text-[10px] text-[#ff7597] font-bold tracking-widest uppercase mb-1">
          SOVEREIGN KNOWLEDGE VAULT
        </p>
        <h2 className="font-serif text-3xl font-light text-white">
          Workspace Archive &amp; Data Portability
        </h2>
        <p className="text-sm text-white/60 mt-2 leading-relaxed">
          Conti-Newty enforces complete sovereign ownership. Export your entire living knowledge
          filesystem as an open ZIP archive, or restore files from existing backups.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-950/40 border border-red-500/30 text-red-300 font-mono text-xs">
          {error}
        </div>
      )}

      {/* Export Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-[#141312] border border-white/8 rounded-xl shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-[#ff7597]" />
            <h3 className="text-base font-semibold text-white">
              Export Sovereign Archive (.ZIP)
            </h3>
          </div>
          <p className="text-xs text-white/50 leading-relaxed max-w-md">
            Compiles all documents, SOPs, notes, and institutional memories into an unencrypted,
            portable ZIP file.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-5 py-2.5 rounded-lg bg-white text-black hover:bg-emerald-400 hover:text-black font-mono text-xs font-bold transition-all disabled:opacity-50 whitespace-nowrap cursor-pointer shadow-md flex items-center gap-2"
        >
          {exporting ? 'Packing Archive...' : 'Download ZIP Archive →'}
        </button>
      </div>

      {/* Import Section */}
      <div className="p-6 bg-[#141312] border border-white/8 rounded-xl shadow-md space-y-4">
        <div className="flex items-center gap-2">
          <Upload size={16} className="text-emerald-400" />
          <h3 className="text-base font-semibold text-white">
            Ingest ZIP Archive into Living Filesystem
          </h3>
        </div>
        <p className="text-xs text-white/50 leading-relaxed">
          Upload a ZIP archive to safely unpack files into the workspace root. Traversal sanitization
          protects against path traversal exploits.
        </p>

        <label className="block border-2 border-dashed border-white/15 hover:border-white/40 rounded-xl p-8 text-center cursor-pointer bg-black/30 transition-colors group">
          <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">📦</span>
          <span className="text-sm font-semibold text-white block">
            {importing
              ? 'Extracting and verifying archive...'
              : 'Click or drop a .ZIP file here to ingest'}
          </span>
          <span className="text-xs font-mono text-white/40 block mt-1">
            Accepts standard ZIP archives up to 50MB
          </span>
          <input
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            disabled={importing}
            className="hidden"
          />
        </label>

        {importResult && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 space-y-2 animate-fade-in font-mono text-xs">
            <div className="font-bold flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={16} />
              <span>✓ Ingestion Complete: {importResult.count} files written to workspace.</span>
            </div>
            <div className="max-h-32 overflow-y-auto p-2 bg-black/40 rounded border border-emerald-500/20 space-y-1 text-emerald-300/80">
              {importResult.files.map((file, i) => (
                <div key={i} className="truncate">
                  📄 {file}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tribal Memory Quick Capture */}
      <TribalMemoryCard workspaceId={workspace?.id} />
    </div>
  );
};

const TribalMemoryCard: React.FC<{ workspaceId?: string }> = ({ workspaceId }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleCapture = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId || !title.trim() || !content.trim()) return;
    setSyncing(true);
    setMsg(null);
    try {
      const res = await api.syncTribalMemory(workspaceId, [
        { title: title.trim(), content: content.trim(), author: author.trim() || undefined }
      ]);
      setMsg(`✓ Memory captured! ${res.fileCount} file written to /tribal.`);
      setTitle('');
      setContent('');
      setAuthor('');
      setTimeout(() => setMsg(null), 4000);
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 bg-[#141312] border border-white/8 rounded-xl shadow-md space-y-4">
      <div className="flex items-center gap-2">
        <Link2 size={16} className="text-[#ff7597]" />
        <h3 className="text-base font-semibold text-white">Capture Tribal Memory</h3>
      </div>
      <p className="text-xs text-white/50 leading-relaxed">
        Write operational decisions, architecture notes, or institutional learnings directly into the Git knowledge graph.
      </p>

      {msg && (
        <div className="p-3 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-mono text-xs">
          {msg}
        </div>
      )}

      <form onSubmit={handleCapture} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Decision / Memory Title (e.g. Why We Chose Single-Agent)"
            className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white font-mono text-xs focus:outline-none focus:border-white/40"
            required
          />
          <input
            type="text"
            value={author}
            onChange={e => setAuthor(e.target.value)}
            placeholder="Author / Owner (optional)"
            className="px-3 py-2 bg-black/40 border border-white/10 rounded text-white font-mono text-xs focus:outline-none focus:border-white/40"
          />
        </div>
        <textarea
          rows={3}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Memory contents, reasoning context, or post-mortem key takeaways..."
          className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded text-white font-mono text-xs focus:outline-none focus:border-white/40"
          required
        />
        <button
          type="submit"
          disabled={syncing || !title.trim() || !content.trim()}
          className="px-4 py-2 bg-[#ff7597] text-black font-mono text-xs font-semibold rounded hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
        >
          {syncing ? <RefreshCw size={12} className="animate-spin" /> : <PlusCircle size={12} />}
          <span>{syncing ? 'CAPTURING...' : 'CAPTURE MEMORY'}</span>
        </button>
      </form>
    </div>
  );
};

export default Archives;
