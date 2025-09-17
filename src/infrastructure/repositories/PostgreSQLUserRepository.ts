import { Database } from '../database/Database';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  company?: string;
}

export class PostgreSQLUserRepository {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const hashedPassword = await bcrypt.hash(input.password, 10);

    const result = await this.db.query(
      `INSERT INTO users (email, password, first_name, last_name, company)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, company, created_at, updated_at`,
      [input.email, hashedPassword, input.firstName, input.lastName, input.company]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      password: hashedPassword,
      firstName: row.first_name,
      lastName: row.last_name,
      company: row.company,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT id, email, password, first_name, last_name, company, created_at, updated_at
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      firstName: row.first_name,
      lastName: row.last_name,
      company: row.company,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query(
      `SELECT id, email, password, first_name, last_name, company, created_at, updated_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      firstName: row.first_name,
      lastName: row.last_name,
      company: row.company,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }

  async updateUser(id: string, updates: Partial<CreateUserInput>): Promise<User | null> {
    const setClause = [];
    const values = [];
    let paramIndex = 1;

    if (updates.firstName !== undefined) {
      setClause.push(`first_name = $${paramIndex++}`);
      values.push(updates.firstName);
    }
    if (updates.lastName !== undefined) {
      setClause.push(`last_name = $${paramIndex++}`);
      values.push(updates.lastName);
    }
    if (updates.company !== undefined) {
      setClause.push(`company = $${paramIndex++}`);
      values.push(updates.company);
    }
    if (updates.password !== undefined) {
      const hashedPassword = await bcrypt.hash(updates.password, 10);
      setClause.push(`password = $${paramIndex++}`);
      values.push(hashedPassword);
    }

    if (setClause.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await this.db.query(
      `UPDATE users SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING id, email, password, first_name, last_name, company, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      firstName: row.first_name,
      lastName: row.last_name,
      company: row.company,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );

    return result.rowCount > 0;
  }
}