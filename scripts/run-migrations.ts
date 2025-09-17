#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
import { Migration } from '../src/infrastructure/database/Migration';
import { Database } from '../src/infrastructure/database/Database';
import { join } from 'path';

dotenv.config();

async function runMigrations() {
  const migration = new Migration();
  const db = Database.getInstance();

  try {
    console.log('Testing database connection...');
    const isConnected = await db.testConnection();

    if (!isConnected) {
      console.error('Failed to connect to database. Please check your connection settings.');
      process.exit(1);
    }

    const migrationsDir = join(__dirname, '../database/migrations');
    await migration.runMigrations(migrationsDir);

    console.log('Migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

runMigrations();