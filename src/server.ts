import http from 'http';
import { createApp } from './api/app';
import { createSocketServer } from './realtime/socket-server';
import { config } from './config';

export function startServer(port: number = config.port) {
  if (!config.jwtSecret && config.nodeEnv !== 'test') {
    throw new Error('JWT_SECRET environment variable is missing. Refusing to start server in production.');
  }

  const app = createApp();
  const server = http.createServer(app);
  const { io, presenceManager } = createSocketServer(server);
  app.set('io', io);

  server.listen(port, () => {
    console.log(`Workbench HTTP & WebSocket Server running at http://localhost:${port}`);
  });

  return { server, io, presenceManager, app };
}

if (require.main === module) {
  startServer();
}
// Conti-Newty Living Product Interface Server

