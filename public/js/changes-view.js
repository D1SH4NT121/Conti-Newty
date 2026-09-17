// Review & Approvals View Module
window.ChangesView = {
  activeChangeId: null,

  async loadProposals(workspaceId) {
    const listContainer = document.getElementById('proposals-list-container');
    const badgeEl = document.getElementById('pending-changes-badge');
    if (!listContainer || !workspaceId) return;

    try {
      const changes = await window.WorkbenchApi.getChanges(workspaceId);
      const pending = (changes || []).filter((c) => c.status === 'PENDING');
      if (badgeEl) badgeEl.textContent = pending.length;

      if (pending.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">No pending proposals</div>';
        return;
      }

      listContainer.innerHTML = '';
      pending.forEach((change) => {
        const item = document.createElement('div');
        item.className = `file-item ${change.id === this.activeChangeId ? 'active' : ''}`;
        item.innerHTML = `<span>⚖️</span> <span>${change.filePath}</span>`;
        item.onclick = () => this.selectProposal(workspaceId, change);
        listContainer.appendChild(item);
      });

      if (!this.activeChangeId && pending.length > 0) {
        this.selectProposal(workspaceId, pending[0]);
      }
    } catch (err) {
      listContainer.innerHTML = `<div class="empty-state error">Error loading changes: ${err.message}</div>`;
    }
  },

  selectProposal(workspaceId, change) {
    this.activeChangeId = change.id;
    document.getElementById('diff-file-title').textContent = `Proposal: ${change.filePath} (${change.description || 'No description'})`;
    const actionsGroup = document.getElementById('approval-actions-group');
    actionsGroup.style.display = 'flex';

    const diffContentEl = document.getElementById('diff-code-content');
    const lines = (change.diff || '').split('\n');

    diffContentEl.innerHTML = lines
      .map((line) => {
        if (line.startsWith('+')) return `<div class="diff-line-add">${escapeHtml(line)}</div>`;
        if (line.startsWith('-')) return `<div class="diff-line-del">${escapeHtml(line)}</div>`;
        return `<div>${escapeHtml(line)}</div>`;
      })
      .join('');
  },

  async approveActiveChange(workspaceId) {
    if (!this.activeChangeId || !workspaceId) return;
    try {
      await window.WorkbenchApi.approveChange(workspaceId, this.activeChangeId);
      alert('Change approved and successfully merged!');
      this.activeChangeId = null;
      document.getElementById('approval-actions-group').style.display = 'none';
      document.getElementById('diff-code-content').textContent = 'No diff loaded.';
      await this.loadProposals(workspaceId);
      if (window.BrainView) {
        window.BrainView.loadFiles(workspaceId);
      }
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    }
  },

  async rejectActiveChange(workspaceId) {
    if (!this.activeChangeId || !workspaceId) return;
    const reason = prompt('Reason for rejection:', 'Not approved');
    if (reason === null) return;

    try {
      await window.WorkbenchApi.rejectChange(workspaceId, this.activeChangeId, reason);
      alert('Change proposal rejected.');
      this.activeChangeId = null;
      document.getElementById('approval-actions-group').style.display = 'none';
      document.getElementById('diff-code-content').textContent = 'No diff loaded.';
      await this.loadProposals(workspaceId);
    } catch (err) {
      alert(`Rejection error: ${err.message}`);
    }
  }
};

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
