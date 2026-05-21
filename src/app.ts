// Validate env vars before any other import
import './config/env';

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import mongo, { ensureIndexes } from './config/database';
import swaggerSpecs from './config/swagger';
import {
  RATE_LIMIT_GLOBAL_WINDOW_MS, RATE_LIMIT_GLOBAL_MAX,
  RATE_LIMIT_AUTH_WINDOW_MS, RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_PAYMENT_WINDOW_MS, RATE_LIMIT_PAYMENT_MAX,
  BODY_LIMIT
} from './utils/consts';

const app: Application = express();
const PORT: number = parseInt(process.env['PORT'] || '3002', 10);

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
});

mongo()
  .then(() => ensureIndexes())
  .catch((error) => {
    console.error('Error initializing MongoDB (will try to reconnect when needed):', error.message);
  });

const isDevOrQa = process.env['NODE_ENV'] === 'development' || process.env['NODE_ENV'] === 'qa';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: isDevOrQa
        ? ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]
        : ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));

const allowedOrigins = process.env['CORS_ALLOWED_ORIGINS']
  ? process.env['CORS_ALLOWED_ORIGINS'].split(',').map(o => o.trim())
  : [];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (server-to-server, curl, cron jobs)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any ngrok tunnel subdomain
    if (/^https:\/\/[a-z0-9-]+\.ngrok-free\.dev$/.test(origin)) return callback(null, true);
    // Reject: don't send Access-Control-Allow-Origin header — browser blocks the request
    callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'ngrok-skip-browser-warning']
};

app.use(cors(corsOptions));

const morganFormat = process.env['NODE_ENV'] === 'production' 
  ? 'combined' 
  : 'dev';

app.use(morgan(morganFormat));

const skipRateLimit = (req: any) => {
  const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
  const isDev = process.env['NODE_ENV'] !== 'production' && !process.env['NODE_ENV'];
  return isLocalhost || isDev;
};

const globalLimiter = rateLimit({
  windowMs: RATE_LIMIT_GLOBAL_WINDOW_MS,
  max: RATE_LIMIT_GLOBAL_MAX,
  message: { message: 'Too many requests from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit
});
app.use(globalLimiter);

export const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_AUTH_WINDOW_MS,
  max: RATE_LIMIT_AUTH_MAX,
  message: { message: 'Too many authentication attempts. Please try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit
});

export const paymentLimiter = rateLimit({
  windowMs: RATE_LIMIT_PAYMENT_WINDOW_MS,
  max: RATE_LIMIT_PAYMENT_MAX,
  message: { message: 'Too many payment requests. Please try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipRateLimit
});

if (process.env['NODE_ENV'] === 'development' || process.env['NODE_ENV'] === 'qa') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Bounties API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      showCommonExtensions: true
    }
  }));

  app.get('/api-docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpecs);
  });
}

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import creatorRoutes from './routes/creator.routes';
import hostRoutes from './routes/host.routes';
import paymentRoutes from './routes/payment.routes';
import jobRoutes from './routes/job.routes';
import waitlistRoutes from './routes/waitlist.route';
import planRoutes from './routes/plan.routes';
import communityRoutes from './routes/community.routes';
import notificationRoutes from './routes/notification.routes';
import stellarRoutes from './routes/stellar.routes';
import seedRoutes from './routes/seed.routes';

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/creator', creatorRoutes);
app.use('/api/host', hostRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/stellar', stellarRoutes);
if (process.env['SEED_SECRET']) app.use('/api/seed', seedRoutes);

app.get('/', (req: Request, res: Response) => {
  const response: any = {
    message: 'Bounties API is working!',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      creator: '/api/creator',
      host: '/api/host',
      payment: '/api/payment',
      jobs: '/api/jobs'
    },
    health: 'OK',
    timestamp: new Date().toISOString()
  };

  if (process.env['NODE_ENV'] === 'development' || process.env['NODE_ENV'] === 'qa') {
    response.documentation = '/api-docs';
    response.endpoints.docs = '/api-docs';
  }

  res.json(response);
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Verificar saúde da API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: API funcionando corretamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Tempo de execução em segundos
 *                 environment:
 *                   type: string
 *                   example: development
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 */
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env['NODE_ENV'] || 'development',
    version: '1.0.0'
  });
});

interface CustomError extends Error {
  status?: number;
  statusCode?: number;
}

app.use((err: CustomError, req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const isProduction = process.env['NODE_ENV'] === 'production';

  console.error(`[${req.method}] ${req.path} — ${status} ${err.name}: ${err.message}`);

  if (!isProduction) {
    console.error('Stack:', err.stack);
    console.error('Query:', req.query);
    console.error('Params:', req.params);
    console.error('Body:', req.body);
  }

  res.status(status).json({
    message: status >= 500 ? 'Internal server error' : err.message,
    error: isProduction && status >= 500 ? 'INTERNAL_ERROR' : err.message
  });
});

app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    message: 'Route not found',
    path: req.originalUrl
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
