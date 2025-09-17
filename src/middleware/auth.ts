import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { UserProfile } from '../domain/entities/User';

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

export class AuthMiddleware {
  constructor(private authService: AuthService) {}

  authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      const user = await this.authService.verifyToken(token);
      req.user = user;

      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
  };

  optional = async (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const user = await this.authService.verifyToken(token);
        req.user = user;
      }

      next();
    } catch (error) {
      // Continue without user context if token is invalid
      next();
    }
  };
}