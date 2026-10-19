import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.id = incoming !== undefined && incoming.length > 0 ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
