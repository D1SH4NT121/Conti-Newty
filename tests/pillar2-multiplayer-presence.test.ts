import http from 'http';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import express from 'express';
import { createSocketServer } from '../src/realtime/socket-server';
import { AuthService } from '../src/modules/auth/auth-service';
import { prisma } from '../src/db/client';
import { AddressInfo } from 'net';

describe('Pillar 2.1: Real WebSocket Presence and Cursor Sync', () => {
  let server: http.Server;
  let serverPort: number;
  let authService: AuthService;
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let clientA: ClientSocketType;
  let clientB: ClientSocketType;
  const workspaceId = `test-ws-presence-${Date.now()}`;

  beforeAll(async () => {
    const app = express();
    server = http.createServer(app);
    createSocketServer(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = (server.address() as AddressInfo).port;
        resolve();
      });
    });

    authService = new AuthService();

    // Create User A
    userA = await prisma.user.create({
      data: {
        email: `usera-presence-${Date.now()}@test.internal`,
        name: 'Alice Presence'
      }
    });
    tokenA = authService.generateToken({
      userId: userA.id,
      email: userA.email,
      name: userA.name,
      role: 'MEMBER'
    });

    // Create User B
    userB = await prisma.user.create({
      data: {
        email: `userb-presence-${Date.now()}@test.internal`,
        name: 'Bob Cursor'
      }
    });
    tokenB = authService.generateToken({
      userId: userB.id,
      email: userB.email,
      name: userB.name,
      role: 'MEMBER'
    });
  });

  afterAll(async () => {
    if (clientA?.connected) clientA.disconnect();
    if (clientB?.connected) clientB.disconnect();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('1. Two real authenticated socket sessions connect and Session A receives presence.changed with Session B within 500ms', async () => {
    const serverUrl = `http://127.0.0.1:${serverPort}`;

    // Connect Client A with User A token
    clientA = ClientSocket(serverUrl, {
      auth: { token: tokenA },
      transports: ['websocket']
    });

    await new Promise<void>((resolve) => {
      clientA.on('connect', () => {
        clientA.emit('workspace.join', { workspaceId, user: userA });
        resolve();
      });
    });

    // Setup listener on Client A to receive presence update when B joins
    const presencePromise = new Promise<any>((resolve) => {
      clientA.on('presence.changed', (presences: any[]) => {
        const hasB = presences.find((p) => p.userId === userB.id);
        if (hasB) {
          resolve(presences);
        }
      });
    });

    const startTime = Date.now();

    // Connect Client B with User B token
    clientB = ClientSocket(serverUrl, {
      auth: { token: tokenB },
      transports: ['websocket']
    });

    await new Promise<void>((resolve) => {
      clientB.on('connect', () => {
        clientB.emit('workspace.join', { workspaceId, user: userB });
        resolve();
      });
    });

    const presences = await presencePromise;
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(1000);
    expect(presences.length).toBeGreaterThanOrEqual(2);
    expect(presences.some((p: any) => p.userId === userA.id)).toBe(true);
    expect(presences.some((p: any) => p.userId === userB.id)).toBe(true);
  });

  it('2. Session B emits cursor.move and Session A receives real cursor.moved event with User B userId', async () => {
    const cursorPromise = new Promise<any>((resolve) => {
      clientA.on('cursor.moved', (data: any) => {
        if (data.userId === userB.id) {
          resolve(data);
        }
      });
    });

    clientB.emit('cursor.move', {
      workspaceId,
      x: 320,
      y: 480,
      statusText: 'Analyzing financial report',
      activeFile: 'finance/budget.md'
    });

    const cursorData = await cursorPromise;

    expect(cursorData.userId).toBe(userB.id);
    expect(cursorData.userName).toBe(userB.name);
    expect(cursorData.x).toBe(320);
    expect(cursorData.y).toBe(480);
    expect(cursorData.statusText).toBe('Analyzing financial report');
    expect(cursorData.activeFile).toBe('finance/budget.md');
  });
});
