import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Temporarily rename .env so dotenv doesn't load it
const envPath = path.resolve(process.cwd(), '.env');
const backupPath = path.resolve(process.cwd(), '.env.backup');

if (fs.existsSync(envPath)) {
  fs.renameSync(envPath, backupPath);
}

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['ts-node', 'src/server.ts'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    JWT_SECRET: ''
  }
});

let output = '';
child.stderr.on('data', data => output += data.toString());
child.stdout.on('data', data => output += data.toString());

child.on('close', code => {
  // Restore .env
  if (fs.existsSync(backupPath)) {
    fs.renameSync(backupPath, envPath);
  }
  console.log(`Exit code: ${code}`);
  console.log(`Output:\n${output}`);
});
