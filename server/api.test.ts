import request from 'supertest';
import { describe, it, expect } from 'vitest';

// We'll point supertest to your running server URL for the most realistic integration test
const API_URL = 'http://localhost:3000';

describe('Backend API Integration', () => {
  it('GET /api/health should return 200 OK', async () => {
    const res = await request(API_URL).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });

  it('GET /api/items should return a response (even if empty or demo mode)', async () => {
    // This tests that our "Demo Mode" fallback works when DB is disconnected
    const res = await request(API_URL).get('/api/items');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/users/profile should return 200 (Demo Mode Fallback) when DB is offline', async () => {
    // Current server logic returns a Guest profile when MongoDB is disconnected
    // instead of a 401, to allow previewing the UI.
    const res = await request(API_URL).get('/api/users/profile');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('name', 'Guest');
  });

  it('GET /api/non-existent-route should return JSON 404, not HTML', async () => {
    const res = await request(API_URL).get('/api/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toHaveProperty('error');
  });
});
