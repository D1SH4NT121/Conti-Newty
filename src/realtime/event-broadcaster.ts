import { Server } from 'socket.io';
import { UserPresence } from './presence-manager';
import { StreamBufferManager } from './stream-buffer-manager';

export class EventBroadcaster {
  public static broadcastPresenceChanged(
    io: Server,
    workspaceId: string,
    presences: UserPresence[]
  ) {
    io.to(`workspace:${workspaceId}`).emit('presence.changed', presences);
  }

  public static broadcastMessageChunk(
    io: Server,
    workspaceId: string,
    data: { threadId: string; chunk: string }
  ) {
    // Record into server-side stream buffer for mid-stream joiners
    StreamBufferManager.getInstance().appendChunk(workspaceId, data.threadId, data.chunk);
    io.to(`workspace:${workspaceId}`).emit('message.chunk', data);
  }

  public static broadcastMessageCreated(
    io: Server,
    workspaceId: string,
    message: any
  ) {
    if (message?.threadId) {
      StreamBufferManager.getInstance().completeStream(workspaceId, message.threadId);
    }
    io.to(`workspace:${workspaceId}`).emit('message.created', message);
  }

  public static broadcastAgentToolStarted(
    io: Server,
    workspaceId: string,
    data: { taskId: string; toolName: string; input?: any }
  ) {
    io.to(`workspace:${workspaceId}`).emit('agent.tool.started', data);
  }

  public static broadcastAgentToolCompleted(
    io: Server,
    workspaceId: string,
    data: { taskId: string; toolName: string; result?: any }
  ) {
    io.to(`workspace:${workspaceId}`).emit('agent.tool.completed', data);
  }

  public static broadcastFileChanged(
    io: Server,
    workspaceId: string,
    data: { filePath: string; action: 'created' | 'updated' | 'deleted' }
  ) {
    io.to(`workspace:${workspaceId}`).emit('file.changed', data);
  }

  public static broadcastTaskUpdated(
    io: Server,
    workspaceId: string,
    task: any
  ) {
    io.to(`workspace:${workspaceId}`).emit('task.updated', task);
  }

  public static broadcastChangeProposed(
    io: Server,
    workspaceId: string,
    change: any
  ) {
    io.to(`workspace:${workspaceId}`).emit('change.proposed', change);
  }

  public static broadcastAppStatusChanged(
    io: Server,
    workspaceId: string,
    appStatus: any
  ) {
    io.to(`workspace:${workspaceId}`).emit('app.status.changed', appStatus);
  }
}
