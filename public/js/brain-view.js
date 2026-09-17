// Company Brain View Module
window.BrainView = {
  currentFile: null,
  currentMode: 'raw', // 'raw' | 'preview'
  lastLoadedContent: '',
  hasUnsavedChanges: false,

  async loadFiles(workspaceId) {
    const listContainer = document.getElementById('file-list-tree');
    if (!listContainer || !workspaceId) return;

    try {
      const res = await window.WorkbenchApi.getFiles(workspaceId);
      const files = res.files || [];
      if (files.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No files in workspace.<br><small>Click "Import" or "+ " to add files.</small></div>';
        return;
      }

      listContainer.innerHTML = '';
      files.forEach((file) => {
        const item = document.createElement('div');
        item.className = `file-item ${this.currentFile === file.path ? 'active' : ''}`;
        item.innerHTML = `<span class="file-icon">${file.isDirectory ? '📁' : '📄'}</span> <span class="file-name">${file.name}</span>`;
        if (!file.isDirectory) {
          item.onclick = () => this.openFile(workspaceId, file.path);
        }
        listContainer.appendChild(item);
      });
    } catch (err) {
      listContainer.innerHTML = `<div class="empty-state error">Error loading files: ${err.message}</div>`;
    }
  },

  async openFile(workspaceId, filePath) {
    this.currentFile = filePath;
    const titleEl = document.getElementById('active-file-title');
    const editorEl = document.getElementById('file-editor-content');
    const previewEl = document.getElementById('file-markdown-preview');
    const saveBtn = document.getElementById('btn-save-file');
    const proposeBtn = document.getElementById('btn-propose-file-change');
    const downloadBtn = document.getElementById('btn-download-file');
    const anonymizeBtn = document.getElementById('btn-anonymize-file');
    const conflictBanner = document.getElementById('file-conflict-banner');

    if (conflictBanner) conflictBanner.style.display = 'none';

    titleEl.textContent = filePath;
    editorEl.disabled = true;
    editorEl.value = 'Loading file content...';

    try {
      const res = await window.WorkbenchApi.readFile(workspaceId, filePath);
      const content = res.content || '';
      editorEl.value = content;
      this.lastLoadedContent = content;
      this.hasUnsavedChanges = false;
      editorEl.disabled = false;

      if (saveBtn) saveBtn.disabled = false;
      if (proposeBtn) proposeBtn.disabled = false;
      if (downloadBtn) downloadBtn.disabled = false;
      if (anonymizeBtn) anonymizeBtn.disabled = false;

      this.renderPreview(content);

      const contextIndicator = document.getElementById('ai-context-file-indicator');
      if (contextIndicator) contextIndicator.textContent = `/${filePath}`;

      // Highlight active file in explorer
      document.querySelectorAll('.file-item').forEach((el) => {
        if (el.textContent.includes(filePath.split('/').pop() || filePath)) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });

      // Broadcast active file to socket
      if (window.WorkbenchSocket) {
        window.WorkbenchSocket.viewFile(filePath);
      }
    } catch (err) {
      editorEl.value = `Error loading file: ${err.message}`;
    }
  },

  switchMode(mode) {
    this.currentMode = mode;
    const editorEl = document.getElementById('file-editor-content');
    const previewEl = document.getElementById('file-markdown-preview');
    const rawBtn = document.getElementById('btn-mode-raw');
    const previewBtn = document.getElementById('btn-mode-preview');

    if (mode === 'preview') {
      this.renderPreview(editorEl.value);
      editorEl.style.display = 'none';
      previewEl.style.display = 'block';
      rawBtn?.classList.remove('active');
      previewBtn?.classList.add('active');
    } else {
      editorEl.style.display = 'block';
      previewEl.style.display = 'none';
      rawBtn?.classList.add('active');
      previewBtn?.classList.remove('active');
    }
  },

  renderPreview(markdownText) {
    const previewEl = document.getElementById('file-markdown-preview');
    if (!previewEl) return;

    previewEl.innerHTML = this.parseMarkdown(markdownText);
  },

  parseMarkdown(md) {
    if (!md) return '<p class="empty-state">No content to preview.</p>';

    // Escape HTML tags
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Fenced code blocks
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre class="code-block"><code class="lang-${lang}">${code}</code></pre>`;
    });

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Blockquotes
    html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Bold and Italics
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Bullet points
    html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, ''); // Join consecutive list items

    // Numbered lists
    html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<ol><li>$1</li></ol>');
    html = html.replace(/<\/ol>\s*<ol>/g, '');

    // Source Citations [source: path:lines] -> clickable badge
    html = html.replace(/\[source:\s*([^\]]+)\]/g, (match, pathAndLines) => {
      const cleanPath = pathAndLines.split(':')[0].trim();
      return `<span class="source-citation-badge" title="Click to view file in Company Brain" onclick="window.BrainView.openCitedSource('${cleanPath}')">🔍 ${match}</span>`;
    });

    // Paragraph breaks
    html = html.replace(/\n\n/g, '<br><br>');

    return `<div class="rendered-markdown-content">${html}</div>`;
  },

  openCitedSource(filePath) {
    const wsSelect = document.getElementById('workspace-select');
    const wsId = wsSelect?.value;
    if (wsId && filePath) {
      // Switch to Company Brain tab if not already on it
      const brainTabBtn = document.querySelector('[data-tab="brain-tab"]');
      if (brainTabBtn && !brainTabBtn.classList.contains('active')) {
        brainTabBtn.click();
      }
      this.openFile(wsId, filePath);
    }
  },

  async saveActiveFile(workspaceId) {
    if (!this.currentFile) return;
    const editorEl = document.getElementById('file-editor-content');
    const saveBtn = document.getElementById('btn-save-file');
    const conflictBanner = document.getElementById('file-conflict-banner');

    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    try {
      await window.WorkbenchApi.writeFile(workspaceId, this.currentFile, editorEl.value);
      this.lastLoadedContent = editorEl.value;
      this.hasUnsavedChanges = false;
      if (conflictBanner) conflictBanner.style.display = 'none';

      saveBtn.textContent = 'Saved!';
      setTimeout(() => {
        saveBtn.textContent = 'Save';
        saveBtn.disabled = false;
      }, 1500);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
      saveBtn.textContent = 'Save';
      saveBtn.disabled = false;
    }
  },

  downloadActiveFile(workspaceId) {
    if (!this.currentFile || !workspaceId) return;
    const token = localStorage.getItem('workbench_token') || '';
    const downloadUrl = `/api/workspaces/${workspaceId}/files/${this.currentFile}?download=true&token=${token}`;
    window.open(downloadUrl, '_blank');
  },

  exportWorkspaceZip(workspaceId) {
    if (!workspaceId) return;
    const token = localStorage.getItem('workbench_token') || '';
    const downloadUrl = `/api/workspaces/${workspaceId}/download?token=${token}`;
    window.open(downloadUrl, '_blank');
  },

  async importWorkspaceZip(workspaceId, file) {
    if (!file || !workspaceId) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = (e.target.result || '').toString().split(',')[1];
        const res = await window.WorkbenchApi.uploadZip(workspaceId, base64);
        alert(`Successfully imported ${res.importedCount} files into workspace!`);
        this.loadFiles(workspaceId);
      } catch (err) {
        alert(`Error importing archive: ${err.message}`);
      }
    };
    reader.readAsDataURL(file);
  },

  async openAnonymizer(workspaceId) {
    if (!this.currentFile || !workspaceId) return;
    const modal = document.getElementById('modal-anonymize');
    const previewArea = document.getElementById('anonymize-preview-text');
    const badge = document.getElementById('anonymize-badge-count');
    const fileLabel = document.getElementById('anonymize-file-label');

    if (modal) modal.style.display = 'flex';
    if (fileLabel) fileLabel.textContent = this.currentFile;
    if (previewArea) previewArea.value = 'Sanitizing document with AI...';

    const customEntitiesInput = document.getElementById('anonymize-custom-entities');
    const customEntities = customEntitiesInput?.value
      ? customEntitiesInput.value.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    try {
      const editorEl = document.getElementById('file-editor-content');
      const text = editorEl?.value || '';

      const res = await window.WorkbenchApi.anonymize(workspaceId, {
        text,
        customEntities
      });

      if (previewArea) previewArea.value = res.sanitizedText;
      if (badge) badge.textContent = `${res.totalRedactions} sensitive items redacted`;
    } catch (err) {
      if (previewArea) previewArea.value = `Anonymization error: ${err.message}`;
    }
  },

  handleExternalFileChanged(data) {
    if (!data || !data.filePath) return;
    if (data.filePath === this.currentFile) {
      const banner = document.getElementById('file-conflict-banner');
      if (banner) {
        banner.style.display = 'flex';
        const span = banner.querySelector('span');
        if (span) {
          const updaterName = data.updatedBy?.name || 'A collaborator';
          span.textContent = `⚡ "${data.filePath}" was updated by ${updaterName} just now.`;
        }
      }
    }
  },

  updateCollaborators(presences) {
    const bar = document.getElementById('file-collaborators-bar');
    if (!bar || !this.currentFile) return;

    const viewers = (presences || []).filter((p) => p.activeFile === this.currentFile);
    if (viewers.length === 0) {
      bar.innerHTML = '';
      return;
    }

    bar.innerHTML = `Viewing now: ${viewers.map((v) => `<span class="peer-tag">${v.name}</span>`).join(' ')}`;
  }
};
