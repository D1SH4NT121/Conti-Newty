import http from 'http';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { prisma } from '../src/db/client';
import { clearDatabase } from './test-utils';
import { createSocketServer } from '../src/realtime/socket-server';
import { AuthService } from '../src/modules/auth/auth-service';
import { createSession } from '../src/modules/sessions/session-service';

describe('authenticated realtime session control', () => {
  let server: http.Server;
  let ioInstance: any;
  let port: number;
  let authService: AuthService;
  let workspaceId: string;
  let driverUser: any;
  let observerUser: any;
  let driverToken: string;
  let observerToken: string;
  let sessionId: string;
  const activeSockets: ClientSocket[] = [];

  beforeAll(async () => {
    server = http.createServer();
    const rt = createSocketServer(server);
    ioInstance = rt.io;
    await new Promise<void>((resolve) => server.listen(0, resolve));
    port = (server.address() as any).port;
    authService = new AuthService();
  });

  afterAll(async () => {
    for (const s of activeSockets) {
      if (s.connected) s.disconnect();
    }
    if (ioInstance) {
      ioInstance.close();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await clearDatabase();

    const org = await prisma.organization.create({ data: { name: `RT Org ${Date.now()}` } });
    driverUser = await prisma.user.create({
      data: { email: `driver-${Date.now()}@example.com`, name: 'Driver User', organizationId: org.id }
    });
    observerUser = await prisma.user.create({
      data: { email: `observer-${Date.now()}@example.com`, name: 'Observer User', organizationId: org.id }
    });

    const workspace = await prisma.workspace.create({
      data: { name: 'RT Workspace', organizationId: org.id }
    });
    workspaceId = workspace.id;

    await Promise.all([
      prisma.workspaceMember.create({ data: { workspaceId, userId: driverUser.id, role: 'MEMBER' } }),
      prisma.workspaceMember.create({ data: { workspaceId, userId: observerUser.id, role: 'MEMBER' } })
    ]);

    driverToken = authService.generateToken({ userId: driverUser.id, email: driverUser.email });
    observerToken = authService.generateToken({ userId: observerUser.id, email: observerUser.email });

    const session = await createSession({
      workspaceId,
      userId: driverUser.id,
      title: 'Realtime Live Session',
      goal: 'Test socket events'
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    for (const s of activeSockets) {
      if (s.connected) s.disconnect();
    }
    activeSockets.length = 0;
    await clearDatabase();
  });

  const waitForConnectAndJoin = (socket: ClientSocket) =>
    new Promise<void>((resolve, reject) => {
      const join = () => {
        socket.emit('session.join', { workspaceId, sessionId });
        socket.once('session.snapshot', () => resolve());
        socket.once('session.error', (err) => reject(new Error(err.message)));
      };
      if (socket.connected) {
        join();
      } else {
        socket.once('connect', join);
      }
    });

  it('allows authenticated driver to join session and receive snapshot', async () => {
    const socket: ClientSocket = Client(`http://localhost:${port}`, {
      auth: { token: driverToken },
      transports: ['websocket'],
      autoConnect: true
    });
    activeSockets.push(socket);

    await waitForConnectAndJoin(socket);
  }, 10000);

  it('rejects observer redirect without force and accepts driver redirect', async () => {
    const driverSocket: ClientSocket = Client(`http://localhost:${port}`, {
      auth: { token: driverToken },
      transports: ['websocket'],
      autoConnect: true
    });
    activeSockets.push(driverSocket);

    const observerSocket: ClientSocket = Client(`http://localhost:${port}`, {
      auth: { token: observerToken },
      transports: ['websocket'],
      autoConnect: true
    });
    activeSockets.push(observerSocket);

    await waitForConnectAndJoin(driverSocket);
    await waitForConnectAndJoin(observerSocket);

    // Observer attempts redirect without force -> should receive session.error
    const observerErrorPromise = new Promise<string>((resolve) => {
      observerSocket.once('session.error', (err) => resolve(err.message));
      observerSocket.emit('session.redirect', {
        workspaceId,
        sessionId,
        instruction: 'Unauthorized observer redirect'
      });
    });

    const errorMsg = await observerErrorPromise;
    expect(errorMsg).toContain('Only the current Driver may redirect');

    // Driver attempts redirect -> should be accepted
    const driverRedirectPromise = new Promise<void>((resolve) => {
      driverSocket.once('session.redirect_accepted', (res) => {
        expect(res.redirectId).toBeDefined();
        resolve();
      });
      driverSocket.emit('session.redirect', {
        workspaceId,
        sessionId,
        instruction: 'Authorized driver redirect'
      });
    });

    await driverRedirectPromise;
  }, 10000);
});
