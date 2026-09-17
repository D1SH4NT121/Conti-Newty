import request from 'supertest';
import { createApp } from '../../src/api/app';

describe('Figma Make Experience & Route Integrity Verification', () => {
  const app = createApp();

  test('1. GET / returns authentic Conti-Newty landing page experience', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Conti-Newty');
    expect(res.text).toContain('app-container');
  });

  test('2. GET /auth serves SPA route for Sign In / Sign Up', async () => {
    const res = await request(app).get('/auth');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Conti-Newty');
  });

  test('3. GET /enter serves SPA route for Enter Workspace selector', async () => {
    const res = await request(app).get('/enter');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Conti-Newty');
  });

  test('4. GET /onboarding serves SPA route for 3-step institutional wizard', async () => {
    const res = await request(app).get('/onboarding');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Conti-Newty');
  });

  test('5. GET /w/:workspaceId/home serves SPA route for Workspace Shell', async () => {
    const res = await request(app).get('/w/test-ws-id/home');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Conti-Newty');
  });

  test('6. GET /w/:workspaceId/ask serves SPA route for Ask Engine', async () => {
    const res = await request(app).get('/w/test-ws-id/ask');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Conti-Newty');
  });

  test('7. GET /w/:workspaceId/brain serves SPA route for Company Brain Explorer', async () => {
    const res = await request(app).get('/w/test-ws-id/brain');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Conti-Newty');
  });
});
