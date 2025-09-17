import { IUserRepository } from '../../domain/interfaces/auth';
import { PostgreSQLUserRepository, User as PGUser } from './PostgreSQLUserRepository';

// Adapter to make PostgreSQL repository compatible with existing interface
export class PostgreSQLUserRepositoryAdapter implements IUserRepository {
  private pgRepo: PostgreSQLUserRepository;

  constructor() {
    this.pgRepo = new PostgreSQLUserRepository();
  }

  async create(data: { email: string; password: string }): Promise<{
    id: string;
    email: string;
    password_hash: string;
    created_at: Date;
    updated_at: Date;
  }> {
    const user = await this.pgRepo.createUser({
      email: data.email,
      password: data.password
    });

    return {
      id: user.id,
      email: user.email,
      password_hash: user.password,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    };
  }

  async findByEmail(email: string): Promise<{
    id: string;
    email: string;
    password_hash: string;
    created_at: Date;
    updated_at: Date;
  } | null> {
    const user = await this.pgRepo.findByEmail(email);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      password_hash: user.password,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    };
  }

  async findById(id: string): Promise<{
    id: string;
    email: string;
    password_hash: string;
    created_at: Date;
    updated_at: Date;
  } | null> {
    const user = await this.pgRepo.findById(id);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      password_hash: user.password,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    };
  }
}