import http from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { AddressInfo } from 'net';
import { createSocketServer } from '../src/realtime/socket-server';
import { PresenceManager } from '../src/realtime/presence-manager';
import { EventBroadcaster } from '../src/realtime/event-broadcaster';

describe('Real-Time Engine (WebSockets & Multiplayer Sync)', () => {
  let httpServer: http.Server;
  let socketServer: any;
  let clientSocket1: ClientSocket;
  let clientSocket2: ClientSocket;
  let port: number;

  beforeAll((done) => {
    httpServer = http.createServer();
    const result = createSocketServer(httpServer);
    socketServer = result.io;

    httpServer.listen(0, '127.0.0.1', () => {
      port = (httpServer.address() as AddressInfo).port;
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket1?.connected) clientSocket1.disconnect();
    if (clientSocket2?.connected) clientSocket2.disconnect();
    socketServer.close();
    httpServer.close(done);
  });

  describe('Presence Manager Unit Tests', () => {
    it('should manage join, activity updates, and leaves', () => {
      const pm = new PresenceManager();
      const p1 = pm.joinWorkspace('ws-1', 'sock-1', { id: 'user-1', name: 'Alice', email: 'alice@test.com' });
      expect(p1.length).toBe(1);
      expect(p1[0].userId).toBe('user-1');

      const p2 = pm.joinWorkspace('ws-1', 'sock-2', { id: 'user-2', name: 'Bob', email: 'bob@test.com' });
      expect(p2.length).toBe(2);

      const updated = pm.updateActivity('ws-1', 'sock-1', { activeFile: 'sop.md', isTyping: true });
      const alice = updated.find((u: { userId: string }) => u.userId === 'user-1');
      expect(alice?.activeFile).toBe('sop.md');
      expect(alice?.isTyping).toBe(true);

      const afterLeave = pm.leaveWorkspace('ws-1', 'sock-2');
      expect(afterLeave.length).toBe(1);
      expect(afterLeave[0].userId).toBe('user-1');
    });
  });

  describe('Socket.io Real-Time Synchronization', () => {
    it('should connect clients, join workspace rooms, and receive broadcast presence', (done) => {
      clientSocket1 = Client(`http://127.0.0.1:${port}`);
      clientSocket2 = Client(`http://127.0.0.1:${port}`);

      clientSocket2.on('presence.changed', (presences: any[]) => {
        expect(presences.length).toBeGreaterThan(0);
        done();
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('workspace.join', {
          workspaceId: 'ws-test',
          user: { id: 'u1', name: 'User One' }
        });

        clientSocket2.on('connect', () => {
          clientSocket2.emit('workspace.join', {
            workspaceId: 'ws-test',
            user: { id: 'u2', name: 'User Two' }
          });
        });
      });
    });

    it('should broadcast message chunks and agent events across workspace room', (done) => {
      clientSocket2.on('message.chunk', (payload: any) => {
        expect(payload.chunk).toBe('Streaming token 1');
        done();
      });

      EventBroadcaster.broadcastMessageChunk(socketServer, 'ws-test', {
        threadId: 'th-1',
        chunk: 'Streaming token 1'
      });
    });
  });
});
