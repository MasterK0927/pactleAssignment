import { IUserRepository } from '../../domain/interfaces/auth';
import { PostgreSQLUserRepositoryAdapter } from './PostgreSQLUserRepositoryAdapter';
import { InMemoryUserRepository } from './InMemoryUserRepository';
import { Database } from '../database/Database';

export class HybridUserRepository implements IUserRepository {
  private pgRepo: PostgreSQLUserRepositoryAdapter;
  private memoryRepo: InMemoryUserRepository;
  private database: Database;

  constructor() {
    this.pgRepo = new PostgreSQLUserRepositoryAdapter();
    this.memoryRepo = new InMemoryUserRepository();
    this.database = Database.getInstance();
  }

  private async isDatabaseAvailable(): Promise<boolean> {
    try {
      return await this.database.isConnected();
    } catch (error) {
      return false;
    }
  }

  async create(data: { email: string; password: string }): Promise<{
    id: string;
    email: string;
    password_hash: string;
    created_at: Date;
    updated_at: Date;
  }> {
    try {
      return await this.pgRepo.create(data);
    } catch (error) {
      console.warn('PostgreSQL create failed, using in-memory fallback:', error instanceof Error ? error.message : 'Unknown error');
      return await this.memoryRepo.create(data);
    }
  }

  async findByEmail(email: string): Promise<{
    id: string;
    email: string;
    password_hash: string;
    created_at: Date;
    updated_at: Date;
  } | null> {
    console.log('🔍 HybridUserRepository.findByEmail called for:', email);
    
    try {
      console.log('💾 Trying PostgreSQL...');
      const result = await this.pgRepo.findByEmail(email);
      console.log('💾 PostgreSQL result:', result ? `Found user ${result.id}` : 'User not found');
      return result;
    } catch (error) {
      console.error('❌ PostgreSQL findByEmail failed:', error);
      console.warn('Using in-memory fallback:', error instanceof Error ? error.message : 'Unknown error');
      
      console.log('🧠 Trying in-memory storage...');
      const memResult = await this.memoryRepo.findByEmail(email);
      console.log('🧠 In-memory result:', memResult ? `Found user ${memResult.id}` : 'User not found');
      return memResult;
    }
  }

  async findById(id: string): Promise<{
    id: string;
    email: string;
    password_hash: string;
    created_at: Date;
    updated_at: Date;
  } | null> {
    try {
      return await this.pgRepo.findById(id);
    } catch (error) {
      console.warn('PostgreSQL findById failed, using in-memory fallback:', error instanceof Error ? error.message : 'Unknown error');
      return await this.memoryRepo.findById(id);
    }
  }
}