import { Database } from '../database/Database';

export interface UserCredits {
  id: string;
  user_id: string;
  credits: number;
  created_at: Date;
  updated_at: Date;
}

export class PostgreSQLCreditsRepository {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async getCredits(userId: string): Promise<number> {
    try {
      const result = await this.db.query(
        'SELECT credits FROM user_credits WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        // Create default credits entry for new user
        await this.setCredits(userId, 10); // Default 10 credits
        return 10;
      }

      return result.rows[0].credits || 0;
    } catch (error) {
      console.error('Error getting credits:', error);
      return 0;
    }
  }

  async setCredits(userId: string, credits: number): Promise<void> {
    const safeCredits = Number.isFinite(credits) ? Math.max(0, Math.floor(credits)) : 0;
    
    try {
      await this.db.query(
        `INSERT INTO user_credits (user_id, credits) 
         VALUES ($1, $2) 
         ON CONFLICT (user_id) 
         DO UPDATE SET credits = $2, updated_at = CURRENT_TIMESTAMP`,
        [userId, safeCredits]
      );
    } catch (error) {
      console.error('Error setting credits:', error);
      throw new Error('Failed to set credits');
    }
  }

  async addCredits(userId: string, delta: number): Promise<void> {
    const addition = Number.isFinite(delta) ? Math.max(0, Math.floor(delta)) : 0;
    if (addition === 0) return;

    try {
      await this.db.query(
        `INSERT INTO user_credits (user_id, credits) 
         VALUES ($1, $2) 
         ON CONFLICT (user_id) 
         DO UPDATE SET credits = user_credits.credits + $2, updated_at = CURRENT_TIMESTAMP`,
        [userId, addition]
      );
    } catch (error) {
      console.error('Error adding credits:', error);
      throw new Error('Failed to add credits');
    }
  }

  async deductCredits(userId: string, amount: number = 1): Promise<boolean> {
    const deduction = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 1;
    
    try {
      const result = await this.db.query(
        `UPDATE user_credits 
         SET credits = credits - $2, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1 AND credits >= $2
         RETURNING credits`,
        [userId, deduction]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deducting credits:', error);
      return false;
    }
  }

  async hasEnoughCredits(userId: string, required: number = 1): Promise<boolean> {
    try {
      const credits = await this.getCredits(userId);
      return credits >= required;
    } catch (error) {
      console.error('Error checking credits:', error);
      return false;
    }
  }

  async getUserCreditsRecord(userId: string): Promise<UserCredits | null> {
    try {
      const result = await this.db.query(
        'SELECT id, user_id, credits, created_at, updated_at FROM user_credits WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        user_id: row.user_id,
        credits: row.credits,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
    } catch (error) {
      console.error('Error getting user credits record:', error);
      return null;
    }
  }
}
