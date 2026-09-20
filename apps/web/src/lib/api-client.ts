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

export interface AgentConfig {
  role: string;
  provider: 'claude' | 'openai' | 'gemini' | 'bedrock';
  systemPrompt?: string;
  /** Explicit model override for this relay step (e.g. "gpt-4o-mini"). If omitted, cost routing applies automatically. */
  model?: string;
}

export interface AgentTurn {
  agentRole: string;
  provider: string;
  answer: string;
  citations: Array<{ filePath: string; startLine?: number; endLine?: number; snippet?: string; contentHash?: string }>;
  verifiedCitations: VerifiedCitation[];
}

export interface TaskResponse {
  taskId: string;
  status: 'COMPLETED' | 'FAILED' | 'PENDING' | 'RUNNING' | 'CANCELLED';
  answer?: string;
  citations?: Array<{ filePath: string; startLine?: number; endLine?: number; snippet?: string; contentHash?: string }>;
  verifiedCitations?: VerifiedCitation[];
  turns?: AgentTurn[];
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

export interface SessionEvent {
  id?: string;
  type: string;
  actorId?: string | null;
  payload?: any;
  createdAt?: string | Date;
}

export interface SessionParticipant {
  id: string;
  userId: string;
  role: string;
  joinedAt?: string;
  user?: {
    id: string;
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
  };
}

export interface SessionDetail {
  id: string;
  workspaceId: string;
  title: string;
  goal: string;
  status: string;
  driverId?: string | null;
  currentDriverId?: string | null;
  activeDriverRequestId?: string | null;
  createdAt: string;
  updatedAt: string;
  participants: SessionParticipant[];
  events: SessionEvent[];
  appliedSkills?: any[];
}

export interface SkillEntry {
  id: string;
  workspaceId: string;
  stableId: string;
  status: 'TENTATIVE' | 'CONFIRMED' | 'REJECTED' | 'SUPERSEDED' | string;
  rule: string;
  rationale: string;
  triggerPattern: string;
  exampleSnippet?: string | null;
  confidence: number;
  originSessionId?: string | null;
  createdAt: string;
  updatedAt: string;
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
  private getAnonymousIdentity(): { id: string; displayName: string } {
    const idKey = 'anti_anonymous_id';
    const nameKey = 'anti_display_name';
    let id = localStorage.getItem(idKey);
    if (!id) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2))
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .slice(0, 64);
      localStorage.setItem(idKey, id);
    }
    return { id, displayName: localStorage.getItem(nameKey) || 'Guest' };
  }

  setDisplayName(displayName: string): void {
    const value = displayName.trim().slice(0, 80);
    if (value) localStorage.setItem('anti_display_name', value);
  }

  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('anti_token');
    const identity = this.getAnonymousIdentity();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-anonymous-id': identity.id,
      'x-display-name': identity.displayName,
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

  async getWorkspace(workspaceId: string): Promise<WorkspaceSummary> {
    const res = await fetch(`/api/workspaces/${workspaceId}`, { headers: this.getHeaders() });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to load workspace' }));
      throw new Error(err.error || `HTTP ${res.status}`);
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
    return Array.isArray(data) ? data : (data.members || []);
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

  async listFiles(workspaceId: string, subpath: string = '', recursive = false): Promise<WorkspaceFileEntry[]> {
    const cleanPath = subpath.replace(/^\/+/, '');
    const baseUrl = cleanPath ? `/api/workspaces/${workspaceId}/files/${cleanPath}` : `/api/workspaces/${workspaceId}/files`;
    const url = recursive ? `${baseUrl}?recursive=true` : baseUrl;
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

  async downloadWorkspaceZip(workspaceId: string): Promise<string> {
    const token = localStorage.getItem('anti_token');
    const res = await fetch(`/api/workspaces/${workspaceId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Failed to download workspace archive`);
    }
    const data = await res.json();
    return data.url;
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

  async seedWorkspace(workspaceId: string, template = 'founder'): Promise<{ success: boolean; fileCount: number; files: string[] }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/seed`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ template }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Seed failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async listApps(workspaceId: string): Promise<Array<{ id: string; name: string; slug: string | null; description: string | null; previewUrl: string; shareUrl: string | null; createdAt: string; deployments: Array<{ status: string }> }>> {
    const res = await fetch(`/api/workspaces/${workspaceId}/apps`, { headers: this.getHeaders() });
    if (!res.ok) return [];
    return res.json();
  }

  async generateApp(workspaceId: string, params: { prompt: string; appType?: string; appName?: string }): Promise<{ appWorkspaceId: string; name: string; slug: string; previewUrl: string; shareUrl: string; status: string }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/apps`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'App generation failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async listTasks(workspaceId: string, limit = 10): Promise<Array<{ id: string; title: string; status: string; createdAt: string; updatedAt: string }>> {
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks?limit=${limit}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  }

  async createTask(workspaceId: string, prompt: string, title?: string, agents?: AgentConfig[]): Promise<TaskResponse> {
    const res = await fetch(`/api/workspaces/${workspaceId}/tasks`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ prompt, title, agents }),
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

  async getGitHubConnectUrl(workspaceId?: string): Promise<string> {
    const query = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : '';
    const res = await fetch(`/api/auth/github/connect${query}`, { headers: this.getHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data.url;
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

  // ── Drive (Picker-based) ──────────────────────────────────────────────────

  async getDriveAuthUrl(workspaceId: string): Promise<{ url: string }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/drive/auth-url`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to get Drive auth URL' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async connectDriveFiles(
    workspaceId: string,
    params: { code: string; pickerFiles: Array<{ id: string; name: string; mimeType: string }>; targetDir?: string }
  ): Promise<{ connected: any[]; errors: any[] }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/drive/connect`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Drive connect failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async syncDriveConnections(workspaceId: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/drive/sync`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Drive sync failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async listDriveConnections(workspaceId: string): Promise<any[]> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/drive/connections`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  }

  // ── Jira (OAuth + persistent connections) ──────────────────────────────

  async getJiraAuthUrl(workspaceId: string): Promise<{ url: string }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/jira/auth-url`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to get Jira auth URL' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async connectJira(
    workspaceId: string,
    params: { code: string; baseUrl: string; email: string; jql?: string; targetPath?: string }
  ): Promise<{ connectionId: string; issueCount: number; fileCount: number }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/jira/connect`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Jira connect failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async syncJiraConnections(workspaceId: string, params?: { connectionId?: string }): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/jira/sync`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Jira sync failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async listJiraConnections(workspaceId: string): Promise<any[]> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/jira/connections`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  }

  async disconnectJiraConnection(workspaceId: string, connectionId: string): Promise<void> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/jira/connections/${connectionId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Jira disconnect failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  }

  // ── Slack (OAuth + persistent connections) ──────────────────────────────

  async getSlackAuthUrl(workspaceId: string): Promise<{ url: string }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/slack/auth-url`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to get Slack auth URL' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async getSlackChannels(workspaceId: string, accessToken: string): Promise<Array<{ id: string; name: string; is_private: boolean; is_general: boolean; num_members?: number }>> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/slack/channels`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ accessToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch Slack channels' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.channels || [];
  }

  async prepareSlackOAuth(workspaceId: string, code: string): Promise<{
    accessToken: string;
    slackWorkspaceId: string;
    slackTeamName: string;
    channels: Array<{ id: string; name: string; is_private: boolean; is_general: boolean; num_members?: number }>;
  }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/slack/prepare`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to prepare Slack connection' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async connectSlack(
    workspaceId: string,
    params: { code?: string; accessToken?: string; slackWorkspaceId: string; slackTeamName: string; channels: string[]; archiveFormat?: string; targetPath?: string }
  ): Promise<{ connectionId: string; messageCount: number; fileCount: number }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/slack/connect`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Slack connect failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async syncSlackConnections(workspaceId: string, params?: { connectionId?: string }): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/slack/sync`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Slack sync failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async listSlackConnections(workspaceId: string): Promise<any[]> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/slack/connections`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  }

  async disconnectSlackConnection(workspaceId: string, connectionId: string): Promise<void> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/slack/connections/${connectionId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Slack disconnect failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  }

  // ── Legacy Jira / Slack / Tribal (unchanged) ─────────────────────────────

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

  // ========== Tribal Memory ==========

  async createTribalMemoryEntry(
    workspaceId: string,
    params: { title: string; content: string; tags?: string[] }
  ): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/tribal/entries`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create entry' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async listTribalMemoryEntries(workspaceId: string, params?: { limit?: number; offset?: number; orderBy?: string }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.offset) query.set('offset', params.offset.toString());
    if (params?.orderBy) query.set('orderBy', params.orderBy);
    const queryStr = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`/api/workspaces/${workspaceId}/tribal/entries${queryStr}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) return { entries: [], total: 0 };
    return res.json();
  }

  async searchTribalMemoryEntries(workspaceId: string, params: { query: string; tags?: string[]; limit?: number; offset?: number }): Promise<any> {
    const query = new URLSearchParams();
    query.set('q', params.query);
    if (params.tags?.length) query.set('tags', params.tags.join(','));
    if (params.limit) query.set('limit', params.limit.toString());
    if (params.offset) query.set('offset', params.offset.toString());
    const res = await fetch(`/api/workspaces/${workspaceId}/tribal/entries/search?${query.toString()}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) return { entries: [], total: 0 };
    return res.json();
  }

  async getTribalMemoryEntry(workspaceId: string, entryId: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/tribal/entries/${entryId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to fetch entry`);
    return res.json();
  }

  async updateTribalMemoryEntry(workspaceId: string, entryId: string, params: { title?: string; content?: string; tags?: string[] }): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/tribal/entries/${entryId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update entry' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async deleteTribalMemoryEntry(workspaceId: string, entryId: string): Promise<void> {
    const res = await fetch(`/api/workspaces/${workspaceId}/tribal/entries/${entryId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to delete entry' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  }

  async exportTribalMemoryToBrain(workspaceId: string, targetPath?: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/tribal/export`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(targetPath ? { targetPath } : {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ========== Live Sessions & Multiplayer AI ==========

  async listSessions(workspaceId: string): Promise<any[]> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  }

  async listThreads(workspaceId: string): Promise<any[]> {
    const res = await fetch(`/api/workspaces/${workspaceId}/threads`, { headers: this.getHeaders() });
    if (!res.ok) return [];
    return res.json();
  }

  async createThread(workspaceId: string, title: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/threads`, {
      method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ title })
    });
    if (!res.ok) throw new Error('Failed to create discussion thread');
    return res.json();
  }

  async listThreadMessages(workspaceId: string, threadId: string): Promise<any[]> {
    const res = await fetch(`/api/workspaces/${workspaceId}/threads/${threadId}/messages`, { headers: this.getHeaders() });
    if (!res.ok) return [];
    return res.json();
  }

  async postThreadMessage(workspaceId: string, threadId: string, content: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/threads/${threadId}/messages`, {
      method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ content })
    });
    if (!res.ok) throw new Error('Failed to post discussion message');
    return res.json();
  }

  async createSession(
    workspaceId: string,
    params: { title: string; goal: string; agents?: any[] }
  ): Promise<{ sessionId: string; status: string; currentDriverId: string | null }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create session' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async getSession(workspaceId: string, sessionId: string): Promise<SessionDetail> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch session' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const raw = data.session || data;
    return {
      id: raw.id || sessionId,
      workspaceId: raw.workspaceId || workspaceId,
      title: raw.title || '',
      goal: raw.goal || '',
      status: raw.status || 'CREATED',
      driverId: raw.currentDriverId || raw.driverId || null,
      currentDriverId: raw.currentDriverId || raw.driverId || null,
      activeDriverRequestId: raw.activeDriverRequestId || null,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString(),
      participants: data.participants || raw.participants || [],
      events: data.events || raw.events || [],
      appliedSkills: data.appliedSkills || [],
    };
  }

  async joinSession(workspaceId: string, sessionId: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/join`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to join session' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async startSession(workspaceId: string, sessionId: string): Promise<{ sessionId: string; status: string }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/start`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to start session' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async redirectSession(
    workspaceId: string,
    sessionId: string,
    params: { instruction: string; evidence?: string; force?: boolean }
  ): Promise<{ success: boolean; redirectId: string }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/redirect`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to redirect session' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async requestSessionDriver(workspaceId: string, sessionId: string): Promise<void> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/request-driver`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to request driver' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  }

  async approveSessionDriver(workspaceId: string, sessionId: string, driverId: string): Promise<void> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/approve-driver`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ driverId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to approve driver' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  }

  async handoffSessionDriver(workspaceId: string, sessionId: string, nextDriverId: string): Promise<void> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/handoff`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ nextDriverId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to hand off driver' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  }

  async pauseSession(workspaceId: string, sessionId: string): Promise<void> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/pause`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to pause session' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  }

  async cancelSession(workspaceId: string, sessionId: string): Promise<void> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/cancel`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to cancel session' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  }

  async distillSessionRedirect(
    workspaceId: string,
    sessionId: string,
    params?: { redirectId?: string; reviewerContext?: string }
  ): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/skills/distill`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to distill redirect' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async resumeSession(workspaceId: string, sessionId: string): Promise<void> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/resume`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to resume session' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  }

  async requestDriver(workspaceId: string, sessionId: string): Promise<void> {
    await this.requestSessionDriver(workspaceId, sessionId);
  }

  async approveDriver(workspaceId: string, sessionId: string, driverId: string): Promise<void> {
    await this.approveSessionDriver(workspaceId, sessionId, driverId);
  }

  async handoffDriver(workspaceId: string, sessionId: string, nextDriverId: string): Promise<void> {
    await this.handoffSessionDriver(workspaceId, sessionId, nextDriverId);
  }

  async submitRedirect(
    workspaceId: string,
    sessionId: string,
    params: { instruction: string; reason?: string; forceInterrupt?: boolean }
  ): Promise<{ success: boolean; redirectId: string }> {
    return this.redirectSession(workspaceId, sessionId, {
      instruction: params.instruction,
      evidence: params.reason,
      force: params.forceInterrupt
    });
  }

  async distillSession(workspaceId: string, sessionId: string): Promise<any[]> {
    return this.distillSessionRedirect(workspaceId, sessionId);
  }

  async getSessionReplay(workspaceId: string, sessionId: string): Promise<{ sessionId: string; events: any[] }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/sessions/${sessionId}/replay`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to load replay' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ========== Skills Lifecycle ==========

  async listSkills(workspaceId: string, status?: string): Promise<any[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`/api/workspaces/${workspaceId}/skills${query}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  }

  async getSkill(workspaceId: string, skillId: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/skills/${skillId}`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Skill not found');
    return res.json();
  }

  async createSkill(workspaceId: string, data: any): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/skills`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create skill' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async updateSkill(workspaceId: string, skillId: string, data: any): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/skills/${skillId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update skill' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async confirmSkill(workspaceId: string, skillId: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/skills/${skillId}/confirm`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to confirm skill' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async rejectSkill(workspaceId: string, skillId: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/skills/${skillId}/reject`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to reject skill' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async supersedeSkill(workspaceId: string, skillId: string, data: any): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/skills/${skillId}/supersede`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to supersede skill' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async getMcpConfig(workspaceId: string): Promise<{
    workspaceId: string;
    endpointUrl: string;
    claudeCodeCommand: string;
    cursorConfig: any;
  }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/mcp/config`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch MCP config' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async listMcpTokens(workspaceId: string): Promise<Array<{
    id: string;
    label: string;
    status: string;
    createdAt: string;
  }>> {
    const res = await fetch(`/api/workspaces/${workspaceId}/mcp/tokens`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to list MCP tokens' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async createMcpToken(workspaceId: string, label?: string): Promise<{
    id: string;
    token: string;
    label: string;
    createdAt: string;
  }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/mcp/token`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ label }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to generate MCP token' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async revokeMcpToken(workspaceId: string, tokenId: string): Promise<any> {
    const res = await fetch(`/api/workspaces/${workspaceId}/mcp/tokens/${tokenId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to revoke MCP token' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ── Phase 2: Auto-sync connector opt-in ─────────────────────────────────────

  async getAutoSyncStatus(workspaceId: string): Promise<{
    enabled: boolean;
    intervalMin: number;
    enabledBy: string | null;
    updatedAt: string;
  }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/auto-sync`, {
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to get auto-sync status' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async setAutoSync(
    workspaceId: string,
    enabled: boolean,
    intervalMin?: number
  ): Promise<{ enabled: boolean; intervalMin: number; enabledBy: string | null; updatedAt: string }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/auto-sync`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ enabled, intervalMin }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to set auto-sync' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async getAutoSyncHistory(
    workspaceId: string,
    limit = 20
  ): Promise<Array<{ id: string; status: string; fileCount: number; detail: string | null; createdAt: string }>> {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/connectors/auto-sync/history?limit=${limit}`,
      { headers: this.getHeaders() }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to get sync history' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async runAutoSync(workspaceId: string): Promise<{
    workspaceId: string;
    drive: { updated: number; skipped: number; failed: number } | null;
    jira: { totalUpdated: number; connectionsSynced: number; connectionsFailed: number } | null;
    slack: { totalUpdated: number; connectionsSynced: number; connectionsFailed: number } | null;
    errors: string[];
    durationMs: number;
  }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/connectors/auto-sync/run`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to run sync' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ── Phase 3: Knowledge Candidates & Synthesis ───────────────────────────────

  async listKnowledgeCandidates(
    workspaceId: string,
    status: 'TENTATIVE' | 'CONFIRMED' | 'REJECTED' | 'SUPERSEDED' | 'ALL' = 'TENTATIVE'
  ): Promise<{ candidates: KnowledgeCandidate[]; total: number }> {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/knowledge-candidates?status=${status}`,
      { headers: this.getHeaders() }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to list candidates' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async distillKnowledge(
    workspaceId: string,
    options?: { sourceItemIds?: string[]; limit?: number }
  ): Promise<{
    workspaceId: string;
    itemsProcessed: number;
    candidatesCreated: number;
    candidatesMerged: number;
    candidates: Array<{ id: string; title: string; status: string; suggestedAction: string; dedupHash: string | null }>;
  }> {
    const res = await fetch(`/api/workspaces/${workspaceId}/knowledge-candidates/distill`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to distill knowledge' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async confirmKnowledgeCandidate(
    workspaceId: string,
    candidateId: string
  ): Promise<{ candidate: KnowledgeCandidate; entry: TribalMemoryEntry }> {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/knowledge-candidates/${candidateId}/confirm`,
      {
        method: 'POST',
        headers: this.getHeaders(),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to confirm candidate' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async rejectKnowledgeCandidate(
    workspaceId: string,
    candidateId: string,
    reason?: string
  ): Promise<KnowledgeCandidate> {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/knowledge-candidates/${candidateId}/reject`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ reason }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to reject candidate' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // ── Phase 4: Tribal Memory & Staleness Tracking ─────────────────────────────

  async listTribalEntries(
    workspaceId: string,
    params?: { limit?: number; offset?: number; includeSuperseded?: boolean; status?: string }
  ): Promise<{ entries: TribalMemoryEntry[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.includeSuperseded) query.set('includeSuperseded', 'true');
    if (params?.status) query.set('status', params.status);

    const res = await fetch(
      `/api/workspaces/${workspaceId}/tribal/entries?${query.toString()}`,
      { headers: this.getHeaders() }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to list tribal memory' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async getTribalMemoryHistory(
    workspaceId: string,
    entryId: string
  ): Promise<TribalMemoryHistory> {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/tribal/entries/${entryId}/history`,
      { headers: this.getHeaders() }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to fetch entry history' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  }
}

export interface KnowledgeCandidate {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  content: string;
  category: string | null;
  tags: string[];
  sourceItemIds: string[];
  sourceConnector: string | null;
  confidence: number;
  status: 'TENTATIVE' | 'CONFIRMED' | 'REJECTED' | 'SUPERSEDED';
  suggestedAction: 'CREATE' | 'UPDATE' | 'SUPERSEDE';
  targetEntryId: string | null;
  targetEntryTitle?: string;
  dedupHash: string | null;
  reviewedById: string | null;
  reviewedByName?: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  promotedEntryId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TribalMemoryEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  authorId: string;
  authorName?: string;
  status: 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';
  supersedesId: string | null;
  source: 'manual' | 'auto_distilled';
  sourceCandidateId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TribalMemoryHistory {
  current: TribalMemoryEntry;
  ancestors: TribalMemoryEntry[];
  descendants: TribalMemoryEntry[];
}

export const api = new ApiClient();
