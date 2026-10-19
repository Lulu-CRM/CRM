import { type LoginInput, loginInputSchema } from '@lulu/shared';
import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { noContent, ok } from '../lib/response';
import { denyToken } from '../lib/tokenDenylist';
import { readBearerToken, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { login, verifyToken } from '../services/auth';

export const authRouter = Router();

authRouter.post(
  '/auth/login',
  validate({ body: loginInputSchema }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as LoginInput;
    return ok(res, await login(email, password));
  }),
);

authRouter.post(
  '/auth/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const claims = verifyToken(readBearerToken(req.headers.authorization));
    await denyToken(claims.jti, claims.exp - Math.floor(Date.now() / 1000));
    return noContent(res);
  }),
);
