import { createApp } from './src/api/app';
import request from 'supertest';

async function run() {
  const app = createApp();

  const res1 = await request(app)
    .options('/api/auth/me')
    .set('Origin', 'http://localhost:5173');

  console.log('Allowed Origin Dev:', res1.headers['access-control-allow-origin']);

  const res2 = await request(app)
    .options('/api/auth/me')
    .set('Origin', 'http://malicious.com');

  console.log('Disallowed Origin:', res2.headers['access-control-allow-origin']);
}
run();
