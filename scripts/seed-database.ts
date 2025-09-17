#!/usr/bin/env ts-node

import * as dotenv from 'dotenv';
import { Database } from '../src/infrastructure/database/Database';

dotenv.config();

async function seedDatabase() {
  const db = Database.getInstance();

  try {
    console.log('Seeding database with sample data...');

    // Seed price_master with sample SKUs
    const sampleSKUs = [
      {
        sku: 'NFC25',
        family: 'Corrugated Conduit',
        description: '25mm Corrugated Flexible Conduit',
        size_mm: 25,
        size_inches: 0.98,
        material: 'PVC',
        color: 'Black',
        unit_price: 22.30,
        uom: 'M',
        tolerance_mm: 2.0,
        coil_length_mm: 50000,
        category: 'Electrical Conduit'
      },
      {
        sku: 'NFC32',
        family: 'Corrugated Conduit',
        description: '32mm Corrugated Flexible Conduit',
        size_mm: 32,
        size_inches: 1.26,
        material: 'PVC',
        color: 'Black',
        unit_price: 25.50,
        uom: 'M',
        tolerance_mm: 2.0,
        coil_length_mm: 50000,
        category: 'Electrical Conduit'
      },
      {
        sku: 'STC20',
        family: 'Smooth Conduit',
        description: '20mm Smooth Flexible Conduit',
        size_mm: 20,
        size_inches: 0.79,
        material: 'PVC',
        color: 'Grey',
        unit_price: 18.75,
        uom: 'M',
        tolerance_mm: 1.5,
        coil_length_mm: 50000,
        category: 'Electrical Conduit'
      }
    ];

    for (const sku of sampleSKUs) {
      await db.query(`
        INSERT INTO price_master (
          sku, family, description, size_mm, size_inches, material, color,
          unit_price, uom, tolerance_mm, coil_length_mm, category
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (sku) DO UPDATE SET
          family = EXCLUDED.family,
          description = EXCLUDED.description,
          size_mm = EXCLUDED.size_mm,
          size_inches = EXCLUDED.size_inches,
          material = EXCLUDED.material,
          color = EXCLUDED.color,
          unit_price = EXCLUDED.unit_price,
          uom = EXCLUDED.uom,
          tolerance_mm = EXCLUDED.tolerance_mm,
          coil_length_mm = EXCLUDED.coil_length_mm,
          category = EXCLUDED.category,
          updated_at = CURRENT_TIMESTAMP
      `, [
        sku.sku, sku.family, sku.description, sku.size_mm, sku.size_inches,
        sku.material, sku.color, sku.unit_price, sku.uom, sku.tolerance_mm,
        sku.coil_length_mm, sku.category
      ]);
    }

    // Seed sku_aliases
    const aliases = [
      { alias: '25mm conduit', sku: 'NFC25', score_bonus: 0.1 },
      { alias: '32mm conduit', sku: 'NFC32', score_bonus: 0.1 },
      { alias: '20mm smooth', sku: 'STC20', score_bonus: 0.1 },
      { alias: 'corrugated 25', sku: 'NFC25', score_bonus: 0.05 },
      { alias: 'corrugated 32', sku: 'NFC32', score_bonus: 0.05 }
    ];

    for (const alias of aliases) {
      await db.query(`
        INSERT INTO sku_aliases (alias, sku, score_bonus)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [alias.alias, alias.sku, alias.score_bonus]);
    }

    // Create a test user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('password123', 10);

    await db.query(`
      INSERT INTO users (email, password, first_name, last_name, company)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        company = EXCLUDED.company,
        updated_at = CURRENT_TIMESTAMP
    `, ['test@example.com', hashedPassword, 'Test', 'User', 'Test Company']);

    console.log('Database seeded successfully!');
    console.log('Test user created: test@example.com / password123');

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

seedDatabase();