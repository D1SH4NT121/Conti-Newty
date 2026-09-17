import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file, overriding existing ones
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

interface Config {
  port: number;
  nodeEnv: string;
  anthropicApiKey: string;
  databaseUrl: string;
  jwtSecret: string;
  socketIoOrigin: string;
  frontendUrl: string;
  googleClientId: string;
  googleClientSecret: string;
  githubClientId: string;
  githubClientSecret: string;
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  socketIoOrigin: process.env.SOCKET_IO_ORIGIN || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || ''
};

export { config };