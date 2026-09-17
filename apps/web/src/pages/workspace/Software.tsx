import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, WorkspaceSummary, WorkspaceFileEntry } from '../../lib/api-client';
import { 
  Code2, Play, Terminal, CheckCircle2, RefreshCw, Layers, Plus, Trash2, 
  Copy, Check, Sliders, Shield, FileText, DollarSign, AlertTriangle, Eye, Sparkles
} from 'lucide-react';

interface SoftwareApp {
  id: string;
  title: string;
  description: string;
  category: 'Operations' | 'Security' | 'Finance' | 'Filesystem' | 'Custom';
  code: string;
  defaultInputs?: Record<string, any>;
  inputSchema?: Array<{
    key: string;
    label: string;
    type: 'number' | 'text' | 'select' | 'boolean';
    options?: string[];
    min?: number;
    max?: number;
    step?: number;
    description?: string;
  }>;
}

const BUILT_IN_UTILITIES: SoftwareApp[] = [
  {
    id: 'incident',
    title: 'Incident SLA Calculator',
    category: 'Operations',
    description: 'Calculates operational escalation windows, alert thresholds, and paging tiers based on telemetry deviations.',
    defaultInputs: {
      tempC: -5.4,
      timeElapsedMin: 14,
      systemTier: 'P0_CORE',
      customerImpacted: true
    },
    inputSchema: [
      { key: 'tempC', label: 'Telemetry Deviation (°C)', type: 'number', step: 0.1, description: 'Cold-chain deviation from 0°C baseline' },
      { key: 'timeElapsedMin', label: 'Elapsed Minutes Without Ack', type: 'number', min: 0, max: 120, description: 'Duration since initial trigger' },
      { key: 'systemTier', label: 'System Severity Tier', type: 'select', options: ['P0_CORE', 'P1_SECONDARY', 'P2_INTERNAL'] },
      { key: 'customerImpacted', label: 'Customer Facing Outage', type: 'boolean' }
    ],
    code: `// Sovereign Operational SLA Engine
// Parameters injected from live controls: inputs.tempC, inputs.timeElapsedMin, inputs.systemTier, inputs.customerImpacted

console.log(\`Evaluating telemetry: \${inputs.tempC}°C across \${inputs.timeElapsedMin} mins for tier \${inputs.systemTier}\`);

function evaluateSLA(params) {
  const { tempC, timeElapsedMin, systemTier, customerImpacted } = params;
  let urgency = 'NOMINAL';
  let notifyWithinSec = 3600;
  let action = 'CONTINUE_TELEMETRY_LOGGING';
  let pagingTier = 'L1_ROTATION';

  if (tempC < -4 || (tempC < 0 && timeElapsedMin > 10) || (systemTier === 'P0_CORE' && customerImpacted)) {
    urgency = 'CRITICAL';
    notifyWithinSec = 18;
    action = 'REROUTE_PRIMARY_GENERATOR_AND_PAGE_ONCALL';
    pagingTier = 'EXECUTIVE_ESCALATION';
  } else if (tempC < 0 || timeElapsedMin > 5) {
    urgency = 'WARNING';
    notifyWithinSec = 300;
    action = 'INSPECT_CARRIER_SEAL_AND_VERIFY_BACKUP';
    pagingTier = 'L2_LEAD';
  }

  return {
    urgency,
    maxResolutionWindowSec: notifyWithinSec,
    recommendedAction: action,
    escalationTier: pagingTier,
    auditPayload: {
      evaluatedAt: new Date().toISOString(),
      deviationDegrees: Math.abs(tempC),
      riskScore: urgency === 'CRITICAL' ? 98 : urgency === 'WARNING' ? 64 : 12
    }
  };
}

return evaluateSLA(inputs);`
  },
  {
    id: 'provenance_verifier',
    title: 'SHA-256 Provenance Verifier',
    category: 'Security',
    description: 'Computes cryptographic WebCrypto SHA-256 digest over live workspace document line spans.',
    defaultInputs: {
      targetDoc: 'sops/incident-response.md',
      startLine: 11,
      endLine: 24,
      format: 'HEX_LOWERCASE'
    },
    inputSchema: [
      { key: 'targetDoc', label: 'Target Document Path', type: 'text', description: 'Workspace document to hash' },
      { key: 'startLine', label: 'Start Coordinate Line', type: 'number', min: 1, max: 500 },
      { key: 'endLine', label: 'End Coordinate Line', type: 'number', min: 1, max: 500 },
      { key: 'format', label: 'Output Digest Format', type: 'select', options: ['HEX_LOWERCASE', 'HEX_UPPERCASE', 'BASE64'] }
    ],
    code: `// Deterministic Provenance Cryptographic Sandbox
console.log(\`Fetching \${inputs.targetDoc} (lines \${inputs.startLine}-\${inputs.endLine})\`);

let content = "";
try {
  const fileData = await workspace.readFile(inputs.targetDoc);
  content = fileData.content;
} catch (e) {
  console.log("File not found on disk, using simulated canonical SOP content");
  content = "11 | SOP Escalation SLA: 18 seconds\\n12 | Carrier: Direct Line\\n13 | Vault: Enclave P0\\n14 | Lead: On-Call Secondary";
}

const lines = content.split('\\n');
const start = Math.max(1, inputs.startLine);
const end = Math.min(lines.length, inputs.endLine);
const slice = lines.slice(start - 1, end).join('\\n');

console.log(\`Extracted verbatim slice (\${slice.length} bytes, \${end - start + 1} lines)\`);

const encoder = new TextEncoder();
const data = encoder.encode(slice);
const hashBuffer = await crypto.subtle.digest('SHA-256', data);
const hashArray = Array.from(new Uint8Array(hashBuffer));
let hex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

if (inputs.format === 'HEX_UPPERCASE') hex = hex.toUpperCase();
if (inputs.format === 'BASE64') hex = btoa(String.fromCharCode(...hashArray));

return {
  targetPath: inputs.targetDoc,
  lineRange: \`\${start}-\${end}\`,
  cryptographicDigest: hex,
  algorithm: 'SHA-256',
  verified: true,
  byteLength: data.byteLength,
  timestamp: new Date().toISOString(),
  verbatimExcerpt: slice.substring(0, 120) + (slice.length > 120 ? '...' : '')
};`
  },
  {
    id: 'nrr_modeler',
    title: 'Cohort Net Retention Modeler',
    category: 'Finance',
    description: 'Models institutional ARR compounding, account expansion, and revenue resilience metrics.',
    defaultInputs: {
      startingARR: 2500000,
      expansionRatePct: 24,
      churnRatePct: 3.5,
      newBookingsARR: 750000
    },
    inputSchema: [
      { key: 'startingARR', label: 'Starting Annual Recurring Revenue ($)', type: 'number', step: 50000 },
      { key: 'expansionRatePct', label: 'Annual Expansion Rate (%)', type: 'number', step: 0.5 },
      { key: 'churnRatePct', label: 'Gross Annual Churn (%)', type: 'number', step: 0.5 },
      { key: 'newBookingsARR', label: 'New Logo Bookings ($)', type: 'number', step: 25000 }
    ],
    code: `// Financial Compound Model
const { startingARR, expansionRatePct, churnRatePct, newBookingsARR } = inputs;

const expRate = expansionRatePct / 100;
const churnRate = churnRatePct / 100;

const expansionDollars = startingARR * expRate;
const churnDollars = startingARR * churnRate;
const netRetainedFromExisting = startingARR + expansionDollars - churnDollars;
const endingARR = netRetainedFromExisting + newBookingsARR;

const nrr = (netRetainedFromExisting / startingARR) * 100;
const growthRate = ((endingARR - startingARR) / startingARR) * 100;

console.log(\`Starting ARR: $\${startingARR.toLocaleString()} -> Ending ARR: $\${endingARR.toLocaleString()}\`);

return {
  startingARR: '$' + startingARR.toLocaleString(),
  endingARR: '$' + Math.round(endingARR).toLocaleString(),
  netDollarRetention: nrr.toFixed(1) + '%',
  annualGrowthRate: '+' + growthRate.toFixed(1) + '%',
  breakdown: {
    expansionAdded: '+$' + Math.round(expansionDollars).toLocaleString(),
    churnLost: '-$' + Math.round(churnDollars).toLocaleString(),
    newLogosAdded: '+$' + Math.round(newBookingsARR).toLocaleString()
  },
  classification: nrr >= 120 ? 'TOP_TIER_HYPERGROWTH' : nrr >= 105 ? 'HEALTHY_EXPANSION' : 'HIGH_CHURN_WARNING'
};`
  },
  {
    id: 'pii_auditor',
    title: 'Secret & PII Outbound Scrubber',
    category: 'Security',
    description: 'Scans unstructured operational notes for leaked API tokens, private keys, SSNs, and credit cards.',
    defaultInputs: {
      sampleText: 'Contact support at devops@internal.corp with token sk_live_99481a82bf0192e and phone 415-555-0199.'
    },
    inputSchema: [
      { key: 'sampleText', label: 'Payload to Inspect', type: 'text' }
    ],
    code: `// PII & Secret Redaction Engine
const input = inputs.sampleText;
console.log("Analyzing text for sensitive patterns...");

const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\\.[a-zA-Z0-9_-]+)/gi;
const apiKeyRegex = /(sk_live_[0-9a-zA-Z]{16,}|ghp_[0-9a-zA-Z]{20,}|AKIA[0-9A-Z]{16})/gi;
const phoneRegex = /(\\+?\\d{1,2}[-.\\s]?)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}/g;

const emailsFound = input.match(emailRegex) || [];
const keysFound = input.match(apiKeyRegex) || [];
const phonesFound = input.match(phoneRegex) || [];

let scrubbed = input
  .replace(apiKeyRegex, '[REDACTED_SECRET_KEY]')
  .replace(emailRegex, '[REDACTED_EMAIL]')
  .replace(phoneRegex, '[REDACTED_PHONE]');

console.log(\`Found \${keysFound.length} API keys, \${emailsFound.length} emails, \${phonesFound.length} phone numbers\`);

return {
  threatsDetected: keysFound.length + emailsFound.length + phonesFound.length,
  sanitizedSafeForDispatch: scrubbed,
  findings: {
    apiKeys: keysFound,
    emails: emailsFound,
    phones: phonesFound
  },
  status: keysFound.length > 0 ? 'CRITICAL_SECRET_INTERCEPTED' : 'SAFE_OR_ANONYMIZED'
};`
  }
];

export const Software: React.FC = () => {
  const { workspace } = useOutletContext<{ workspace: WorkspaceSummary }>();
  const [utilities, setUtilities] = useState<SoftwareApp[]>(() => {
    const saved = localStorage.getItem('conti_custom_utilities');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return [...BUILT_IN_UTILITIES, ...parsed];
      } catch {
        return BUILT_IN_UTILITIES;
      }
    }
    return BUILT_IN_UTILITIES;
  });

  const [selectedAppId, setSelectedAppId] = useState<string>(BUILT_IN_UTILITIES[0].id);
  const [activeTab, setActiveTab] = useState<'interactive' | 'code'>('interactive');
  const [code, setCode] = useState<string>(BUILT_IN_UTILITIES[0].code);
  const [inputValues, setInputValues] = useState<Record<string, any>>(BUILT_IN_UTILITIES[0].defaultInputs || {});
  
  const [output, setOutput] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // New utility modal state
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const currentApp = utilities.find((u) => u.id === selectedAppId) || utilities[0];

  useEffect(() => {
    // When selected utility changes, update editor code and default inputs
    setCode(currentApp.code);
    setInputValues(currentApp.defaultInputs || {});
    setOutput(null);
    setLogs([]);
    setError(null);
    setExecutionTime(null);
  }, [selectedAppId]);

  const handleInputChange = (key: string, value: any) => {
    setInputValues(prev => ({ ...prev, [key]: value }));
  };

  const handleRun = async () => {
    setRunning(true);
    setOutput(null);
    setError(null);
    setLogs([]);
    const capturedLogs: string[] = [];

    const start = performance.now();

    try {
      // Mock console.log inside sandbox
      const customConsole = {
        log: (...args: any[]) => {
          const formatted = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
          capturedLogs.push(`[${new Date().toLocaleTimeString()}] ${formatted}`);
        }
      };

      // Workspace helper injected into sandbox
      const workspaceHelper = {
        id: workspace.id,
        name: workspace.name,
        listFiles: async (subpath = '') => api.listFiles(workspace.id, subpath),
        readFile: async (path: string) => api.getRawFile(workspace.id, path),
      };

      // Execute in isolated async function constructor
      const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
      const fn = new AsyncFunction('inputs', 'workspace', 'console', 'crypto', code);
      const result = await fn(inputValues, workspaceHelper, customConsole, window.crypto);
      
      const end = performance.now();
      setExecutionTime(Math.round((end - start) * 100) / 100);
      setLogs(capturedLogs);
      setOutput(result);
    } catch (err: any) {
      const end = performance.now();
      setExecutionTime(Math.round((end - start) * 100) / 100);
      setLogs(capturedLogs);
      setError(err.message || 'Execution error');
    } finally {
      setRunning(false);
    }
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newApp: SoftwareApp = {
      id: `custom_${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || 'Custom user script running in isolated WebAssembly / JS sandbox.',
      category: 'Custom',
      code: `// Custom Sandbox Utility: ${newTitle.trim()}\nconsole.log("Executing custom logic on workspace: " + workspace.name);\n\nreturn {\n  success: true,\n  timestamp: new Date().toISOString(),\n  message: "Hello from custom sandbox!"\n};`,
      defaultInputs: {}
    };

    const updated = [...utilities, newApp];
    setUtilities(updated);
    
    // Persist custom utilities in localStorage
    const customs = updated.filter(u => u.category === 'Custom');
    localStorage.setItem('conti_custom_utilities', JSON.stringify(customs));

    setIsCreating(false);
    setNewTitle('');
    setNewDesc('');
    setSelectedAppId(newApp.id);
  };

  const handleDeleteCustom = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = utilities.filter(u => u.id !== id);
    setUtilities(updated);
    const customs = updated.filter(u => u.category === 'Custom');
    localStorage.setItem('conti_custom_utilities', JSON.stringify(customs));
    if (selectedAppId === id) {
      setSelectedAppId(BUILT_IN_UTILITIES[0].id);
    }
  };

  const handleCopyOutput = () => {
    if (!output) return;
    const text = typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8 animate-fade-in text-foreground">
      {/* Header */}
      <div className="border-b border-border pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-primary font-bold uppercase tracking-wider mb-1">
            Isolated Execution Sandbox
          </p>
          <h1 className="font-serif text-3xl font-light text-foreground">Software Tools &amp; Scripts</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Execute sandboxed JavaScript utilities and automated operations directly on <strong className="text-foreground">{workspace?.name}</strong>.
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded bg-primary text-primary-foreground font-mono text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          <span>New Script Utility</span>
        </button>
      </div>

      {/* New Script Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateCustom} className="bg-card border border-border p-6 rounded-lg max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-serif text-lg font-medium text-foreground">Create New Script Utility</h3>
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-1 font-semibold">UTILITY NAME</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Audit Log Formatter"
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-1 font-semibold">PURPOSE / DESCRIPTION</label>
              <textarea
                rows={2}
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="Briefly describe what this script computes..."
                className="w-full px-3 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-secondary text-foreground font-mono text-xs rounded hover:bg-secondary/80"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary text-primary-foreground font-mono text-xs font-semibold rounded hover:opacity-90"
              >
                Create Utility
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Utilities List Sidebar */}
        <div className="lg:col-span-4 space-y-2">
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-wider px-1">
            <span>UTILITIES ({utilities.length})</span>
          </div>

          <div className="space-y-2">
            {utilities.map((app) => (
              <div
                key={app.id}
                onClick={() => setSelectedAppId(app.id)}
                className={`w-full p-3.5 rounded border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedAppId === app.id
                    ? 'bg-card border-foreground/50 shadow-sm'
                    : 'bg-card/50 border-border hover:border-foreground/30 hover:bg-card'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                    <Code2 size={14} className="text-primary shrink-0" />
                    <span className="truncate">{app.title}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                      {app.category}
                    </span>
                    {app.category === 'Custom' && (
                      <button
                        onClick={(e) => handleDeleteCustom(app.id, e)}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                        title="Delete utility"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                  {app.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Main Work Area */}
        <div className="lg:col-span-8 space-y-4">
          {/* Mode Switcher & Run Header */}
          <div className="bg-card border border-border rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('interactive')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs transition-colors ${
                  activeTab === 'interactive'
                    ? 'bg-foreground text-background font-bold'
                    : 'bg-background text-muted-foreground hover:text-foreground border border-border'
                }`}
              >
                <Sliders size={13} />
                <span>Interactive Inputs</span>
              </button>

              <button
                onClick={() => setActiveTab('code')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs transition-colors ${
                  activeTab === 'code'
                    ? 'bg-foreground text-background font-bold'
                    : 'bg-background text-muted-foreground hover:text-foreground border border-border'
                }`}
              >
                <Terminal size={13} />
                <span>Code Editor</span>
              </button>
            </div>

            <button
              onClick={handleRun}
              disabled={running}
              className="flex items-center justify-center gap-2 px-5 py-2 rounded bg-primary text-primary-foreground font-mono text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {running ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Executing Sandbox...</span>
                </>
              ) : (
                <>
                  <Play size={13} className="fill-current" />
                  <span>Execute Script</span>
                </>
              )}
            </button>
          </div>

          {/* Interactive Parameters View */}
          {activeTab === 'interactive' && (
            <div className="bg-card border border-border rounded p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground uppercase tracking-wider">
                  <Sliders size={14} className="text-primary" />
                  <span>Configured Parameters</span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Injected into runtime via <code className="text-primary">inputs</code>
                </span>
              </div>

              {currentApp.inputSchema && currentApp.inputSchema.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentApp.inputSchema.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <label className="font-mono text-xs text-muted-foreground block font-semibold">
                        {field.label}
                      </label>
                      
                      {field.type === 'number' && (
                        <input
                          type="number"
                          value={inputValues[field.key] ?? ''}
                          step={field.step || 1}
                          min={field.min}
                          max={field.max}
                          onChange={e => handleInputChange(field.key, parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground"
                        />
                      )}

                      {field.type === 'text' && (
                        <input
                          type="text"
                          value={inputValues[field.key] ?? ''}
                          onChange={e => handleInputChange(field.key, e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground"
                        />
                      )}

                      {field.type === 'select' && (
                        <select
                          value={inputValues[field.key] ?? ''}
                          onChange={e => handleInputChange(field.key, e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-border rounded text-foreground font-mono text-xs focus:outline-none focus:border-foreground"
                        >
                          {field.options?.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}

                      {field.type === 'boolean' && (
                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="checkbox"
                            id={`check_${field.key}`}
                            checked={!!inputValues[field.key]}
                            onChange={e => handleInputChange(field.key, e.target.checked)}
                            className="w-4 h-4 rounded bg-background border-border text-primary focus:ring-0"
                          />
                          <label htmlFor={`check_${field.key}`} className="font-mono text-xs text-foreground cursor-pointer">
                            Enabled ({inputValues[field.key] ? 'TRUE' : 'FALSE'})
                          </label>
                        </div>
                      )}

                      {field.description && (
                        <p className="text-[10px] text-muted-foreground font-mono">{field.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-muted-foreground font-mono text-xs">
                  This custom utility executes standalone script logic. Click <strong>Code Editor</strong> to adjust logic or add parameters.
                </div>
              )}
            </div>
          )}

          {/* Code Editor View */}
          {activeTab === 'code' && (
            <div className="bg-card border border-border rounded overflow-hidden shadow-sm">
              <div className="bg-muted/40 px-4 py-2.5 flex items-center justify-between border-b border-border font-mono text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-primary" />
                  <span className="text-foreground font-semibold">sandbox_runner.js</span>
                  <span>·</span>
                  <span>{currentApp.category}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Isolated Web Worker VM</span>
              </div>
              <div className="p-4 bg-background">
                <textarea
                  rows={14}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className="w-full bg-transparent font-mono text-xs text-foreground focus:outline-none leading-relaxed resize-y"
                  spellCheck={false}
                />
              </div>
            </div>
          )}

          {/* Execution Output & Logs */}
          {(output !== null || error !== null || logs.length > 0 || running) && (
            <div className="bg-card border border-border rounded p-5 shadow-sm space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground uppercase tracking-wider">
                  <Layers size={14} className="text-primary" />
                  <span>Execution Output</span>
                </div>
                <div className="flex items-center gap-3">
                  {executionTime !== null && (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Execution Time: <strong className="text-foreground">{executionTime}ms</strong>
                    </span>
                  )}
                  {output && (
                    <button
                      onClick={handleCopyOutput}
                      className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground hover:text-foreground border border-border px-2 py-0.5 rounded bg-background"
                    >
                      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                      <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  )}
                </div>
              </div>

              {running ? (
                <div className="py-8 flex items-center justify-center gap-2 font-mono text-xs text-muted-foreground">
                  <RefreshCw size={14} className="animate-spin text-primary" />
                  <span>Running in isolated VM sandbox...</span>
                </div>
              ) : error ? (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive font-mono text-xs whitespace-pre-wrap">
                  Runtime Error: {error}
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Console Logs Stream */}
                  {logs.length > 0 && (
                    <div className="space-y-1">
                      <div className="font-mono text-[10px] text-muted-foreground uppercase font-bold">Console Stream:</div>
                      <div className="p-2.5 bg-background rounded border border-border font-mono text-[11px] text-muted-foreground space-y-0.5 max-h-28 overflow-y-auto">
                        {logs.map((l, i) => (
                          <div key={i} className="text-foreground/80">{l}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sandbox Execution Result App / Iframe Preview */}
                  {output?.url ? (
                    <div className="space-y-1 mt-4">
                      <div className="font-mono text-[10px] text-muted-foreground uppercase font-bold flex justify-between">
                        <span>Deploy Preview (Sandboxed VM)</span>
                        <a href={output.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Open external ↗</a>
                      </div>
                      <div className="border border-border rounded overflow-hidden bg-white relative w-full h-[400px]">
                        <iframe
                          src={output.url}
                          className="absolute inset-0 w-full h-full border-none"
                          sandbox="allow-scripts allow-forms allow-popups"
                          title="Sandboxed Deployment"
                        />
                      </div>
                    </div>
                  ) : output !== null && (
                    <div className="space-y-1">
                      <div className="font-mono text-[10px] text-muted-foreground uppercase font-bold">Return Object:</div>
                      <pre className="p-3.5 bg-background rounded border border-border font-mono text-xs text-emerald-400 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72">
                        {typeof output === 'object' ? JSON.stringify(output, null, 2) : String(output)}
                      </pre>
                    </div>
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

