import { User, CreateUserData, UserProfile } from '../entities/User';

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  create(userData: CreateUserData): Promise<User>;
  findById(id: string): Promise<User | null>;
}

export interface IAuthService {
  signup(email: string, password: string): Promise<{ user: UserProfile; tokens: AuthTokens }>;
  signin(email: string, password: string): Promise<{ user: UserProfile; tokens: AuthTokens }>;
  verifyToken(token: string): Promise<UserProfile>;
  refreshToken(refreshToken: string): Promise<AuthTokens>;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}