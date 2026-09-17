// Multiplayer AI View Module (Embedded Single-Agent Navigation & Collaboration)
window.MultiplayerView = {
  activeThreadId: null,

  async loadThreads(workspaceId) {
    const listContainer = document.getElementById('thread-list-container');
    if (listContainer && workspaceId) {
      try {
        const threads = await window.WorkbenchApi.getThreads(workspaceId);
        listContainer.innerHTML = '';
        if (threads && threads.length > 0) {
          threads.forEach((t) => {
            const item = document.createElement('div');
            item.className = `file-item ${t.id === this.activeThreadId ? 'active' : ''}`;
            item.innerHTML = `<span>💬</span> <span>${t.title}</span>`;
            item.onclick = () => this.selectThread(workspaceId, t.id, t.title);
            listContainer.appendChild(item);
          });
        }
      } catch (err) {
        // silent fail if threads not in use
      }
    }
  },

  async selectThread(workspaceId, threadId, title) {
    this.activeThreadId = threadId;
    const messagesContainer = document.getElementById('chat-messages-container');
    if (!messagesContainer) return;

    try {
      const messages = await window.WorkbenchApi.getMessages(workspaceId, threadId);
      messagesContainer.innerHTML = '';

      if (messages.length === 0) {
        messagesContainer.innerHTML = `
          <div class="ai-message-card assistant">
            <div class="ai-message-header">
              <span>SINGLE-AGENT HARNESS</span>
              <span class="mono-tag">READY</span>
            </div>
            <div>Ask a question or request an action across this workspace's documents.</div>
          </div>
        `;
        return;
      }

      messages.forEach((msg) => this.renderMessage(msg));
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (err) {
      messagesContainer.innerHTML = `<div class="empty-state error">Error: ${err.message}</div>`;
    }
  },

  renderMessage(msg) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    const msgEl = document.createElement('div');
    const isAssistant = msg.author?.name?.toLowerCase().includes('ai') || msg.role === 'assistant';
    msgEl.className = `ai-message-card ${isAssistant ? 'assistant' : 'user'}`;

    let text = msg.content || '';
    
    // Extract sources if any
    const sources = [];
    text = text.replace(/\[source:\s*([^\]]+)\]/g, (match, p1) => {
      const cleanPath = p1.split(':')[0].trim();
      const lines = p1.includes(':') ? p1.split(':')[1].trim() : '';
      sources.push({ path: cleanPath, lines });
      return `<span class="source-citation-badge" title="Click to view file in Company Brain" onclick="window.BrainView.openCitedSource('${cleanPath}')">🔍 ${match}</span>`;
    });

    const authorName = msg.author?.name || (isAssistant ? 'AI HARNESS' : 'YOU');
    const headerHtml = `
      <div class="ai-message-header">
        <span>${authorName}</span>
        <span class="mono-tag">${isAssistant ? 'GROUNDED' : 'QUERY'}</span>
      </div>
    `;

    let sourcesHtml = '';
    if (sources.length > 0) {
      sourcesHtml = `
        <div class="ai-source-box">
          <span class="title">VERIFIED CITATIONS & PROVENANCE</span>
          ${sources.map((s) => `
            <div class="source-item-row">
              <span>📄 ${s.path} ${s.lines ? `(lines ${s.lines})` : ''}</span>
              <button class="btn-open-source" onclick="window.BrainView.openCitedSource('${s.path}')">Open source &rarr;</button>
            </div>
          `).join('')}
        </div>
      `;
    }

    msgEl.innerHTML = `${headerHtml}<div>${text}</div>${sourcesHtml}`;
    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
  },

  async sendMessage(workspaceId) {
    const inputEl = document.getElementById('chat-input');
    if (!inputEl) return;
    const content = inputEl.value.trim();
    if (!content || !workspaceId) return;

    inputEl.value = '';

    // Render user message immediately
    this.renderMessage({
      content,
      author: { name: window.WorkbenchUser?.name || 'You' },
      role: 'user'
    });

    const statusEl = document.getElementById('ai-status');
    const providerSelect = document.getElementById('model-provider-select');
    const providerName = providerSelect ? providerSelect.options[providerSelect.selectedIndex].text : 'AI';
    if (statusEl) statusEl.textContent = `${providerName.split(' ')[0]} NAVIGATING...`;

    try {
      // Execute AI task with single-agent navigation harness
      const res = await window.WorkbenchApi.runTask(workspaceId, content);
      if (statusEl) statusEl.textContent = 'AI HARNESS // READY';

      this.renderMessage({
        content: res.answer || 'Task completed.',
        author: { name: `AI Brain (${providerName.split(' ')[0]})` },
        role: 'assistant'
      });
    } catch (err) {
      if (statusEl) statusEl.textContent = 'AI HARNESS // READY';
      this.renderMessage({
        content: `Error: ${err.message}`,
        author: { name: 'System' },
        role: 'assistant'
      });
    }
  },

  sendSuggestedPrompt(promptText) {
    const input = document.getElementById('chat-input');
    const wsSelect = document.getElementById('workspace-select');
    const wsId = wsSelect?.value;
    if (input && wsId) {
      // If currently active file exists, prepend it for exact context
      const activeFile = window.BrainView?.currentFile;
      let finalPrompt = promptText;
      if (activeFile && (promptText.includes('this active document') || promptText.includes('this file'))) {
        finalPrompt = `${promptText} in /${activeFile}`;
      }
      input.value = finalPrompt;
      this.sendMessage(wsId);
    }
  }
};
