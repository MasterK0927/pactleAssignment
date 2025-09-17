import { PostgreSQLCreditsRepository } from '../infrastructure/repositories/PostgreSQLCreditsRepository';
import { Database } from '../infrastructure/database/Database';

export class CreditsService {
  private static instance: CreditsService;
  private creditsRepo: PostgreSQLCreditsRepository;
  // keeping this in memory for session-based idempotency
  private chargedKeys = new Set<string>();
  private db: Database;

  private constructor() {
    this.creditsRepo = new PostgreSQLCreditsRepository();
    this.db = Database.getInstance();
  }

  static getInstance(): CreditsService {
    if (!CreditsService.instance) {
      CreditsService.instance = new CreditsService();
    }
    return CreditsService.instance;
  }

  async getCredits(buyerId: string): Promise<number> {
    try {
      return await this.creditsRepo.getCredits(buyerId);
    } catch (error) {
      console.error('Error getting credits:', error);
      return 0;
    }
  }

  async setCredits(buyerId: string, credits: number): Promise<void> {
    try {
      await this.creditsRepo.setCredits(buyerId, credits);
    } catch (error) {
      console.error('Error setting credits:', error);
      throw new Error('Failed to set credits');
    }
  }

  async addCredits(buyerId: string, delta: number): Promise<void> {
    try {
      await this.creditsRepo.addCredits(buyerId, delta);
    } catch (error) {
      console.error('Error adding credits:', error);
      throw new Error('Failed to add credits');
    }
  }

  hasBeenCharged(idempotencyKey: string): boolean {
    return this.chargedKeys.has(idempotencyKey);
  }

  /**
   * Charge one credit for the given buyer if not already charged for this key.
   * Ensures idempotency: repeated calls with the same key do not deduct twice.
   */
  async chargeIfNeeded(buyerId: string, idempotencyKey: string): Promise<void> {
    if (this.chargedKeys.has(idempotencyKey)) return;

    try {
      const hasEnough = await this.creditsRepo.hasEnoughCredits(buyerId, 1);
      if (!hasEnough) {
        throw new Error('Insufficient credits');
      }

      const success = await this.creditsRepo.deductCredits(buyerId, 1);
      if (!success) {
        throw new Error('Insufficient credits');
      }

      this.chargedKeys.add(idempotencyKey);
    } catch (error) {
      console.error('Error charging credits:', error);
      throw error;
    }
  }

  getCreditsSync(buyerId: string): number {
    console.warn('getCreditsSync is deprecated, use getCredits() instead');
    // For backward compatibility, return 0 and log warning
    return 0;
  }

  setCreditsSync(buyerId: string, credits: number): void {
    console.warn('setCreditsSync is deprecated, use setCredits() instead');
    // For backward compatibility, do nothing and log warning
  }

  addCreditsSync(buyerId: string, delta: number): void {
    console.warn('addCreditsSync is deprecated, use addCredits() instead');
    // For backward compatibility, do nothing and log warning
  }

  chargeIfNeededSync(buyerId: string, idempotencyKey: string): void {
    console.warn('chargeIfNeededSync is deprecated, use chargeIfNeeded() instead');
    // For backward compatibility, throw error to maintain behavior
    throw new Error('Insufficient credits - use async version');
  }
}


