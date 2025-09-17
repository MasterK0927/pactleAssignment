import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { IAuthService, IUserRepository, AuthTokens } from '../domain/interfaces/auth';
import { UserProfile } from '../domain/entities/User';

export class AuthService implements IAuthService {
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private jwtExpiresIn: string;

  constructor(private userRepository: IUserRepository) {
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';
  }

  async signup(email: string, password: string): Promise<{ user: UserProfile; tokens: AuthTokens }> {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    const user = await this.userRepository.create({ email, password });
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    };

    const tokens = this.generateTokens(user.id);

    return { user: userProfile, tokens };
  }

  async signin(email: string, password: string): Promise<{ user: UserProfile; tokens: AuthTokens }> {
    console.log('🔍 AuthService.signin called for:', email);
    
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    console.log('🔎 Looking up user in repository...');
    const user = await this.userRepository.findByEmail(email);
    console.log('👤 User lookup result:', user ? `Found user ${user.id}` : 'User not found');
    
    if (!user) {
      throw new Error('Invalid email or password');
    }

    console.log('🔐 Validating password...');
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    console.log('🔐 Password validation result:', isPasswordValid);
    
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    };

    const tokens = this.generateTokens(user.id);

    return { user: userProfile, tokens };
  }

  async verifyToken(token: string): Promise<UserProfile> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as { userId: string };
      const user = await this.userRepository.findById(decoded.userId);

      if (!user) {
        throw new Error('User not found');
      }

      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as { userId: string };
      const user = await this.userRepository.findById(decoded.userId);

      if (!user) {
        throw new Error('User not found');
      }

      return this.generateTokens(user.id);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  private generateTokens(userId: string): AuthTokens {
    const access_token = jwt.sign({ userId }, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    } as any);

    const refresh_token = jwt.sign({ userId }, this.jwtRefreshSecret, {
      expiresIn: '7d',
    } as any);

    const expiresIn = this.parseExpiresIn(this.jwtExpiresIn);

    return {
      access_token,
      refresh_token,
      expires_in: expiresIn,
    };
  }

  private parseExpiresIn(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1));

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 3600; // Default to 1 hour
    }
  }
}