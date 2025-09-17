import { Database } from './Database';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface MigrationRecord {
  id: number;
  name: string;
  executed_at: Date;
}

export class Migration {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  public async createMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await this.db.query(query);
  }

  public async getExecutedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.db.query('SELECT * FROM migrations ORDER BY id');
    return result.rows;
  }

  public async executeMigration(name: string, sql: string): Promise<void> {
    await this.db.transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [name]);
    });
  }

  public async runMigrations(migrationsDir: string = './database/migrations'): Promise<void> {
    console.log('Starting database migrations...');

    await this.createMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();
    const executedNames = new Set(executedMigrations.map(m => m.name));

    try {
      const migrationFiles = readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        const migrationName = file.replace('.sql', '');

        if (executedNames.has(migrationName)) {
          console.log(`Migration ${migrationName} already executed, skipping...`);
          continue;
        }

        console.log(`Executing migration: ${migrationName}`);
        const migrationPath = join(migrationsDir, file);
        const sql = readFileSync(migrationPath, 'utf-8');

        await this.executeMigration(migrationName, sql);
        console.log(`Migration ${migrationName} completed successfully`);
      }

      console.log('All migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }

  public async rollbackLastMigration(): Promise<void> {
    const executed = await this.getExecutedMigrations();
    if (executed.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastMigration = executed[executed.length - 1];
    console.log(`Rolling back migration: ${lastMigration.name}`);

    // TODO: basic impl; in production store rollback scripts per migration
    await this.db.query('DELETE FROM migrations WHERE name = $1', [lastMigration.name]);
    console.log(`Rollback completed for: ${lastMigration.name}`);
  }
}