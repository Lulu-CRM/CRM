import type { PaginationMeta } from '@lulu/shared';
import type { Response } from 'express';

export function ok(res: Response, data: unknown, meta?: PaginationMeta): Response {
  return meta === undefined ? res.status(200).json({ data }) : res.status(200).json({ data, meta });
}

export function created(res: Response, data: unknown): Response {
  return res.status(201).json({ data });
}

export function noContent(res: Response): Response {
  return res.status(204).send();
}

export function paginated(res: Response, items: unknown, meta: PaginationMeta): Response {
  return res.status(200).json({ data: items, meta });
}
