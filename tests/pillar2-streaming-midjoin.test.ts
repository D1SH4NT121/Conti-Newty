import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import express from 'express';
import { createSocketServer } from '../src/realtime/socket-server';
import { EventBroadcaster } from '../src/realtime/event-broadcaster';
import { StreamBufferManager } from '../src/realtime/stream-buffer-manager';
import { AddressInfo } from 'net';
import { Server } from 'socket.io';

describe('Pillar 2.2: Real Streamed AI Responses with Correct Mid-Stream Join', () => {
  let server: http.Server;
  let io: Server;
  let serverPort: number;
  let clientA: ClientSocketType;
  let clientB: ClientSocketType;
  const workspaceId = `test-ws-stream-${Date.now()}`;
  const threadId = `thread-stream-${Date.now()}`;

  beforeAll(async () => {
    const app = express();
    server = http.createServer(app);
    const socketApp = createSocketServer(server);
    io = socketApp.io;

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (clientA?.connected) clientA.disconnect();
    if (clientB?.connected) clientB.disconnect();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('1. Session A starts receiving live stream chunks incrementally from the server', async () => {
    const serverUrl = `http://127.0.0.1:${serverPort}`;

    clientA = ClientSocket(serverUrl, { transports: ['websocket'] });

    await new Promise<void>((resolve) => {
      clientA.on('connect', () => {
        clientA.emit('workspace.join', {
          workspaceId,
          user: { id: 'user-a', name: 'Alice Stream' }
        });
      });
      clientA.on('presence.changed', () => {
        resolve();
      });
    });

    const receivedChunksA: string[] = [];
    clientA.on('message.chunk', (data: { threadId: string; chunk: string }) => {
      if (data.threadId === threadId) {
        receivedChunksA.push(data.chunk);
      }
    });

    // Server emits initial 3 chunks
    EventBroadcaster.broadcastMessageChunk(io, workspaceId, { threadId, chunk: 'Conti-Newty is ' });
    EventBroadcaster.broadcastMessageChunk(io, workspaceId, { threadId, chunk: 'the single-agent ' });
    EventBroadcaster.broadcastMessageChunk(io, workspaceId, { threadId, chunk: 'Company Brain ' });

    // Allow socket dispatch
    await new Promise((r) => setTimeout(r, 100));

    expect(receivedChunksA).toEqual(['Conti-Newty is ', 'the single-agent ', 'Company Brain ']);
  });

  it('2. Session B joins mid-stream and receives server-side buffered backlog matching what A received', async () => {
    const serverUrl = `http://127.0.0.1:${serverPort}`;

    clientB = ClientSocket(serverUrl, { transports: ['websocket'] });

    let backlogReceivedB: any = null;
    clientB.on('stream.backlog', (data: any) => {
      if (data.threadId === threadId) {
        backlogReceivedB = data;
      }
    });

    const remainingChunksB: string[] = [];
    clientB.on('message.chunk', (data: { threadId: string; chunk: string }) => {
      if (data.threadId === threadId) {
        remainingChunksB.push(data.chunk);
      }
    });

    // Session B joins the workspace mid-stream
    await new Promise<void>((resolve) => {
      clientB.on('connect', () => {
        clientB.emit('workspace.join', {
          workspaceId,
          user: { id: 'user-b', name: 'Bob MidJoin' }
        });
        resolve();
      });
    });

    await new Promise((r) => setTimeout(r, 60));

    // Session B MUST have received the backlog generated up to join time
    expect(backlogReceivedB).not.toBeNull();
    expect(backlogReceivedB.bufferedText).toBe('Conti-Newty is the single-agent Company Brain ');
    expect(backlogReceivedB.chunkCount).toBe(3);

    // Now server emits remaining live chunks
    EventBroadcaster.broadcastMessageChunk(io, workspaceId, { threadId, chunk: 'with zero integration friction.' });

    await new Promise((r) => setTimeout(r, 50));

    expect(remainingChunksB).toContain('with zero integration friction.');

    // Complete the stream
    EventBroadcaster.broadcastMessageCreated(io, workspaceId, {
      id: 'msg-final',
      threadId,
      content: 'Conti-Newty is the single-agent Company Brain with zero integration friction.'
    });
  });
});
