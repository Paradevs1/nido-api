import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader, JWTPayload } from '../config/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authGuard = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({
        message: 'Access token not provided',
        error: 'MISSING_TOKEN'
      });
      return;
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    
    next();
  } catch (error) {
    res.status(401).json({
      message: 'Invalid or expired token',
      error: 'INVALID_TOKEN'
    });
  }
};

export const creatorGuard = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({
        message: 'Access token not provided',
        error: 'MISSING_TOKEN'
      });
      return;
    }

    const decoded = verifyToken(token);
    
    if (!decoded.role || decoded.role !== 'CREATOR') {
      res.status(403).json({
        message: 'Only CREATOR users can access this resource',
        error: 'FORBIDDEN'
      });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      message: 'Invalid or expired token',
      error: 'INVALID_TOKEN'
    });
  }
};

export const hostEnterpriseGuard = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        message: 'Access token not provided',
        error: 'MISSING_TOKEN'
      });
      return;
    }

    const decoded = verifyToken(token);

    if (!decoded.role || decoded.role !== 'HOST') {
      res.status(403).json({
        message: 'Only HOST users can access this resource',
        error: 'FORBIDDEN'
      });
      return;
    }

    if (decoded.planName !== 'ENTERPRISE') {
      res.status(403).json({
        message: 'Only hosts with ENTERPRISE plan can access communities',
        error: 'PLAN_REQUIRED'
      });
      return;
    }

    if (decoded.planExpiresAt && new Date(decoded.planExpiresAt) < new Date()) {
      res.status(403).json({
        message: 'Your ENTERPRISE plan has expired. Renew the plan to access communities.',
        error: 'PLAN_EXPIRED'
      });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      message: 'Invalid or expired token',
      error: 'INVALID_TOKEN'
    });
  }
};

export const hostGuard = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({
        message: 'Access token not provided',
        error: 'MISSING_TOKEN'
      });
      return;
    }

    const decoded = verifyToken(token);
    
    if (!decoded.role || decoded.role !== 'HOST') {
      res.status(403).json({
        message: 'Only HOST users can access this resource',
        error: 'FORBIDDEN'
      });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      message: 'Invalid or expired token',
      error: 'INVALID_TOKEN'
    });
  }
};

export const adminGuard = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      res.status(401).json({
        message: 'Access token not provided',
        error: 'MISSING_TOKEN'
      });
      return;
    }

    const decoded = verifyToken(token);
    
    if (!decoded.role || decoded.role !== 'ADMIN') {
      res.status(403).json({
        message: 'Only ADMIN users can access this resource',
        error: 'FORBIDDEN'
      });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      message: 'Invalid or expired token',
      error: 'INVALID_TOKEN'
    });
  }
};

export const authenticatedUserGuard = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (!token) {
      next();
      return;
    }

    let decoded: JWTPayload;
    try {
      decoded = verifyToken(token);
    } catch (tokenError: any) {
      next();
      return;
    }
    
    if (!decoded.role || !['HOST', 'CREATOR', 'ADMIN'].includes(decoded.role)) {
      next();
      return;
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    next();
  }
};

export const optionalAuthGuard = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);
    
    if (token) {
      try {
        const decoded = verifyToken(token);
        req.user = decoded;
      } catch (error) {

      }
    }
    
    next();
  } catch (error) {
    next();
  }
};