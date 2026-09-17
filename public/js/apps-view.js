// Small Software Cloud Apps View Module
window.AppsView = {
  async loadApps(workspaceId) {
    const container = document.getElementById('deployed-apps-container');
    if (!container || !workspaceId) return;

    try {
      const apps = await window.WorkbenchApi.getApps(workspaceId);
      if (!apps || apps.length === 0) {
        container.innerHTML = '<div class="empty-state">No apps deployed yet. Generate your first one above!</div>';
        return;
      }

      container.innerHTML = '';
      apps.forEach((app) => {
        const card = document.createElement('div');
        card.className = 'app-card';
        card.innerHTML = `
          <strong>${app.name}</strong>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:0.25rem 0;">${app.description || 'Small software app'}</p>
          <div style="font-size:0.75rem; color:var(--accent-cyan);">Status: DEPLOYED</div>
        `;
        card.onclick = () => this.previewApp(workspaceId, app.id, app.name);
        container.appendChild(card);
      });
    } catch (err) {
      container.innerHTML = `<div class="empty-state error">Error loading apps: ${err.message}</div>`;
    }
  },

  async generateApp(workspaceId) {
    const promptInput = document.getElementById('app-prompt-input');
    const typeSelect = document.getElementById('app-type-select');
    const prompt = promptInput.value.trim();
    if (!prompt || !workspaceId) {
      alert('Please enter a description of the app you want to generate.');
      return;
    }

    const genBtn = document.getElementById('btn-generate-app');
    genBtn.disabled = true;
    genBtn.textContent = 'Generating & Deploying...';

    try {
      const res = await window.WorkbenchApi.generateApp(workspaceId, prompt, typeSelect.value);
      promptInput.value = '';
      genBtn.disabled = false;
      genBtn.textContent = 'Generate & Deploy App';

      await this.loadApps(workspaceId);
      if (res.url) {
        this.setIframePreview(res.name, res.url);
      }
    } catch (err) {
      alert(`Generation failed: ${err.message}`);
      genBtn.disabled = false;
      genBtn.textContent = 'Generate & Deploy App';
    }
  },

  async previewApp(workspaceId, appId, name) {
    try {
      const app = await window.WorkbenchApi.getApp(workspaceId, appId);
      if (app && app.url) {
        this.setIframePreview(name, app.url);
      }
    } catch (err) {
      alert(`Error loading app preview: ${err.message}`);
    }
  },

  setIframePreview(title, url) {
    document.getElementById('preview-app-title').textContent = title;
    const iframe = document.getElementById('sandbox-preview-iframe');
    const placeholder = document.querySelector('.preview-placeholder');
    const externalLink = document.getElementById('preview-external-link');

    if (placeholder) placeholder.style.display = 'none';
    iframe.style.display = 'block';
    iframe.src = url;

    externalLink.style.display = 'inline-flex';
    externalLink.href = url;
  }
};
