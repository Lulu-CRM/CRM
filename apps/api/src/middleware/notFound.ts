import { ERROR_CODES } from '@lulu/shared';
import type { RequestHandler } from 'express';

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: {
      code: ERROR_CODES.NOT_FOUND,
      message: 'errors.not_found',
      details: null,
    },
  });
};
