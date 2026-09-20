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
  googleRedirectUri: string;
  googleClientId: string;
  googleClientSecret: string;
  githubClientId: string;
  githubClientSecret: string;
  jiraClientId: string;
  jiraClientSecret: string;
  slackClientId: string;
  slackClientSecret: string;
  aiProvider: string;
  allowedOrigins: string[];
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  socketIoOrigin: process.env.SOCKET_IO_ORIGIN || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  jiraClientId: process.env.JIRA_CLIENT_ID || '',
  jiraClientSecret: process.env.JIRA_CLIENT_SECRET || '',
  slackClientId: process.env.SLACK_CLIENT_ID || '',
  slackClientSecret: process.env.SLACK_CLIENT_SECRET || '',
  aiProvider: process.env.AI_PROVIDER || (process.env.NODE_ENV === 'production' ? 'bedrock' : 'claude'),
  allowedOrigins: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : (process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://localhost:3000'] : [])
};

export { config };