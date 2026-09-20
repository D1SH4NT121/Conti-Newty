import http from 'http';
import { Server, Socket } from 'socket.io';
import { PresenceManager } from './presence-manager';
import { EventBroadcaster } from './event-broadcaster';
import { StreamBufferManager } from './stream-buffer-manager';
import { AuthService } from '../modules/auth/auth-service';
import { prisma } from '../db/client';
import {
  joinSession,
  getSession,
  requestDriver,
  approveDriverRequest,
  handoffDriver,
  pauseForDisconnect,
  assertCanRedirect
} from '../modules/sessions/session-service';
import { SessionRunner } from '../modules/sessions/session-runner';

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

    // Task room — join to watch a specific agent task live
    socket.on('task.join', (data: { taskId: string; workspaceId: string }) => {
      const { taskId, workspaceId } = data;
      if (!taskId || !workspaceId) return;
      socket.join(`task:${taskId}`);
      // Broadcast updated watcher count to workspace
      const room = `task:${taskId}`;
      const sockets = io.sockets.adapter.rooms.get(room);
      io.to(`workspace:${workspaceId}`).emit('task.watchers', { taskId, count: sockets?.size ?? 1 });
    });

    socket.on('task.leave', (data: { taskId: string; workspaceId: string }) => {
      const { taskId, workspaceId } = data;
      if (!taskId) return;
      socket.leave(`task:${taskId}`);
      const room = `task:${taskId}`;
      const sockets = io.sockets.adapter.rooms.get(room);
      io.to(`workspace:${workspaceId}`).emit('task.watchers', { taskId, count: sockets?.size ?? 0 });
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

    socket.on('session.join', async (data: { workspaceId: string; sessionId: string }) => {
      try {
        const { workspaceId, sessionId } = data;
        const userId = socket.data?.user?.id;
        if (!userId) {
          socket.emit('session.error', { message: 'Authentication required to join session' });
          return;
        }

        await joinSession(workspaceId, sessionId, userId);
        const room = `session:${sessionId}`;
        socket.join(room);

        const sessionDto = await getSession(workspaceId, sessionId, userId);
        socket.emit('session.snapshot', {
          session: sessionDto,
          participants: sessionDto.participants,
          currentDriverId: sessionDto.currentDriverId,
          status: sessionDto.status,
          events: sessionDto.events
        });

        io.to(room).emit('session.participant_changed', {
          sessionId,
          participants: sessionDto.participants
        });
      } catch (err: any) {
        socket.emit('session.error', { message: err.message });
      }
    });

    socket.on('session.leave', (data: { sessionId: string }) => {
      if (data?.sessionId) {
        socket.leave(`session:${data.sessionId}`);
      }
    });

    socket.on('session.request_driver', async (data: { workspaceId: string; sessionId: string }) => {
      try {
        const { workspaceId, sessionId } = data;
        const userId = socket.data?.user?.id;
        if (!userId) return;

        await requestDriver(workspaceId, sessionId, userId);
        const sessionDto = await getSession(workspaceId, sessionId, userId);
        io.to(`session:${sessionId}`).emit('session.event', sessionDto.events[sessionDto.events.length - 1]);
      } catch (err: any) {
        socket.emit('session.error', { message: err.message });
      }
    });

    socket.on('session.approve_driver', async (data: { workspaceId: string; sessionId: string; driverId: string }) => {
      try {
        const { workspaceId, sessionId, driverId } = data;
        const userId = socket.data?.user?.id;
        if (!userId) return;

        await approveDriverRequest(workspaceId, sessionId, driverId, userId);
        const sessionDto = await getSession(workspaceId, sessionId, userId);
        io.to(`session:${sessionId}`).emit('session.driver_changed', {
          sessionId,
          currentDriverId: sessionDto.currentDriverId,
          participants: sessionDto.participants
        });
        io.to(`session:${sessionId}`).emit('session.event', sessionDto.events[sessionDto.events.length - 1]);
      } catch (err: any) {
        socket.emit('session.error', { message: err.message });
      }
    });

    socket.on('session.handoff', async (data: { workspaceId: string; sessionId: string; nextDriverId: string }) => {
      try {
        const { workspaceId, sessionId, nextDriverId } = data;
        const userId = socket.data?.user?.id;
        if (!userId) return;

        await handoffDriver(workspaceId, sessionId, userId, nextDriverId);
        const sessionDto = await getSession(workspaceId, sessionId, userId);
        io.to(`session:${sessionId}`).emit('session.driver_changed', {
          sessionId,
          currentDriverId: sessionDto.currentDriverId,
          participants: sessionDto.participants
        });
        io.to(`session:${sessionId}`).emit('session.event', sessionDto.events[sessionDto.events.length - 1]);
      } catch (err: any) {
        socket.emit('session.error', { message: err.message });
      }
    });

    socket.on('session.redirect', async (data: { workspaceId: string; sessionId: string; instruction: string; evidence?: string; force?: boolean }) => {
      try {
        const { workspaceId, sessionId, instruction, evidence, force } = data;
        const userId = socket.data?.user?.id;
        if (!userId) return;

        const sessionDto = await getSession(workspaceId, sessionId, userId);
        assertCanRedirect(sessionDto, userId, Boolean(force));

        const { redirectId } = await SessionRunner.submitRedirect(sessionId, {
          userId,
          instruction,
          evidence,
          force: Boolean(force)
        });

        const updated = await getSession(workspaceId, sessionId, userId);
        io.to(`session:${sessionId}`).emit('session.event', updated.events[updated.events.length - 1]);
        socket.emit('session.redirect_accepted', { redirectId });
      } catch (err: any) {
        socket.emit('session.error', { message: err.message });
      }
    });

    socket.on('disconnect', async () => {
      const affected = presenceManager.handleDisconnect(socket.id);
      for (const item of affected) {
        socket.to(`workspace:${item.workspaceId}`).emit('cursor.removed', { socketId: socket.id });
        EventBroadcaster.broadcastPresenceChanged(io, item.workspaceId, item.presences);
      }

      const userId = socket.data?.user?.id;
      if (userId) {
        try {
          const activeDriverSessions = await prisma.liveSession.findMany({
            where: { currentDriverId: userId, status: 'RUNNING' },
            select: { id: true, workspaceId: true }
          });
          for (const s of activeDriverSessions) {
            await pauseForDisconnect(s.id, userId);
            io.to(`session:${s.id}`).emit('session.paused', {
              sessionId: s.id,
              reason: 'DRIVER_DISCONNECTED'
            });
            const updated = await getSession(s.workspaceId, s.id, userId).catch(() => null);
            if (updated) {
              io.to(`session:${s.id}`).emit('session.event', updated.events[updated.events.length - 1]);
            }
          }
        } catch {
          // Ignore error during disconnect pause cleanup
        }
      }
    });
  });

  return { io, presenceManager };
}
