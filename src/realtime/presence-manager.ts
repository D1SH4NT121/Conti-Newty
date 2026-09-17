export interface UserPresence {
  socketId: string;
  userId: string;
  name: string;
  email?: string;
  avatarUrl?: string | null;
  role?: string;
  activeFile?: string;
  isTyping?: boolean;
  currentThreadId?: string;
  x?: number;
  y?: number;
  lastSeen: Date;
}

export class PresenceManager {
  // Map of workspaceId -> Map of socketId -> UserPresence
  private workspaces: Map<string, Map<string, UserPresence>> = new Map();

  public joinWorkspace(
    workspaceId: string,
    socketId: string,
    user: { id: string; name: string; email?: string; avatarUrl?: string | null; role?: string }
  ): UserPresence[] {
    if (!this.workspaces.has(workspaceId)) {
      this.workspaces.set(workspaceId, new Map());
    }

    const wsMap = this.workspaces.get(workspaceId)!;
    wsMap.set(socketId, {
      socketId,
      userId: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl || null,
      role: user.role || 'MEMBER',
      lastSeen: new Date()
    });

    return this.getWorkspacePresence(workspaceId);
  }

  public leaveWorkspace(workspaceId: string, socketId: string): UserPresence[] {
    const wsMap = this.workspaces.get(workspaceId);
    if (wsMap) {
      wsMap.delete(socketId);
      if (wsMap.size === 0) {
        this.workspaces.delete(workspaceId);
        return [];
      }
    }
    return this.getWorkspacePresence(workspaceId);
  }

  public updateActivity(
    workspaceId: string,
    socketId: string,
    activity: Partial<UserPresence>
  ): UserPresence[] {
    const wsMap = this.workspaces.get(workspaceId);
    if (wsMap && wsMap.has(socketId)) {
      const existing = wsMap.get(socketId)!;
      wsMap.set(socketId, {
        ...existing,
        ...activity,
        lastSeen: new Date()
      });
    }
    return this.getWorkspacePresence(workspaceId);
  }

  public getWorkspacePresence(workspaceId: string): UserPresence[] {
    const wsMap = this.workspaces.get(workspaceId);
    if (!wsMap) {
      return [];
    }
    return Array.from(wsMap.values());
  }

  public getUserPresence(workspaceId: string, socketId: string): UserPresence | undefined {
    return this.workspaces.get(workspaceId)?.get(socketId);
  }

  public handleDisconnect(socketId: string): Array<{ workspaceId: string; presences: UserPresence[] }> {
    const affected: Array<{ workspaceId: string; presences: UserPresence[] }> = [];

    for (const [workspaceId, wsMap] of this.workspaces.entries()) {
      if (wsMap.has(socketId)) {
        wsMap.delete(socketId);
        affected.push({
          workspaceId,
          presences: Array.from(wsMap.values())
        });
      }
    }

    return affected;
  }
}
