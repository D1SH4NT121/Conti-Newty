import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('anti_token') : null;
    socketInstance = io(window.location.origin, {
      path: '/socket.io',
      auth: { token: token || undefined },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
}

export function joinTaskRoom(taskId: string, workspaceId: string) {
  getSocket().emit('task.join', { taskId, workspaceId });
}

export function leaveTaskRoom(taskId: string, workspaceId: string) {
  getSocket().emit('task.leave', { taskId, workspaceId });
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
