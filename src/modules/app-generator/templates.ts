export interface TemplateOptions {
  title: string;
  description?: string;
  data?: Record<string, any>;
  fields?: string[];
  documents?: Array<{ title: string; content: string }>;
}

export function generateDashboardTemplate(options: TemplateOptions): Record<string, string> {
  const title = options.title || 'Executive Dashboard';
  const description = options.description || 'Live Workspace Analytics & Metrics';
  const data = options.data || {};
  const dataStr = JSON.stringify(data, null, 2);

  // Extract substantive domain rules, fields, and metrics from workspace knowledge
  const extractedItems: Array<{ label: string; value: string }> = [];
  for (const [_filename, content] of Object.entries(data)) {
    if (typeof content === 'string') {
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes(':') || line.includes('=')) {
          const parts = line.includes(':') ? line.split(':') : line.split('=');
          const key = parts[0].replace(/^[#\s\-*]+/, '').trim();
          const val = parts.slice(1).join(line.includes(':') ? ':' : '=').trim();
          if (key && val && key.length < 50 && val.length < 150) {
            extractedItems.push({ label: key, value: val });
          }
        }
      }
    } else if (typeof content === 'object' && content !== null) {
      for (const [k, v] of Object.entries(content)) {
        extractedItems.push({ label: k, value: String(v) });
      }
    }
  }

  const domainCardsHtml = extractedItems.slice(0, 6).map(item => `
      <div class="card domain-card">
        <h3>${item.label}</h3>
        <div class="domain-val">${item.value}</div>
      </div>
  `).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --accent: #38bdf8;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 2rem;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    header { margin-bottom: 2rem; }
    h1 { margin: 0 0 0.5rem 0; color: var(--accent); }
    p.subtitle { color: var(--muted); margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 1.5rem; }
    .card { background: var(--card-bg); padding: 1.5rem; border-radius: 12px; border: 1px solid #334155; }
    .stat-val { font-size: 2.25rem; font-weight: bold; color: #fff; margin: 0.5rem 0; }
    .domain-val { font-size: 1.1rem; color: #38bdf8; margin: 0.5rem 0; font-family: monospace; }
    pre { background: #0b0f19; padding: 1rem; border-radius: 8px; overflow-x: auto; color: #a5f3fc; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${title}</h1>
      <p class="subtitle">${description}</p>
    </header>
    <div class="grid">
      <div class="card">
        <h3>Metrics Overview</h3>
        <div class="stat-val" id="primary-metric">Active</div>
        <p class="subtitle">Real-time status</p>
      </div>
      ${domainCardsHtml}
      <div class="card" style="grid-column: 1 / -1;">
        <h3>Live Workspace Data & Knowledge</h3>
        <pre id="data-preview">${dataStr}</pre>
      </div>
    </div>
  </div>
  <script src="app.js"></script>
</body>
</html>`;

  const domainRulesJs = extractedItems.map(item => `// Domain Rule: ${item.label} => ${item.value}`).join('\n');

  const js = `console.log("${title} initialized.");
${domainRulesJs}
document.addEventListener('DOMContentLoaded', () => {
  const metricEl = document.getElementById('primary-metric');
  if (metricEl) {
    metricEl.innerText = "Synchronized";
  }
});`;

  return {
    'index.html': html,
    'app.js': js
  };
}

export function generatePortalTemplate(options: TemplateOptions): Record<string, string> {
  const title = options.title || 'Knowledge Portal';
  const description = options.description || 'Workspace Document Hub';
  const data = options.data || {};

  const docsHtml = Object.entries(data).map(([filename, content]) => `
    <div class="doc-item">
      <h3>${filename}</h3>
      <pre>${typeof content === 'string' ? content.substring(0, 300) : JSON.stringify(content, null, 2)}</pre>
    </div>
  `).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #090d16; color: #f1f5f9; padding: 2rem; }
    .header { border-bottom: 1px solid #1e293b; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    .doc-item { background: #131c2e; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid #334155; }
    pre { background: #0b0f19; padding: 0.75rem; border-radius: 6px; color: #38bdf8; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <p>${description}</p>
  </div>
  <div id="docs-list">
    ${docsHtml || '<p>No workspace documents found.</p>'}
  </div>
</body>
</html>`;

  return {
    'index.html': html,
    'app.js': 'console.log("Portal loaded");'
  };
}
