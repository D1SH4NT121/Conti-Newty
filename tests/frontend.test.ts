import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../src/api/app';

describe('Interactive Web Frontend (Workbench UI)', () => {
  let app: any;

  beforeAll(() => {
    app = createApp();
  });

  it('GET / should serve index.html with Workbench title and core UI containers', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Conti-Newty Workbench');
    expect(res.text).toContain('app-container');
  });

  it('GET /css/styles.css should serve frontend stylesheet', async () => {
    const res = await request(app).get('/css/styles.css');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/css');
  });

  it('GET /js/app.js should serve frontend client scripts', async () => {
    const res = await request(app).get('/js/app.js');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
  });
});
