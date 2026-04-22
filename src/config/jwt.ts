import jwt from 'jsonwebtoken';

const jwtSecret = process.env['JWT_SECRET'];
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required');
}

export const JWT_CONFIG = {
  secret: jwtSecret,
  expiresIn: process.env['JWT_EXPIRES_IN'] || '7d',
  refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] || '30d',
  issuer: 'bounties-api',
  audience: 'bounties-users'
};

export interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
  planId?: string;
  planName?: 'BASIC' | 'CORE' | 'ENTERPRISE';
  planExpiresAt?: string | null;
  status?: 'active' | 'inactive';
  /** Host: company profile step completed (part two). */
  registerCompleted?: boolean;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export const generateToken = (payload: Omit<JWTPayload, 'iat' | 'exp' | 'iss' | 'aud'>): string => {
  const options = {
    expiresIn: JWT_CONFIG.expiresIn,
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience
  };
  
  return jwt.sign(payload as any, JWT_CONFIG.secret, options as any);
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.secret, {
      issuer: JWT_CONFIG.issuer,
      audience: JWT_CONFIG.audience
    }) as unknown as JWTPayload;
    return decoded;
  } catch (error: any) {
    throw new Error('Invalid or expired token');
  }
};

export const generateRefreshToken = (payload: Pick<JWTPayload, 'userId' | 'email' | 'role'>): string => {
  return jwt.sign(payload as any, JWT_CONFIG.secret, {
    expiresIn: JWT_CONFIG.refreshExpiresIn,
    issuer: JWT_CONFIG.issuer,
    audience: JWT_CONFIG.audience
  } as any);
};

export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1] || null;
};
