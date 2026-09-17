/**
 * Antigravity API Client for V0 Engine Proof
 * Communicates directly with Express backend at /api
 */

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
  role: string;
  organizationId?: string | null;
}

export interface WorkspaceMemberUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
}

export interface WorkspaceMemberItem {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: WorkspaceMemberUser;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  description: string | null;
  role: string;
  organizationId: string;
  createdAt: string;
}

export interface VerifiedCitation {
  filePath: string;
  startLine: number;
  endLine: number;
  contentHash: string;
  retrievedAt: string;
  workspaceId: string;
  taskId: string;
  snippet: string;
}

export interface TaskResponse {
  taskId: string;
  status: 'COMPLETED' | 'FAILED' | 'PENDING' | 'RUNNING' | 'CANCELLED';
  answer?: string;
  citations?: Array<{ filePath: string; startLine?: number; endLine?: number; snippet?: string; contentHash?: string }>;
  verifiedCitations?: VerifiedCitation[];
}

export interface TaskEvent {
  id: string;
  type: string;
  payload: string; // JSON
  createdAt: string;
}

export interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  events: TaskEvent[];
  executions: any[];
}

export interface WorkspaceFileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  mtime?: string;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
  nextRoute: string;
}

export interface InviteInfo {
  id: string;
  token: string;
  email: string;
  role: string;
  organizationId: string;
  organizationName: string;
  workspaceId: string | null;
  workspaceName: string | null;
  expiresAt: string;
}

export interface GitHubRepoItem {
  id: number;
  name: string;
  fullName: string;
  owner: {
    login: string;
    avatarUrl?: string;
  };
  private: boolean;
  description: string | null;
  htmlUrl: string;
  defaultBranch: string;
  stargazersCount: number;
  updatedAt: string;
  language: string | null;
}

export interface ImportResult {
  success: boolean;
  count: number;
  files: string[];
  message: string;
}

export interface JoinCodeInfo {
  valid: boolean;
  organizationId: string;
  organizationName: string;
  workspaceId: string | null;
  workspaceName: string | null;
  role: string;
}

class ApiClient {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('anti_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data: AuthResponse = await res.json();
    localStorage.setItem('anti_token', data.token);
    return data;
  }

  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data: AuthResponse = await res.json();
    localStorage.setItem('anti_token', data.token);
    return data;
  }

  async getMe(): Promise<{ user: UserProfile; nextRoute: string }> {
    const res = await fetch('/api/auth/me', {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  }

  async updateProfile(data: { name?: string; avatarUrl?: string; currentPassword?: string; newPassword?: string }): Promise<{ user: UserProfile }> {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update profile' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async validateInvite(token: string): Promise<{ valid: boolean; invite: InviteInfo }> {
    const res = await fetch(`/api/invites/${token}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to validate invite' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async acceptInvite(token: string): Promise<{ success: boolean; organizationId: string; workspaceId?: string; nextRoute: string }> {
    const res = await fetch(`/api/invites/${token}/accept`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to accept invite' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async declineInvite(token: string): Promise<{ success: boolean; nextRoute: string }> {
    const res = await fetch(`/api/invites/${token}/decline`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to decline invite' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async validateJoinCode(code: string): Promise<JoinCodeInfo> {
    const res = await fetch(`/api/join-codes/${encodeURIComponent(code)}/validate`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Invalid join code' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async redeemJoinCode(code: string): Promise<{ success: boolean; organizationId: string; workspaceId?: string; nextRoute: string }> {
    const res = await fetch('/api/join-codes/redeem', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to redeem join code' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async createInvite(orgId: string, params: { email: string; role?: string; workspaceId?: string }): Promise<{ invite: { id: string; token: string; email: string; role: string; inviteUrl: string } }> {
    const res = await fetch(`/api/orgs/${orgId}/members/invite`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create invite' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async createJoinCode(orgId: string, params?: { role?: string; workspaceId?: string }): Promise<{ joinCode: { code: string } }> {
    const res = await fetch(`/api/orgs/${orgId}/join-codes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to generate join code' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async getWorkspaces(): Promise<WorkspaceSummary[]> {
    const res = await fetch('/api/workspaces', {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  }

  async getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberItem[]> {
    const res = await fetch(`/api/workspaces/${workspaceId}/members`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    return data.members || [];
  }

  async createWorkspace(params: { name: string; description?: string; template?: string; organizationId?: string }): Promise<WorkspaceSummary> {
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create workspace' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async listFiles(workspaceId: string, subpath: string = ''): Promise<WorkspaceFileEntry[]> {
    const cleanPath = subpath.replace(/^\/+/, '');
    const url = cleanPath ? `/api/workspaces/${workspaceId}/files/${cleanPath}` : `/api/workspaces/${workspaceId}/files`;
    const res = await fetch(url, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to list files' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.files || [];
  }

  async getRawFile(workspaceId: string, filePath: string): Promise<{ path: string; content: string }> {
    const cleanPath = filePath.replace(/^\/+/, '');
    const res = await fetch(`/api/workspaces/${workspaceId}/files/${cleanPath}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  }

  async saveFile(workspaceId: string, filePath: string, content: string): Promise<{ success: boolean; path: string }> {
    const cleanPath = filePath.replace(/^\/+/, '');
    const res = await fetch(`/api/workspaces/${workspaceId}/files/${cleanPath}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save file' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async deleteFile(workspaceId: string, filePath: string): Promise<{ success: boolean }> {
    const cleanPath = filePath.replace(/^\/+/, '');
    const res = await fetch(`/api/workspaces/${workspaceId}/files/${cleanPath}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete file' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async downloadWorkspaceZip(workspaceId: string): Promise<Blob> {
    const token = localStorage.getItem('anti_token');
    const res = await fetch(`/api/workspaces/${workspaceId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to download workspace archive`);
    }
    return res.blob();
  }

  async uploadWorkspaceZip(workspaceId: string, zipBase64: string): Promise<{ success: boolean; count: number; files: string[] }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/upload`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ zipBase64 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to upload workspace archive' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async createTask(workspaceId: string, prompt: string, title?: string): Promise<TaskResponse> {
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ prompt, title }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Task execution failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async getTask(workspaceId: string, taskId: string): Promise<TaskDetail> {
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks/${taskId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  }

  async listGitHubRepos(token?: string, search?: string): Promise<{ repos: GitHubRepoItem[]; isAuthenticated: boolean }> {
    const params = new URLSearchParams();
    if (token) params.set('token', token);
    if (search) params.set('q', search);
    const queryString = params.toString();
    const url = queryString ? `/api/github/repos?${queryString}` : '/api/github/repos';
    const res = await fetch(url, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      return { repos: [], isAuthenticated: false };
    }
    return res.json();
  }

  async importGitHubRepo(workspaceId: string, params: { fullName?: string; repoUrl?: string; branch?: string; token?: string }): Promise<ImportResult> {
    const res = await fetch(`/api/workspaces/${workspaceId}/import/github`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'GitHub repository import failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async importFiles(workspaceId: string, files: Array<{ name: string; content: string; path?: string }>): Promise<ImportResult> {
    const res = await fetch(`/api/workspaces/${workspaceId}/import/files`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ files }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'File import failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async updateWorkspace(workspaceId: string, data: { name?: string; description?: string }): Promise<WorkspaceSummary> {
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update workspace' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async listProposedChanges(workspaceId: string): Promise<any[]> {
    const res = await fetch(`/api/workspaces/${workspaceId}/changes`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      return [];
    }
    return res.json();
  }

  async createProposedChange(workspaceId: string, data: { filePath: string; proposedContent: string; description?: string }): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/changes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create proposed change' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async approveProposedChange(workspaceId: string, changeId: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/changes/${changeId}/approve`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to approve change' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async rejectProposedChange(workspaceId: string, changeId: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/changes/${changeId}/reject`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to reject change' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async getReadOnlyPaths(workspaceId: string): Promise<Array<{ id: string; path: string }>> {
    const res = await fetch(`/api/workspaces/${workspaceId}/readonly-paths`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      return [];
    }
    return res.json();
  }

  async addReadOnlyPath(workspaceId: string, path: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/readonly-paths`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ path }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to add read-only rule' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async removeWorkspaceMember(workspaceId: string, memberId: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to remove member' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async anonymizeData(workspaceId: string, data: { filePath?: string; text?: string; customEntities?: string[] }): Promise<{ success: boolean; anonymizedText: string; detections: any[] }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/anonymize`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to anonymize data' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ========== BYOK Credentials ==========
  async listCredentials(workspaceId?: string): Promise<Array<{ id: string; kind: string; provider: string; label: string; createdAt: string }>> {
    const params = workspaceId ? `?workspaceId=${workspaceId}` : '';
    const res = await fetch(`/api/credentials${params}`, { headers: this.getHeaders() });
    if (!res.ok) return [];
    return res.json();
  }

  async storeCredential(params: { provider: string; secret: string; kind?: string; label?: string; workspaceId?: string }): Promise<{ id: string; provider: string; label: string }> {
    const res = await fetch('/api/credentials', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to store credential' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async revokeCredential(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`/api/credentials/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to revoke credential' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ========== Data Connectors ==========
  async listConnectorSyncs(workspaceId: string): Promise<any[]> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors`, { headers: this.getHeaders() });
    if (!res.ok) return [];
    return res.json();
  }

  async syncTribalMemory(workspaceId: string, entries: Array<{ title: string; content: string; author?: string; tags?: string[] }>): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/tribal/sync`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ entries }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Tribal memory sync failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async syncDrive(workspaceId: string, params: { accessToken: string; folderId?: string }): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/drive/sync`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Drive sync failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async syncJira(workspaceId: string, params: { baseUrl: string; email: string; apiToken: string; jql?: string }): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/jira/sync`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Jira sync failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async syncSlack(workspaceId: string, params: { botToken: string; channelIds: string[] }): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/slack/sync`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Slack sync failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ========== ICM Templates ==========
  async listIcmTemplates(): Promise<Array<{ id: string; name: string; description: string; fileCount: number; folders: string[] }>> {
    const res = await fetch('/api/icm/templates', { headers: this.getHeaders() });
    if (!res.ok) return [];
    return res.json();
  }

  async applyIcmTemplate(workspaceId: string, templateId: string): Promise<{ success: boolean; fileCount: number; files: string[] }> {
    const res = await fetch('/api/icm/apply', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ workspaceId, templateId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to apply template' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  logout() {
    localStorage.removeItem('anti_token');
  }
}

export const api = new ApiClient();

