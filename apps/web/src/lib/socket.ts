import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    const token = typeof window !== 'undefined' ? localStorage.getItem('anti_token') : null;
    const anonymousId = typeof window !== 'undefined' ? localStorage.getItem('anti_anonymous_id') : null;
    const displayName = typeof window !== 'undefined' ? localStorage.getItem('anti_display_name') : null;
    socketInstance = io(window.location.origin, {
      path: '/socket.io',
      auth: { token: token || undefined, anonymousId: anonymousId || undefined, displayName: displayName || 'Guest' },
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

export function joinSessionRoom(workspaceId: string, sessionId: string) {
  getSocket().emit('session.join', { workspaceId, sessionId });
}

export function leaveSessionRoom(sessionId: string) {
  getSocket().emit('session.leave', { sessionId });
}

export function requestDriverControl(workspaceId: string, sessionId: string) {
  getSocket().emit('session.request_driver', { workspaceId, sessionId });
}
export const requestDriver = requestDriverControl;

export function approveDriverControl(workspaceId: string, sessionId: string, driverId: string) {
  getSocket().emit('session.approve_driver', { workspaceId, sessionId, driverId });
}
export const approveDriver = approveDriverControl;

export function handoffDriverControl(workspaceId: string, sessionId: string, nextDriverId: string) {
  getSocket().emit('session.handoff', { workspaceId, sessionId, nextDriverId });
}
export const handoffDriver = handoffDriverControl;

export function emitSessionRedirect(workspaceId: string, sessionId: string, instruction: string, evidence?: string, force?: boolean) {
  getSocket().emit('session.redirect', { workspaceId, sessionId, instruction, evidence, force });
}

export function onSessionEvent(callback: (event: any) => void): () => void {
  const socket = getSocket();
  socket.on('session.event', callback);
  return () => {
    socket.off('session.event', callback);
  };
}

export function onDriverChanged(callback: (data: any) => void): () => void {
  const socket = getSocket();
  socket.on('session.driver_changed', callback);
  return () => {
    socket.off('session.driver_changed', callback);
  };
}

export function onParticipantChanged(callback: (data: any) => void): () => void {
  const socket = getSocket();
  socket.on('session.participant_changed', callback);
  return () => {
    socket.off('session.participant_changed', callback);
  };
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
