import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { User, CreateUserData } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/interfaces/auth';

export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  private emailIndex: Map<string, string> = new Map();

  async findByEmail(email: string): Promise<User | null> {
    const userId = this.emailIndex.get(email.toLowerCase());
    if (!userId) return null;
    return this.users.get(userId) || null;
  }

  async create(userData: CreateUserData): Promise<User> {
    const existingUser = await this.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const user: User = {
      id: uuidv4(),
      email: userData.email.toLowerCase(),
      password_hash: hashedPassword,
      created_at: new Date(),
      updated_at: new Date(),
    };

    this.users.set(user.id, user);
    this.emailIndex.set(user.email, user.id);

    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }
}