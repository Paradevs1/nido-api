import { Request, Response, NextFunction } from 'express';

/**
 * Guard that protects cron/job endpoints.
 * Validates the request against CRON_SECRET via:
 *   - Header: Authorization: Bearer <secret>
 *   - Header: x-cron-secret: <secret>
 *   - Query:  ?cron_secret=<secret>
 *
 * Vercel cron jobs send Authorization: Bearer <CRON_SECRET> by default.
 */
export const cronGuard = (req: Request, res: Response, next: NextFunction): void => {
  const cronSecret = process.env['CRON_SECRET'];

  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not configured');
    res.status(500).json({ message: 'Server misconfiguration' });
    return;
  }

  const fromAuth = req.headers.authorization?.replace('Bearer ', '');
  const fromHeader = req.headers['x-cron-secret'] as string | undefined;
  const fromQuery = req.query['cron_secret'] as string | undefined;

  const provided = fromAuth || fromHeader || fromQuery;

  if (!provided || provided !== cronSecret) {
    res.status(401).json({
      message: 'Unauthorized — invalid or missing cron secret',
      error: 'CRON_UNAUTHORIZED'
    });
    return;
  }

  next();
};
