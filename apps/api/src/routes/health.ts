import { Router, type Request, type Response } from 'express';

export interface HealthStatus {
  data: { status: 'ok' };
}

export function getHealthStatus(): HealthStatus {
  return { data: { status: 'ok' } };
}

export function healthHandler(_req: Request, res: Response): void {
  res.status(200).json(getHealthStatus());
}

export const healthRouter = Router();

healthRouter.get('/', healthHandler);
