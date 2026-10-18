import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { created, noContent, ok, paginated } from './response';

const app = express();

app.get('/ok', (_req, res) => {
  ok(res, { hello: 'world' });
});
app.get('/ok-meta', (_req, res) => {
  ok(res, [1, 2], { page: 2, pageSize: 25, total: 100 });
});
app.get('/created', (_req, res) => {
  created(res, { id: '1' });
});
app.get('/no-content', (_req, res) => {
  noContent(res);
});
app.get('/paginated', (_req, res) => {
  paginated(res, [{ id: '1' }], { page: 1, pageSize: 10, total: 1 });
});

describe('response helpers', () => {
  it('ok sends 200 with data and omits meta when undefined', async () => {
    const res = await request(app).get('/ok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { hello: 'world' } });
    expect('meta' in res.body).toBe(false);
  });

  it('ok includes meta when given', async () => {
    const res = await request(app).get('/ok-meta');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [1, 2], meta: { page: 2, pageSize: 25, total: 100 } });
  });

  it('created sends 201 with data', async () => {
    const res = await request(app).get('/created');
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ data: { id: '1' } });
  });

  it('noContent sends 204 with empty body', async () => {
    const res = await request(app).get('/no-content');
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  it('paginated sends 200 with data and meta', async () => {
    const res = await request(app).get('/paginated');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [{ id: '1' }], meta: { page: 1, pageSize: 10, total: 1 } });
  });
});
