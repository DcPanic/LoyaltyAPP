import type { NextFunction, Request, Response } from 'express';
import type { TypeOf, ZodTypeAny } from 'zod';
import { badRequest } from './errors.js';

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

export const asyncHandler =
  (fn: Handler) => (req: Request, res: Response, next: NextFunction) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): TypeOf<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest('Validation failed', result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    })));
  }
  return result.data;
}

export const parseBody = <S extends ZodTypeAny>(schema: S, req: Request): TypeOf<S> =>
  parse(schema, req.body);
export const parseQuery = <S extends ZodTypeAny>(schema: S, req: Request): TypeOf<S> =>
  parse(schema, req.query);

export function clientIp(req: Request): string | undefined {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0]!.trim();
  return req.ip;
}
