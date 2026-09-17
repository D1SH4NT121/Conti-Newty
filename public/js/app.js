// Global Workbench Controller & API Client
(function () {
  const API_BASE = '/api';
  let currentWorkspaceId = null;
  let currentOrgId = null;
  let authToken = localStorage.getItem('workbench_token') || '';

  // ========================================================================
  // API CLIENT
  // ========================================================================
  window.WorkbenchApi = {
    async request(endpoint, options = {}) {
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }

      return res.json();
    },

    getOrgs() { return this.request('/orgs'); },
    getOrgMembers(orgId) { return this.request(`/orgs/${orgId}/members`); },
    getOrgWorkspaces(orgId) { return this.request(`/orgs/${orgId}/workspaces`); },
    bulkInvite(orgId, emails, role) {
      return this.request(`/orgs/${orgId}/invites`, {
        method: 'POST',
        body: JSON.stringify({ emails, role })
      });
    },

    getWorkspaces() { return this.request('/workspaces'); },
    createWorkspace(name, orgId, template = 'icm') {
      return this.request('/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name, organizationId: orgId, template })
      });
    },

    getFiles(wsId) { return this.request(`/workspaces/${wsId}/files`); },
    readFile(wsId, path) { return this.request(`/workspaces/${wsId}/files/${path}`); },
    writeFile(wsId, path, content) {
      return this.request(`/workspaces/${wsId}/files/${path}`, {
        method: 'PUT',
        body: JSON.stringify({ content })
      });
    },
    uploadZip(wsId, zipBase64) {
      return this.request(`/workspaces/${wsId}/upload`, {
        method: 'POST',
        body: JSON.stringify({ zipBase64 })
      });
    },
    anonymize(wsId, data) {
      return this.request(`/workspaces/${wsId}/anonymize`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    getThreads(wsId) { return this.request(`/workspaces/${wsId}/threads`); },
    createThread(wsId, title) {
      return this.request(`/workspaces/${wsId}/threads`, {
        method: 'POST',
        body: JSON.stringify({ title })
      });
    },
    getMessages(wsId, threadId) { return this.request(`/workspaces/${wsId}/threads/${threadId}/messages`); },
    sendMessage(wsId, threadId, content) {
      return this.request(`/workspaces/${wsId}/threads/${threadId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
    },

    runTask(wsId, prompt) {
      return this.request(`/workspaces/${wsId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({ prompt })
      });
    },

    getApps(wsId) { return this.request(`/workspaces/${wsId}/apps`); },
    getApp(wsId, appId) { return this.request(`/workspaces/${wsId}/apps/${appId}`); },
    generateApp(wsId, prompt, appType) {
      return this.request(`/workspaces/${wsId}/apps`, {
        method: 'POST',
        body: JSON.stringify({ prompt, appType })
      });
    },

    getChanges(wsId) { return this.request(`/workspaces/${wsId}/changes`); },
    proposeChange(wsId, filePath, proposedContent, description) {
      return this.request(`/workspaces/${wsId}/changes`, {
        method: 'POST',
        body: JSON.stringify({ filePath, proposedContent, description })
      });
    },
    approveChange(wsId, changeId) {
      return this.request(`/workspaces/${wsId}/changes/${changeId}/approve`, {
        method: 'POST'
      });
    },
    rejectChange(wsId, changeId, reason) {
      return this.request(`/workspaces/${wsId}/changes/${changeId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason })
      });
    }
  };

  // ========================================================================
  // SOCKET.IO REAL-TIME CLIENT
  // ========================================================================
  let socket = null;
  window.WorkbenchSocket = {
    init(workspaceId, user) {
      if (typeof io === 'undefined') return;
      if (socket) socket.disconnect();

      socket = io();

      socket.on('connect', () => {
        socket.emit('workspace.join', {
          workspaceId,
          user: user || { id: 'u_guest', name: 'Collaborator', email: 'peer@company.com' }
        });
      });

      socket.on('presence.update', (data) => {
        this.renderPresence(data.users || []);
        window.BrainView?.updateCollaborators(data.users || []);
      });

      socket.on('file.changed', (data) => {
        window.BrainView?.handleExternalFileChanged(data);
      });

      socket.on('task.event', (data) => {
        const statusEl = document.getElementById('ai-status');
        if (statusEl) {
          statusEl.textContent = `AI: ${data.event.type} (${data.event.tool || 'navigating'})`;
        }
      });
    },

    viewFile(filePath) {
      if (socket && currentWorkspaceId) {
        socket.emit('file.view', { workspaceId: currentWorkspaceId, filePath });
      }
    },

    renderPresence(users) {
      const container = document.getElementById('avatar-group');
      if (!container) return;

      container.innerHTML = '';
      users.forEach((u) => {
        const dot = document.createElement('div');
        const isSelf = u.id === window.WorkbenchUser?.id;
        dot.className = `avatar ${isSelf ? 'avatar-self' : ''}`;
        dot.title = `${u.name} (${u.role || 'Member'})`;
        dot.textContent = u.name.slice(0, 8);
        container.appendChild(dot);
      });
    }
  };

  // ========================================================================
  // WORKBENCH APP INITIALIZATION
  // ========================================================================
  async function init() {
    // Determine user session
    window.WorkbenchUser = {
      id: localStorage.getItem('workbench_user_id') || 'u-founder',
      name: localStorage.getItem('workbench_user_name') || 'Lead Architect',
      role: 'ADMIN'
    };

    const userDisplay = document.getElementById('user-display-name');
    if (userDisplay) userDisplay.textContent = window.WorkbenchUser.name.toUpperCase();

    // Load initial workbenches and orgs
    await loadInitialData();

    // Event listeners
    setupEventListeners();
    setupCommandPalette();
  }

  async function loadInitialData() {
    try {
      const orgs = await window.WorkbenchApi.getOrgs();
      if (orgs && orgs.length > 0) {
        currentOrgId = orgs[0].id;
      }
      await reloadWorkspaces();
      if (currentOrgId) {
        loadOrgGovernance(currentOrgId);
      }
    } catch (err) {
      console.warn('Initial data load warning:', err.message);
    }
  }

  async function reloadWorkspaces() {
    try {
      const workspaces = await window.WorkbenchApi.getWorkspaces();
      const selectEl = document.getElementById('workspace-select');
      if (!selectEl) return;
      selectEl.innerHTML = '';

      if (workspaces.length === 0) {
        selectEl.innerHTML = '<option value="">No workbenches found</option>';
        return;
      }

      workspaces.forEach((ws) => {
        const opt = document.createElement('option');
        opt.value = ws.id;
        opt.textContent = `${ws.name} (${ws.role || 'Admin'})`;
        selectEl.appendChild(opt);
      });

      if (!currentWorkspaceId || !workspaces.find((w) => w.id === currentWorkspaceId)) {
        currentWorkspaceId = workspaces[0].id;
      }
      selectEl.value = currentWorkspaceId;
      selectWorkspace(currentWorkspaceId);

      selectEl.onchange = (e) => {
        currentWorkspaceId = e.target.value;
        selectWorkspace(currentWorkspaceId);
      };
    } catch (err) {
      console.error('Error loading workbenches:', err);
    }
  }

  function selectWorkspace(workspaceId) {
    if (!workspaceId) return;
    window.BrainView?.loadFiles(workspaceId);
    window.MultiplayerView?.loadThreads(workspaceId);
    window.AppsView?.loadApps(workspaceId);
    window.ChangesView?.loadProposals(workspaceId);
    window.WorkbenchSocket?.init(workspaceId, window.WorkbenchUser);
  }

  // ========================================================================
  // ORGANIZATION & TEAMS GOVERNANCE
  // ========================================================================
  async function loadOrgGovernance(orgId) {
    if (!orgId) return;
    const wbContainer = document.getElementById('org-workbenches-container');
    const mbContainer = document.getElementById('org-members-container');

    try {
      // Workbenches
      const wbs = await window.WorkbenchApi.getOrgWorkspaces(orgId);
      if (wbContainer) {
        if (!wbs || wbs.length === 0) {
          wbContainer.innerHTML = '<div class="empty-state">No workbenches under this organization.</div>';
        } else {
          wbContainer.innerHTML = wbs.map((w) => `
            <div style="padding:0.75rem 1rem; border:1px solid var(--rule-subtle); background:var(--paper-surface); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>${w.name}</strong>
                <p style="font-size:0.75rem; color:var(--ink-secondary); margin-top:2px;">${w.description || 'Isolated Docker container'}</p>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="window.WorkbenchController?.switchWorkbench('${w.id}')">Open &rarr;</button>
            </div>
          `).join('');
        }
      }

      // Members
      const members = await window.WorkbenchApi.getOrgMembers(orgId);
      if (mbContainer) {
        if (!members || members.length === 0) {
          mbContainer.innerHTML = '<div class="empty-state">No members found.</div>';
        } else {
          mbContainer.innerHTML = members.map((m) => `
            <div style="padding:0.75rem 1rem; border:1px solid var(--rule-subtle); background:var(--paper-surface); display:flex; justify-content:space-between; align-items:center;">
              <div>
                <strong>${m.name}</strong>
                <span class="mono-label" style="display:block; font-size:0.7rem; color:var(--ink-muted);">${m.email}</span>
              </div>
              <span class="mono-tag">${m.role}</span>
            </div>
          `).join('');
        }
      }
    } catch (err) {
      console.warn('Error loading governance:', err.message);
    }
  }

  // ========================================================================
  // COMMAND PALETTE (CMD+K / CTRL+K)
  // ========================================================================
  function setupCommandPalette() {
    const modal = document.getElementById('modal-command-palette');
    const searchInput = document.getElementById('palette-search-input');
    const resultsContainer = document.getElementById('palette-results-list');
    const triggerBtn = document.getElementById('btn-command-palette-trigger');

    function openPalette() {
      if (!modal) return;
      modal.style.display = 'flex';
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      renderPaletteResults('');
    }

    function closePalette() {
      if (modal) modal.style.display = 'none';
    }

    triggerBtn?.addEventListener('click', openPalette);

    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (modal?.style.display === 'flex') closePalette();
        else openPalette();
      } else if (e.key === 'Escape' && modal?.style.display === 'flex') {
        closePalette();
      }
    });

    searchInput?.addEventListener('input', (e) => {
      renderPaletteResults(e.target.value);
    });

    async function renderPaletteResults(query) {
      if (!resultsContainer) return;
      const q = query.toLowerCase().trim();

      // Gather files in current workspace
      let files = [];
      try {
        if (currentWorkspaceId) {
          const res = await window.WorkbenchApi.getFiles(currentWorkspaceId);
          files = (res.files || []).filter((f) => !f.isDirectory);
        }
      } catch (e) {}

      // Built-in actions
      const actions = [
        { label: 'Create New Markdown Document', action: () => openModal('modal-new-file'), shortcut: 'N' },
        { label: 'Import Folder / ZIP Archive', action: () => document.getElementById('btn-import-zip')?.click(), shortcut: 'I' },
        { label: 'Export Workspace as ZIP Archive', action: () => document.getElementById('btn-export-zip')?.click(), shortcut: 'E' },
        { label: 'Anonymize Active Document for Sharing', action: () => document.getElementById('btn-anonymize-file')?.click(), shortcut: 'A' },
        { label: 'Propose Change with Line Diff', action: () => document.getElementById('btn-propose-file-change')?.click(), shortcut: 'P' },
        { label: 'Generate Micro-App in Small Software Cloud', action: () => switchTab('apps-tab'), shortcut: 'G' },
        { label: 'Manage Organization & Bulk Invites', action: () => openModal('modal-bulk-invites'), shortcut: 'B' },
        { label: 'Switch AI Model: Claude 3.5 Sonnet', action: () => setAiModel('claude'), shortcut: '1' },
        { label: 'Switch AI Model: Gemini 1.5 Pro', action: () => setAiModel('gemini'), shortcut: '2' },
        { label: 'Switch AI Model: OpenAI Codex / GPT-4o', action: () => setAiModel('openai'), shortcut: '3' }
      ];

      const filteredFiles = files.filter((f) => !q || f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
      const filteredActions = actions.filter((a) => !q || a.label.toLowerCase().includes(q));

      let html = '';

      if (filteredFiles.length > 0) {
        html += `<div class="palette-group-title">WORKSPACE DOCUMENTS</div>`;
        filteredFiles.forEach((f) => {
          html += `
            <div class="palette-item" onclick="window.WorkbenchController.openPaletteFile('${f.path}')">
              <span>📄 ${f.path}</span>
              <span class="palette-shortcut">Jump &rarr;</span>
            </div>
          `;
        });
      }

      if (filteredActions.length > 0) {
        html += `<div class="palette-group-title">ACTIONS & TOOLS</div>`;
        filteredActions.forEach((a, idx) => {
          html += `
            <div class="palette-item" onclick="window.WorkbenchController.runPaletteAction(${idx})">
              <span>⚙️ ${a.label}</span>
              <span class="palette-shortcut">${a.shortcut}</span>
            </div>
          `;
        });
      }

      if (!html) {
        html = '<div class="empty-state">No matching files or commands found.</div>';
      }

      resultsContainer.innerHTML = html;
      window._activePaletteActions = filteredActions;
    }

    function setAiModel(model) {
      const select = document.getElementById('model-provider-select');
      if (select) {
        select.value = model;
        alert(`AI Engine set to: ${select.options[select.selectedIndex].text}`);
      }
      closePalette();
    }
  }

  // ========================================================================
  // EVENT LISTENERS & CONTROLLERS
  // ========================================================================
  function setupEventListeners() {
    // Navigation Tabs
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        switchTab(tabId);
      });
    });

    // File Editor Actions
    document.getElementById('btn-save-file')?.addEventListener('click', () => {
      window.BrainView?.saveActiveFile(currentWorkspaceId);
    });

    document.getElementById('btn-download-file')?.addEventListener('click', () => {
      window.BrainView?.downloadActiveFile(currentWorkspaceId);
    });

    document.getElementById('btn-export-zip')?.addEventListener('click', () => {
      window.BrainView?.exportWorkspaceZip(currentWorkspaceId);
    });

    document.getElementById('btn-import-zip')?.addEventListener('click', () => {
      document.getElementById('file-zip-input')?.click();
    });

    document.getElementById('file-zip-input')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file && currentWorkspaceId) {
        window.BrainView?.importWorkspaceZip(currentWorkspaceId, file);
      }
    });

    document.getElementById('btn-anonymize-file')?.addEventListener('click', () => {
      window.BrainView?.openAnonymizer(currentWorkspaceId);
    });

    document.getElementById('btn-mode-raw')?.addEventListener('click', () => {
      window.BrainView?.switchMode('raw');
    });

    document.getElementById('btn-mode-preview')?.addEventListener('click', () => {
      window.BrainView?.switchMode('preview');
    });

    document.getElementById('btn-reload-file-content')?.addEventListener('click', () => {
      if (window.BrainView?.currentFile && currentWorkspaceId) {
        window.BrainView.openFile(currentWorkspaceId, window.BrainView.currentFile);
      }
    });

    // Propose Change
    document.getElementById('btn-propose-file-change')?.addEventListener('click', async () => {
      const activeFile = window.BrainView?.currentFile;
      const content = document.getElementById('file-editor-content')?.value;
      if (!activeFile || !content || !currentWorkspaceId) return;

      const desc = prompt('Describe the purpose of this proposed modification:');
      if (desc === null) return;

      try {
        await window.WorkbenchApi.proposeChange(currentWorkspaceId, activeFile, content, desc || 'Proposed update');
        alert('Proposal submitted for human review!');
        window.ChangesView?.loadProposals(currentWorkspaceId);
      } catch (err) {
        alert(`Failed to submit proposal: ${err.message}`);
      }
    });

    // Chat events
    document.getElementById('btn-send-message')?.addEventListener('click', () => {
      window.MultiplayerView?.sendMessage(currentWorkspaceId);
    });

    document.getElementById('chat-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        window.MultiplayerView?.sendMessage(currentWorkspaceId);
      }
    });

    // App generation
    document.getElementById('btn-generate-app')?.addEventListener('click', () => {
      window.AppsView?.generateApp(currentWorkspaceId);
    });

    // Change approvals
    document.getElementById('btn-approve-change')?.addEventListener('click', () => {
      window.ChangesView?.approveActiveChange(currentWorkspaceId);
    });

    document.getElementById('btn-reject-change')?.addEventListener('click', () => {
      window.ChangesView?.rejectActiveChange(currentWorkspaceId);
    });

    // Modals
    setupModals();
  }

  function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'));

    const activeBtn = document.querySelector(`[data-tab="${tabId}"]`);
    const activeContent = document.getElementById(tabId);

    if (activeBtn) activeBtn.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
  }

  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'flex';
  }

  function setupModals() {
    // New Workspace Modal
    document.getElementById('btn-new-workspace')?.addEventListener('click', () => {
      openModal('modal-new-workspace');
    });

    document.getElementById('btn-confirm-create-ws')?.addEventListener('click', async () => {
      const nameInput = document.getElementById('new-ws-name');
      const icmCheck = document.getElementById('new-ws-icm-template');
      const name = nameInput?.value?.trim();
      if (!name) {
        alert('Please enter a workbench name');
        return;
      }

      try {
        const template = icmCheck?.checked ? 'icm' : undefined;
        await window.WorkbenchApi.createWorkspace(name, currentOrgId || 'default-org', template);
        document.getElementById('modal-new-workspace').style.display = 'none';
        nameInput.value = '';
        await reloadWorkspaces();
        alert(`Workbench "${name}" initialized with ICM folders!`);
      } catch (err) {
        alert(`Failed to create workspace: ${err.message}`);
      }
    });

    // New Document Modal
    document.getElementById('btn-create-file')?.addEventListener('click', () => {
      openModal('modal-new-file');
    });

    document.getElementById('btn-confirm-create-file')?.addEventListener('click', async () => {
      const pathInput = document.getElementById('new-file-path');
      const contentInput = document.getElementById('new-file-content');
      const path = pathInput?.value?.trim();
      const content = contentInput?.value || '# New Document\n';

      if (!path || !currentWorkspaceId) {
        alert('Please specify a file path (e.g. sops/incident_response.md)');
        return;
      }

      try {
        await window.WorkbenchApi.writeFile(currentWorkspaceId, path, content);
        document.getElementById('modal-new-file').style.display = 'none';
        pathInput.value = '';
        contentInput.value = '';
        await window.BrainView?.loadFiles(currentWorkspaceId);
        window.BrainView?.openFile(currentWorkspaceId, path);
      } catch (err) {
        alert(`Error creating file: ${err.message}`);
      }
    });

    // Bulk Invites Modal
    document.getElementById('btn-open-org-invites')?.addEventListener('click', () => {
      openModal('modal-bulk-invites');
    });

    document.getElementById('btn-modal-bulk-invites')?.addEventListener('click', () => {
      openModal('modal-bulk-invites');
    });

    document.getElementById('btn-confirm-bulk-invites')?.addEventListener('click', async () => {
      const emailText = document.getElementById('bulk-invite-emails')?.value || '';
      const role = document.getElementById('bulk-invite-role')?.value || 'MEMBER';
      const emails = emailText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

      if (emails.length === 0 || !currentOrgId) {
        alert('Please enter at least one valid email address.');
        return;
      }

      try {
        const res = await window.WorkbenchApi.bulkInvite(currentOrgId, emails, role);
        alert(`Successfully sent invitations to ${res.invited?.length || emails.length} members!`);
        document.getElementById('modal-bulk-invites').style.display = 'none';
        document.getElementById('bulk-invite-emails').value = '';
        if (currentOrgId) loadOrgGovernance(currentOrgId);
      } catch (err) {
        alert(`Bulk invite error: ${err.message}`);
      }
    });

    // Close buttons for modals
    document.querySelectorAll('.btn-close-modal').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-modal');
        const targetModal = document.getElementById(modalId);
        if (targetModal) targetModal.style.display = 'none';
      });
    });

    // Anonymize Copy and Download
    document.getElementById('btn-copy-anonymized')?.addEventListener('click', () => {
      const previewText = document.getElementById('anonymize-preview-text')?.value;
      if (previewText) {
        navigator.clipboard.writeText(previewText).then(() => alert('Sanitized markdown copied to clipboard!'));
      }
    });

    document.getElementById('btn-download-anonymized')?.addEventListener('click', () => {
      const previewText = document.getElementById('anonymize-preview-text')?.value;
      if (previewText) {
        const blob = new Blob([previewText], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sanitized-briefing.md';
        a.click();
      }
    });
  }

  // Global controller methods for inline handlers
  window.WorkbenchController = {
    openPaletteFile(filePath) {
      document.getElementById('modal-command-palette').style.display = 'none';
      switchTab('brain-tab');
      if (currentWorkspaceId && filePath) {
        window.BrainView?.openFile(currentWorkspaceId, filePath);
      }
    },

    runPaletteAction(index) {
      document.getElementById('modal-command-palette').style.display = 'none';
      const action = window._activePaletteActions?.[index];
      if (action && action.action) action.action();
    },

    switchWorkbench(wsId) {
      currentWorkspaceId = wsId;
      const select = document.getElementById('workspace-select');
      if (select) select.value = wsId;
      selectWorkspace(wsId);
      switchTab('brain-tab');
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
