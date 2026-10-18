import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { errorHandler, toAppError } from './errorHandler';
import { notFound } from './notFound';
import { requestId } from './requestId';

const app = express();
app.use(requestId);
app.use(express.json());

app.get('/throw-app-error', (_req, _res, next) => {
  next(AppError.notFound('CONTACT_NOT_FOUND'));
});
app.get('/throw-app-error-details', (_req, _res, next) => {
  next(AppError.validation([{ path: 'email', code: 'invalid_format', message: 'errors.validation.invalid_format' }]));
});
app.get('/throw-unknown', (_req, _res, next) => {
  next(new Error('secret database password is hunter2'));
});
app.post('/parse-body', (req, res, next) => {
  const result = z.object({ email: z.email() }).safeParse(req.body as unknown);
  if (!result.success) {
    next(result.error);
    return;
  }
  res.status(200).json({ data: result.data });
});
app.get('/throw-prisma-conflict', (_req, _res, next) => {
  const err = new Error('Unique constraint failed') as Error & { code: string };
  err.code = 'P2002';
  next(err);
});
app.get('/throw-prisma-not-found', (_req, _res, next) => {
  const err = new Error('Record not found') as Error & { code: string };
  err.code = 'P2025';
  next(err);
});
app.use(notFound);
app.use(errorHandler);

describe('errorHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps AppError to its status, code and message key', async () => {
    const res = await request(app).get('/throw-app-error');
    expect(res.status).toBe(404);
    const b = res.body;
    expect(b.error.code).toBe('CONTACT_NOT_FOUND');
    expect(b.error.message).toBe('errors.contact_not_found');
    expect(b.error.details).toBeNull();
  });

  it('passes AppError details through', async () => {
    const res = await request(app).get('/throw-app-error-details');
    expect(res.status).toBe(400);
    expect((res.body).error.details).toEqual([
      { path: 'email', code: 'invalid_format', message: 'errors.validation.invalid_format' },
    ]);
  });

  it('maps ZodError to 400 VALIDATION_ERROR with per-issue message keys', async () => {
    const res = await request(app)
      .post('/parse-body')
      .set('Content-Type', 'application/json')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect((res.body).error.code).toBe('VALIDATION_ERROR');
    expect((res.body).error.message).toBe('errors.validation_error');
    expect((res.body).error.details).toEqual([
      expect.objectContaining({ path: 'email', code: 'invalid_format', message: 'errors.validation.invalid_format' }),
    ]);
  });

  it('maps malformed JSON to 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/parse-body')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(res.status).toBe(400);
    expect((res.body).error).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'errors.validation_error',
      details: [{ path: 'body', code: 'invalid_json', message: 'errors.validation.invalid_json' }],
    });
  });

  it('maps Prisma P2002 to 409 CONFLICT', async () => {
    const res = await request(app).get('/throw-prisma-conflict');
    expect(res.status).toBe(409);
    expect((res.body).error.code).toBe('CONFLICT');
    expect((res.body).error.message).toBe('errors.conflict');
  });

  it('maps Prisma P2025 to 404 NOT_FOUND', async () => {
    const res = await request(app).get('/throw-prisma-not-found');
    expect(res.status).toBe(404);
    expect((res.body).error.code).toBe('NOT_FOUND');
  });

  it('maps unknown errors to 500 INTERNAL_ERROR without leaking details, and logs server-side', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await request(app).get('/throw-unknown');
    expect(res.status).toBe(500);
    expect((res.body).error.code).toBe('INTERNAL_ERROR');
    expect((res.body).error.message).toBe('errors.internal_error');
    expect((res.body).error.details).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(JSON.stringify(res.body)).not.toContain('stack');
    expect(consoleSpy).toHaveBeenCalledOnce();
  });

  it('toAppError handles non-Error values as INTERNAL_ERROR', () => {
    const appError = toAppError('boom');
    expect(appError.code).toBe('INTERNAL_ERROR');
    expect(appError.status).toBe(500);
    expect(appError.details).toBeNull();
  });
});
