/**
 * Demo-login security: tokens are minted server-side with the live JWT_SECRET,
 * there is no admin role, and unknown roles are rejected.
 */

process.env['JWT_SECRET'] = process.env['JWT_SECRET'] || 'test-secret-key-for-tests-only';

import request from 'supertest';
import express, { Application } from 'express';
import demoRoutes from '../../routes/demo.routes';
import { verifyToken } from '../../config/jwt';

const app: Application = express();
app.use(express.json());
app.use('/api/demo', demoRoutes);

describe('POST /api/demo/login', () => {
  it('issues a valid JWT for the host role, signed with the live secret', async () => {
    const res = await request(app).post('/api/demo/login').send({ role: 'host' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
    const decoded = verifyToken(res.body.data.token);
    expect(decoded.role).toBe('HOST');
    expect(res.body.data.redirect).toMatch(/^\/host\/campaign\//);
  });

  it('issues tokens for all 5 talent slots', async () => {
    for (let n = 1; n <= 5; n++) {
      const res = await request(app).post('/api/demo/login').send({ role: `talent${n}` });
      expect(res.status).toBe(200);
      expect(verifyToken(res.body.data.token).role).toBe('CREATOR');
      expect(res.body.data.redirect).toMatch(/^\/creator\/campaign\//);
    }
  });

  it('refuses to mint an admin/arbiter token', async () => {
    const res = await request(app).post('/api/demo/login').send({ role: 'admin' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects unknown roles', async () => {
    const res = await request(app).post('/api/demo/login').send({ role: 'superuser' });
    expect(res.status).toBe(400);
  });
});
