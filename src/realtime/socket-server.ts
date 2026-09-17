import http from 'http';
import { Server, Socket } from 'socket.io';
import { config } from '../config';
import { PresenceManager } from './presence-manager';
import { EventBroadcaster } from './event-broadcaster';
import { StreamBufferManager } from './stream-buffer-manager';
import { AuthService } from '../modules/auth/auth-service';

export function createSocketServer(httpServer: http.Server) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    }
  });

  const presenceManager = new PresenceManager();
  const authService = new AuthService();
  const streamManager = StreamBufferManager.getInstance();

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (token && typeof token === 'string') {
        const user = await authService.getUserFromToken(token);
        if (user) {
          socket.data.user = {
            id: user.id,
            name: user.name || '',
            email: user.email,
            avatarUrl: user.avatarUrl,
            role: user.role
          };
        }
      }
    } catch {
      // Allow unauthenticated connection for public rooms if needed
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    socket.on('workspace.join', (data: { workspaceId: string; user?: { id: string; name: string; email?: string; avatarUrl?: string | null; role?: string } }) => {
      const workspaceId = data?.workspaceId;
      const user = data?.user || socket.data?.user;
      if (!workspaceId || !user) return;

      const room = `workspace:${workspaceId}`;
      socket.join(room);

      const presences = presenceManager.joinWorkspace(workspaceId, socket.id, user);
      EventBroadcaster.broadcastPresenceChanged(io, workspaceId, presences);

      // Check for active streams in progress and deliver server-side backlog to mid-stream joiner
      const activeStreams = streamManager.getActiveStreamsForWorkspace(workspaceId);
      for (const active of activeStreams) {
        socket.emit('stream.backlog', {
          workspaceId,
          threadId: active.threadId,
          bufferedText: active.bufferedText,
          chunkCount: active.chunks.length
        });
      }
    });

    // Realtime Multiplayer Cursor Position Broadcasting with real userId
    socket.on('cursor.move', (data: { workspaceId: string; x: number; y: number; statusText?: string; activeFile?: string }) => {
      const { workspaceId, x, y, statusText, activeFile } = data;
      if (!workspaceId || typeof x !== 'number' || typeof y !== 'number') return;

      const userPresence = presenceManager.getUserPresence(workspaceId, socket.id);
      const userId = userPresence?.userId || socket.data?.user?.id;
      const userName = userPresence?.name || socket.data?.user?.name;

      const room = `workspace:${workspaceId}`;
      // Broadcast cursor coordinates with authentic user identity to other participants
      socket.to(room).emit('cursor.moved', {
        socketId: socket.id,
        userId,
        userName,
        x,
        y,
        statusText,
        activeFile
      });
    });

    socket.on('cursor.leave', (data: { workspaceId: string }) => {
      const { workspaceId } = data;
      if (!workspaceId) return;
      socket.to(`workspace:${workspaceId}`).emit('cursor.removed', { socketId: socket.id });
    });

    socket.on('workspace.leave', (data: { workspaceId: string }) => {
      const { workspaceId } = data;
      if (!workspaceId) return;

      const room = `workspace:${workspaceId}`;
      socket.leave(room);
      socket.to(room).emit('cursor.removed', { socketId: socket.id });

      const presences = presenceManager.leaveWorkspace(workspaceId, socket.id);
      EventBroadcaster.broadcastPresenceChanged(io, workspaceId, presences);
    });

    socket.on('presence.update', (data: { workspaceId: string; activity: any }) => {
      const { workspaceId, activity } = data;
      if (!workspaceId) return;

      const presences = presenceManager.updateActivity(workspaceId, socket.id, activity);
      EventBroadcaster.broadcastPresenceChanged(io, workspaceId, presences);
    });

    socket.on('file.view', (data: { workspaceId: string; filePath: string }) => {
      const { workspaceId, filePath } = data;
      if (!workspaceId) return;

      const presences = presenceManager.updateActivity(workspaceId, socket.id, { activeFile: filePath, isTyping: false });
      EventBroadcaster.broadcastPresenceChanged(io, workspaceId, presences);
    });

    socket.on('file.close', (data: { workspaceId: string }) => {
      const { workspaceId } = data;
      if (!workspaceId) return;

      const presences = presenceManager.updateActivity(workspaceId, socket.id, { activeFile: undefined, isTyping: false });
      EventBroadcaster.broadcastPresenceChanged(io, workspaceId, presences);
    });

    socket.on('file.edit_state', (data: { workspaceId: string; filePath: string; isTyping: boolean }) => {
      const { workspaceId, filePath, isTyping } = data;
      if (!workspaceId) return;

      const presences = presenceManager.updateActivity(workspaceId, socket.id, { activeFile: filePath, isTyping });
      EventBroadcaster.broadcastPresenceChanged(io, workspaceId, presences);
    });

    socket.on('disconnect', () => {
      const affected = presenceManager.handleDisconnect(socket.id);
      for (const item of affected) {
        socket.to(`workspace:${item.workspaceId}`).emit('cursor.removed', { socketId: socket.id });
        EventBroadcaster.broadcastPresenceChanged(io, item.workspaceId, item.presences);
      }
    });
  });

  return { io, presenceManager };
}
