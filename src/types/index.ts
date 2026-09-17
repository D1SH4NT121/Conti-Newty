export interface UserRole {
  id: string;
  name: string;
  permissions: string[];
}

export enum WorkspaceKind {
  PRIVATE = 'private',
  TEAM = 'team',
  PUBLIC = 'public'
}

export type ToolName =
  | 'read'
  | 'write'
  | 'edit'
  | 'bash'
  | 'glob'
  | 'grep'
  | 'powerShell'
  | 'ls'
  | 'task'
  | 'agent'
  | 'mcp';

export enum AgentTaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum AppAccessMode {
  READ_ONLY = 'read-only',
  READ_WRITE = 'read-write',
  ADMIN = 'admin'
}