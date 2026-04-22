import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export const validate = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const messages = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`);
    res.status(422).json({
      message: 'Validation error',
      error: 'VALIDATION_ERROR',
      details: messages
    });
    return;
  }
  req.body = result.data;
  next();
};

export const validateQuery = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const messages = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`);
    res.status(422).json({
      message: 'Validation error',
      error: 'VALIDATION_ERROR',
      details: messages
    });
    return;
  }
  req.query = result.data as any;
  next();
};

export const validateParams = (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction): void => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    const messages = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`);
    res.status(422).json({
      message: 'Validation error',
      error: 'VALIDATION_ERROR',
      details: messages
    });
    return;
  }
  req.params = result.data as any;
  next();
};
