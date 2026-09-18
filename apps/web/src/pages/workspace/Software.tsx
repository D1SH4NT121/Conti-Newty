import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, WorkspaceSummary } from '../../lib/api-client';
import {
  Code2, Play, Terminal, RefreshCw, Layers, Plus, Trash2,
  Copy, Check, Sliders, ExternalLink, Share2, Rocket, Clock
} from 'lucide-react';

interface DeployedApp {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  previewUrl: string;
  shareUrl: string | null;
  createdAt: string;
  deployments: Array<{ status: string }>;
}

interface LocalApp {
  id: string;
  title: string;
  description: string;
  category: string;
  code: string;
  defaultInputs?: Record<string, any>;
  inputSchema?: Array<{ key: string; label: string; type: string; options?: string[]; min?: number; max?: number; step?: number; description?: string }>;
}

const BUILT_IN: LocalApp[] = [
  {
    id: 'incident',
    title: 'Incident SLA Calculator',
    category: 'Operations',
    description: 'Calculates operational escalation windows and paging tiers.',
    defaultInputs: { tempC: -5.4, timeElapsedMin: 14, systemTier: 'P0_CORE', customerImpacted: true },
    inputSchema: [
      { key: 'tempC', label: 'Telemetry Deviation (°C)', type: 'number', step: 0.1 },
      { key: 'timeElapsedMin', label: 'Elapsed Minutes', type: 'number', min: 0, max: 120 },
      { key: 'systemTier', label: 'Severity Tier', type: 'select', options: ['P0_CORE', 'P1_SECONDARY', 'P2_INTERNAL'] },
      { key: 'customerImpacted', label: 'Customer Facing', type: 'boolean' },
    ],
    code: `const { tempC, timeElapsedMin, systemTier, customerImpacted } = inputs;\nlet urgency = 'NOMINAL', notifyWithinSec = 3600, action = 'CONTINUE_LOGGING', tier = 'L1';\nif (tempC < -4 || (systemTier === 'P0_CORE' && customerImpacted)) {\n  urgency = 'CRITICAL'; notifyWithinSec = 18; action = 'PAGE_ONCALL'; tier = 'EXECUTIVE';\n} else if (tempC < 0 || timeElapsedMin > 5) {\n  urgency = 'WARNING'; notifyWithinSec = 300; action = 'INSPECT_BACKUP'; tier = 'L2_LEAD';\n}\nreturn { urgency, maxResolutionWindowSec: notifyWithinSec, recommendedAction: action, escalationTier: tier };`
  },
  {
    id: 'nrr',
    title: 'Net Retention Modeler',
    category: 'Finance',
    description: 'Models ARR compounding, expansion, and churn.',
    defaultInputs: { startingARR: 2500000, expansionRatePct: 24, churnRatePct: 3.5, newBookingsARR: 750000 },
    inputSchema: [
      { key: 'startingARR', label: 'Starting ARR ($)', type: 'number', step: 50000 },
      { key: 'expansionRatePct', label: 'Expansion Rate (%)', type: 'number', step: 0.5 },
      { key: 'churnRatePct', label: 'Gross Churn (%)', type: 'number', step: 0.5 },
      { key: 'newBookingsARR', label: 'New Bookings ($)', type: 'number', step: 25000 },
    ],
    code: `const { startingARR, expansionRatePct, churnRatePct, newBookingsARR } = inputs;\nconst exp = startingARR * (expansionRatePct/100);\nconst churn = startingARR * (churnRatePct/100);\nconst retained = startingARR + exp - churn;\nconst ending = retained + newBookingsARR;\nconst nrr = (retained / startingARR * 100).toFixed(1);\nreturn { startingARR: '$'+startingARR.toLocaleString(), endingARR: '$'+Math.round(ending).toLocaleString(), netDollarRetention: nrr+'%', classification: nrr >= 120 ? 'HYPERGROWTH' : nrr >= 105 ? 'HEALTHY' : 'HIGH_CHURN' };`
  },
  {
    id: 'pii',
    title: 'PII Scrubber',
    category: 'Security',
    description: 'Scans text for leaked API tokens, emails, and phone numbers.',
    defaultInputs: { sampleText: 'Contact devops@corp.com with token sk_live_99481a82bf0192e and call 415-555-0199.' },
    inputSchema: [{ key: 'sampleText', label: 'Text to Inspect', type: 'text' }],
    code: `const input = inputs.sampleText;\nconst emails = input.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z0-9_-]+)/gi) || [];\nconst keys = input.match(/(sk_live_[0-9a-zA-Z]{16,}|ghp_[0-9a-zA-Z]{20,}|AKIA[0-9A-Z]{16})/gi) || [];\nconst phones = input.match(/(\\+?\\d{1,2}[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}/g) || [];\nconst scrubbed = input.replace(/(sk_live_[0-9a-zA-Z]{16,}|ghp_[0-9a-zA-Z]{20,}|AKIA[0-9A-Z]{16})/gi,'[KEY]').replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z0-9_-]+)/gi,'[EMAIL]').replace(/(\\+?\\d{1,2}[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}/g,'[PHONE]');\nreturn { threatsDetected: keys.length+emails.length+phones.length, sanitized: scrubbed, status: keys.length > 0 ? 'CRITICAL_SECRET' : 'CLEAN' };`
  },
];

export const Software: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const [localApps, setLocalApps] = useState<LocalApp[]>(() => {
    try { return [...BUILT_IN, ...JSON.parse(localStorage.getItem('conti_custom_apps') || '[]')]; }
    catch { return BUILT_IN; }
  });
  const [deployedApps, setDeployedApps] = useState<DeployedApp[]>([]);
  const [selectedId, setSelectedId] = useState(BUILT_IN[0].id);
  const [activeTab, setActiveTab] = useState<'run' | 'code' | 'deployed'>('run');
  const [code, setCode] = useState(BUILT_IN[0].code);
  const [inputValues, setInputValues] = useState<Record<string, any>>(BUILT_IN[0].defaultInputs || {});
  const [output, setOutput] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const currentApp = localApps.find(a => a.id === selectedId) || localApps[0];

  useEffect(() => {
    setCode(currentApp.code);
    setInputValues(currentApp.defaultInputs || {});
    setOutput(null); setLogs([]); setError(null); setExecTime(null);
  }, [selectedId]);

  useEffect(() => {
    if (!workspace?.id) return;
    api.listApps(workspace.id).then(setDeployedApps).catch(console.error);
  }, [workspace?.id]);

  const handleRun = async () => {
    setRunning(true); setOutput(null); setError(null); setLogs([]);
    const captured: string[] = [];
    const start = performance.now();
    try {
      const customConsole = { log: (...args: any[]) => captured.push(`[${new Date().toLocaleTimeString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`) };
      const workspaceHelper = { id: workspace.id, name: workspace.name, listFiles: (p = '') => api.listFiles(workspace.id, p), readFile: (p: string) => api.getRawFile(workspace.id, p) };
      const fn = new (Object.getPrototypeOf(async function(){}).constructor)('inputs', 'workspace', 'console', 'crypto', code);
      const result = await fn(inputValues, workspaceHelper, customConsole, window.crypto);
      setExecTime(Math.round((performance.now() - start) * 100) / 100);
      setLogs(captured); setOutput(result);
    } catch (err: any) {
      setExecTime(Math.round((performance.now() - start) * 100) / 100);
      setLogs(captured); setError(err.message);
    } finally { setRunning(false); }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const result = await api.generateApp(workspace.id, {
        prompt: currentApp.description,
        appName: currentApp.title,
        appType: currentApp.category === 'Finance' ? 'dashboard' : 'portal',
      });
      const shareLink = `${window.location.origin}${result.shareUrl}`;
      await navigator.clipboard.writeText(shareLink);
      setCopied('deploy');
      setTimeout(() => setCopied(null), 3000);
      // Refresh deployed list
      api.listApps(workspace.id).then(setDeployedApps).catch(console.error);
      setActiveTab('deployed');
    } catch (err: any) {
      setError(err.message);
    } finally { setDeploying(false); }
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const newApp: LocalApp = {
      id: `custom_${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || 'Custom script',
      category: 'Custom',
      code: `// ${newTitle.trim()}\nconsole.log("Running on workspace: " + workspace.name);\nreturn { success: true, timestamp: new Date().toISOString() };`,
      defaultInputs: {}
    };
    const updated = [...localApps, newApp];
    setLocalApps(updated);
    localStorage.setItem('conti_custom_apps', JSON.stringify(updated.filter(a => a.category === 'Custom')));
    setIsCreating(false); setNewTitle(''); setNewDesc('');
    setSelectedId(newApp.id);
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = localApps.filter(a => a.id !== id);
    setLocalApps(updated);
    localStorage.setItem('conti_custom_apps', JSON.stringify(updated.filter(a => a.category === 'Custom')));
    if (selectedId === id) setSelectedId(BUILT_IN[0].id);
  };

  const copyShareLink = (shareUrl: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`);
    setCopied(shareUrl);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8 animate-fade-in text-foreground">
      <div className="border-b border-white/10 pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-[#ff7597] font-bold uppercase tracking-wider mb-1">SMALL SOFTWARE CLOUD</p>
          <h1 className="font-serif text-3xl font-light text-white">Software</h1>
          <p className="text-sm text-white/50 mt-1">Run scripts locally or deploy as shareable apps — like a Google Doc for software.</p>
        </div>
        <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 px-3.5 py-2 rounded bg-white text-black font-mono text-xs font-semibold hover:bg-emerald-400 transition-colors cursor-pointer">
          <Plus size={14} /> New Script
        </button>
      </div>

      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateCustom} className="bg-[#141312] border border-white/15 p-6 rounded-xl max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-serif text-lg text-white">New Script</h3>
            <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Script name" required autoFocus
              className="w-full px-3 py-2 bg-[#0c0b0a] border border-white/12 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-white/40" />
            <textarea rows={2} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What does it do?"
              className="w-full px-3 py-2 bg-[#0c0b0a] border border-white/12 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-white/40" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsCreating(false)} className="px-4 py-2 border border-white/15 text-white/60 font-mono text-xs rounded-lg hover:text-white cursor-pointer">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-white text-black font-mono text-xs font-semibold rounded-lg hover:bg-emerald-400 cursor-pointer">Create</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-2">
          <div className="font-mono text-[10px] text-white/40 uppercase font-bold tracking-wider px-1 mb-2">SCRIPTS ({localApps.length})</div>
          {localApps.map(app => (
            <div key={app.id} onClick={() => setSelectedId(app.id)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${selectedId === app.id ? 'bg-[#141312] border-white/30' : 'bg-[#0d0d0f] border-white/8 hover:border-white/20'}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-white truncate">
                  <Code2 size={13} className="text-[#ff7597] shrink-0" />
                  <span className="truncate">{app.title}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/8">{app.category}</span>
                  {app.category === 'Custom' && (
                    <button onClick={e => handleDeleteCustom(app.id, e)} className="text-white/20 hover:text-red-400 cursor-pointer"><Trash2 size={11} /></button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2">{app.description}</p>
            </div>
          ))}
        </div>

        {/* Main area */}
        <div className="lg:col-span-8 space-y-4">
          {/* Tabs + actions */}
          <div className="bg-[#141312] border border-white/8 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {(['run', 'code', 'deployed'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors cursor-pointer ${activeTab === tab ? 'bg-white text-black font-bold' : 'text-white/50 hover:text-white border border-white/10'}`}>
                  {tab === 'run' ? <><Sliders size={12} className="inline mr-1" />Inputs</> : tab === 'code' ? <><Terminal size={12} className="inline mr-1" />Code</> : <><Rocket size={12} className="inline mr-1" />Deployed ({deployedApps.length})</>}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleRun} disabled={running}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black font-mono text-xs font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 cursor-pointer">
                {running ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} className="fill-current" />}
                {running ? 'Running...' : 'Run'}
              </button>
              <button onClick={handleDeploy} disabled={deploying}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ff7597]/20 border border-[#ff7597]/40 text-[#ff7597] font-mono text-xs font-semibold hover:bg-[#ff7597]/30 transition-colors disabled:opacity-50 cursor-pointer">
                {deploying ? <RefreshCw size={12} className="animate-spin" /> : <Share2 size={12} />}
                {deploying ? 'Deploying...' : copied === 'deploy' ? '✓ Link Copied!' : 'Deploy & Share'}
              </button>
            </div>
          </div>

          {/* Inputs tab */}
          {activeTab === 'run' && (
            <div className="bg-[#141312] border border-white/8 rounded-xl p-5 space-y-4">
              {currentApp.inputSchema && currentApp.inputSchema.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentApp.inputSchema.map(field => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="font-mono text-xs text-white/50 block font-semibold">{field.label}</label>
                      {field.type === 'number' && (
                        <input type="number" value={inputValues[field.key] ?? ''} step={field.step || 1} min={field.min} max={field.max}
                          onChange={e => setInputValues(p => ({ ...p, [field.key]: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 bg-[#0c0b0a] border border-white/12 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-white/40" />
                      )}
                      {field.type === 'text' && (
                        <input type="text" value={inputValues[field.key] ?? ''}
                          onChange={e => setInputValues(p => ({ ...p, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 bg-[#0c0b0a] border border-white/12 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-white/40" />
                      )}
                      {field.type === 'select' && (
                        <select value={inputValues[field.key] ?? ''} onChange={e => setInputValues(p => ({ ...p, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 bg-[#0c0b0a] border border-white/12 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-white/40">
                          {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )}
                      {field.type === 'boolean' && (
                        <div className="flex items-center gap-2 pt-1">
                          <input type="checkbox" id={`chk_${field.key}`} checked={!!inputValues[field.key]}
                            onChange={e => setInputValues(p => ({ ...p, [field.key]: e.target.checked }))}
                            className="w-4 h-4 rounded" />
                          <label htmlFor={`chk_${field.key}`} className="font-mono text-xs text-white cursor-pointer">
                            {inputValues[field.key] ? 'TRUE' : 'FALSE'}
                          </label>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-white/30 font-mono text-xs">No inputs — switch to Code tab to edit logic.</div>
              )}
            </div>
          )}

          {/* Code tab */}
          {activeTab === 'code' && (
            <div className="bg-[#141312] border border-white/8 rounded-xl overflow-hidden">
              <div className="bg-white/5 px-4 py-2.5 flex items-center gap-2 border-b border-white/8 font-mono text-xs text-white/40">
                <Terminal size={13} className="text-[#ff7597]" />
                <span className="text-white font-semibold">sandbox.js</span>
                <span>· {currentApp.category}</span>
              </div>
              <textarea rows={14} value={code} onChange={e => setCode(e.target.value)} spellCheck={false}
                className="w-full p-4 bg-transparent font-mono text-xs text-white focus:outline-none leading-relaxed resize-y" />
            </div>
          )}

          {/* Deployed apps tab */}
          {activeTab === 'deployed' && (
            <div className="space-y-3">
              {deployedApps.length === 0 ? (
                <div className="bg-[#141312] border border-white/8 rounded-xl p-12 text-center">
                  <div className="font-mono text-[10px] text-white/30 uppercase mb-3">No deployed apps yet</div>
                  <p className="text-xs text-white/40">Click "Deploy & Share" to publish a script as a shareable app.</p>
                </div>
              ) : deployedApps.map(app => (
                <div key={app.id} className="bg-[#141312] border border-white/8 rounded-xl p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{app.name}</div>
                    <div className="font-mono text-[10px] text-white/40 mt-0.5 flex items-center gap-1">
                      <Clock size={9} />
                      {new Date(app.createdAt).toLocaleDateString()}
                      {app.deployments[0]?.status === 'DEPLOYED' && (
                        <span className="ml-2 text-emerald-400">● LIVE</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {app.shareUrl && (
                      <>
                        <a href={app.previewUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 border border-white/15 text-white/60 hover:text-white font-mono text-[10px] rounded-lg transition-colors">
                          <ExternalLink size={11} /> Preview
                        </a>
                        <button onClick={() => copyShareLink(app.shareUrl!)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#ff7597]/20 border border-[#ff7597]/40 text-[#ff7597] font-mono text-[10px] rounded-lg hover:bg-[#ff7597]/30 transition-colors cursor-pointer">
                          {copied === app.shareUrl ? <Check size={11} /> : <Copy size={11} />}
                          {copied === app.shareUrl ? 'Copied!' : 'Copy Link'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Output */}
          {(output !== null || error !== null || logs.length > 0 || running) && activeTab !== 'deployed' && (
            <div className="bg-[#141312] border border-white/8 rounded-xl p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-white uppercase">
                  <Layers size={13} className="text-[#ff7597]" /> Output
                </div>
                <div className="flex items-center gap-3">
                  {execTime !== null && <span className="font-mono text-[10px] text-white/40">{execTime}ms</span>}
                  {output && (
                    <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(output, null, 2)); setCopied('out'); setTimeout(() => setCopied(null), 2000); }}
                      className="flex items-center gap-1 font-mono text-[10px] text-white/40 hover:text-white border border-white/10 px-2 py-0.5 rounded cursor-pointer">
                      {copied === 'out' ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      {copied === 'out' ? 'Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
              {running ? (
                <div className="py-8 flex items-center justify-center gap-2 font-mono text-xs text-white/40">
                  <RefreshCw size={14} className="animate-spin text-[#ff7597]" /> Running in sandbox...
                </div>
              ) : error ? (
                <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-lg text-red-300 font-mono text-xs">{error}</div>
              ) : (
                <div className="space-y-3">
                  {logs.length > 0 && (
                    <div className="p-3 bg-[#0c0b0a] rounded-lg border border-white/8 font-mono text-[11px] text-white/60 space-y-0.5 max-h-28 overflow-y-auto">
                      {logs.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  )}
                  {output !== null && (
                    <pre className="p-4 bg-[#0c0b0a] rounded-lg border border-white/8 font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap max-h-72">
                      {typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Software;
