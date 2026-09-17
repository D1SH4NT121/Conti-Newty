import React, { useState } from 'react';
import { InView } from '../motion/InView';
import { ShimmerText } from '../ui/shimmer-bg-text';

export const AgentIntegration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'mcp' | 'sdk' | 'curl'>('mcp');

  const codeSnippets = {
    mcp: `// Claude Desktop / Cursor / Model Context Protocol Config
{
  "mcpServers": {
    "continewty": {
      "command": "npx",
      "args": ["-y", "@continewty/mcp-server"],
      "env": {
        "CONTINIEWTY_REPO": "git@github.com:org/company_brain.git",
        "ENCLAVE_TOKEN": "cty_live_8f92a1..."
      }
    }
  }
}`,
    sdk: `import { ContinewtyClient } from '@continewty/sdk';

const brain = new ContinewtyClient({
  repo: 'org/company_brain',
  branch: 'main'
});

// Deterministic AST Traversal with Line-Level Provenance
const evidence = await brain.traverse({
  query: "Why did Chicago deployment miss SLA?",
  targetDirectory: "/operations",
  verifySha256: true
});

console.log(evidence.provenance.hash); 
// -> sha256:e3b0c44298fc1c149afbf4c8...`,
    curl: `curl -X POST https://api.continewty.com/v1/brain/traverse \\
  -H "Authorization: Bearer cty_live_8f92a1..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "path": "/operations/chicago_deployment.md",
    "lines": [14, 18],
    "attestation": "sha256"
  }'`,
  };

  return (
    <section className="py-24 px-6 max-w-7xl mx-auto border-t border-border relative z-10" id="integrations">
      <InView>
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Context & Agent Tooling */}
          <div className="lg:col-span-5 space-y-6">
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
              AGENT INTEGRATIONS // MCP & REST
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl font-light leading-tight text-foreground">
              Native tooling for<br />
              <ShimmerText className="italic">autonomous agents.</ShimmerText>
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              Continewty speaks Model Context Protocol (MCP) and standard REST natively. Point Claude, Cursor, LangChain, or your custom agents directly at your Company Brain without writing custom RAG plumbing.
            </p>

            <div className="space-y-3 font-mono text-xs text-foreground/80 pt-2">
              {[
                'Zero-config MCP Server for Claude & Cursor',
                'Deterministic AST Grep & Line Citations',
                'Cryptographic Tool Authorization Policies',
                'TypeScript, Python, and Go Client SDKs',
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2.5">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Code Snippet Explorer */}
          <div className="lg:col-span-7 bg-[#141311] border border-border rounded-md shadow-2xl overflow-hidden font-mono text-xs">
            {/* Tab Bar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-b border-border text-[11px]">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('mcp')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTab === 'mcp'
                      ? 'bg-zinc-800 text-white font-bold'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  mcp-config.json
                </button>
                <button
                  onClick={() => setActiveTab('sdk')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTab === 'sdk'
                      ? 'bg-zinc-800 text-white font-bold'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  agent-runner.ts
                </button>
                <button
                  onClick={() => setActiveTab('curl')}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeTab === 'curl'
                      ? 'bg-zinc-800 text-white font-bold'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  cURL
                </button>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold uppercase">
                MCP 1.0 READY
              </span>
            </div>

            {/* Code Body */}
            <div className="p-5 bg-[#0C0B0A]/95 text-zinc-300 overflow-x-auto leading-relaxed">
              <pre className="text-xs">
                <code>{codeSnippets[activeTab]}</code>
              </pre>
            </div>

            {/* Code Footer */}
            <div className="px-5 py-2.5 bg-black/40 border-t border-border/80 flex items-center justify-between text-[10px] text-zinc-500">
              <span>Standard Open Protocol</span>
              <span className="text-zinc-400">Works with any LLM / Agent Framework</span>
            </div>
          </div>
        </div>
      </InView>
    </section>
  );
};
