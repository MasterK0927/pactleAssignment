import * as fs from 'fs';
import * as path from 'path';
import { SKU } from '../domain/entities/SKU';

interface AppConfig {
  mapping: {
    auto_map_threshold: number;
    confidence_delta: number;
    size_tolerance_mm: number;
    fuzzy_weight: number;
    size_weight: number;
    material_weight: number;
    alias_weight: number;
  };
  pricing: {
    default_freight_rate: number;
    freight_min_amount: number;
    default_discount_pct: number;
    tax_inclusive: boolean;
  };
  coil_lengths: Record<string, number>;
}

interface SkuAliasRow {
  alias: string;
  sku_code: string;
  score_boost: string | number;
}

export class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig;

  private constructor() {
    this.loadConfig();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadConfig(): void {
    try {
      const configPath = path.join(process.cwd(), 'data', 'config.json');
      const configData = fs.readFileSync(configPath, 'utf-8');
      this.config = JSON.parse(configData);
    } catch (error) {
      console.warn('Failed to load config.json, using defaults:', error);
      // Default configuration
      this.config = {
        mapping: {
          auto_map_threshold: 0.85,
          confidence_delta: 0.12,
          size_tolerance_mm: 2.0,
          fuzzy_weight: 0.6,
          size_weight: 0.3,
          material_weight: 0.1,
          alias_weight: 0.1,
        },
        pricing: {
          default_freight_rate: 0.05,
          freight_min_amount: 50,
          default_discount_pct: 0,
          tax_inclusive: false,
        },
        coil_lengths: {},
      };
    }
  }

  public getMappingConfig() {
    return this.config.mapping;
  }

  public getPricingConfig() {
    return this.config.pricing;
  }

  public getCoilLengths() {
    return this.config.coil_lengths;
  }

  public getFullConfig(): AppConfig {
    return this.config;
  }

  public reload(): void {
    this.loadConfig();
  }

  public getSkuAliases(): SkuAliasRow[] {
    try {
      const aliasPath = path.join(process.cwd(), 'data', 'sku_aliases.csv');
      const csvContent = fs.readFileSync(aliasPath, 'utf-8');
      return this.parseSkuAliasesCsv(csvContent);
    } catch (error) {
      console.error('Failed to load SKU aliases CSV:', error);
      throw new Error(`Failed to load SKU aliases: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public getSkuCatalog(): SKU[] {
    try {
      const priceMasterPath = path.join(process.cwd(), 'data', 'price_master.csv');
      const csvContent = fs.readFileSync(priceMasterPath, 'utf-8');
      return this.parsePriceMasterCsv(csvContent);
    } catch (error) {
      console.error('Failed to load price master CSV:', error);
      throw new Error(`Failed to load SKU catalog: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private parseSkuAliasesCsv(csvContent: string): SkuAliasRow[] {
    const aliases: SkuAliasRow[] = [];
    const lines = csvContent.trim().split('\n');

    if (lines.length < 2) {
      throw new Error('SKU aliases CSV must have header and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const aliasIndex = headers.indexOf('alias');
    const skuCodeIndex = headers.indexOf('sku_code');
    const scoreBoostIndex = headers.indexOf('score_boost');

    if (aliasIndex === -1 || skuCodeIndex === -1 || scoreBoostIndex === -1) {
      throw new Error('SKU aliases CSV missing required columns: alias, sku_code, score_boost');
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue; // Skip empty lines and comments

      const values = line.split(',').map(v => v.trim());
      if (values.length < 3) continue; // Skip malformed rows

      const alias = values[aliasIndex];
      const skuCode = values[skuCodeIndex];
      const scoreBoost = values[scoreBoostIndex];

      if (alias && skuCode && scoreBoost) {
        aliases.push({
          alias,
          sku_code: skuCode,
          score_boost: scoreBoost
        });
      }
    }

    if (aliases.length === 0) {
      console.warn('No valid alias entries found in SKU aliases CSV');
    }

    return aliases;
  }

  private parsePriceMasterCsv(csvContent: string): SKU[] {
    const skus: SKU[] = [];
    const lines = csvContent.trim().split('\n');

    if (lines.length < 2) {
      throw new Error('Price master CSV must have header and at least one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredFields = ['sku_code', 'product_family', 'description', 'uom', 'material'];

    const fieldIndices: Record<string, number> = {};
    for (const field of requiredFields) {
      fieldIndices[field] = headers.indexOf(field);
      if (fieldIndices[field] === -1) {
        throw new Error(`Price master CSV missing required column: ${field}`);
      }
    }

    // Optional fields
    const optionalFields = ['gauge', 'size_od_mm', 'coil_length_m', 'colour', 'rate_inr', 'alt_material', 'tolerance_mm', 'aux_size', 'hsn_code', 'moq', 'lead_time_days', 'rate_alt_inr'];
    for (const field of optionalFields) {
      fieldIndices[field] = headers.indexOf(field);
    }

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      try {
        const values = this.parseCSVLine(line);
        if (values.length < requiredFields.length) continue; // Skip malformed rows

        const sku: SKU = {
          skuCode: values[fieldIndices.sku_code],
          productFamily: values[fieldIndices.product_family],
          description: values[fieldIndices.description],
          uom: values[fieldIndices.uom],
          material: values[fieldIndices.material],
          gauge: fieldIndices.gauge !== -1 ? values[fieldIndices.gauge] : undefined,
          sizeOdMm: fieldIndices.size_od_mm !== -1 ? this.parseNumber(values[fieldIndices.size_od_mm]) : undefined,
          coilLengthM: fieldIndices.coil_length_m !== -1 ? this.parseNumber(values[fieldIndices.coil_length_m]) : undefined,
          colour: fieldIndices.colour !== -1 ? values[fieldIndices.colour] : undefined,
          rateInr: fieldIndices.rate_inr !== -1 ? (this.parseNumber(values[fieldIndices.rate_inr]) ?? 0) : 0,
          altMaterial: fieldIndices.alt_material !== -1 ? values[fieldIndices.alt_material] : undefined,
          toleranceMm: fieldIndices.tolerance_mm !== -1 ? this.parseNumber(values[fieldIndices.tolerance_mm]) : undefined,
          auxSize: fieldIndices.aux_size !== -1 ? values[fieldIndices.aux_size] : undefined,
          hsnCode: fieldIndices.hsn_code !== -1 ? (values[fieldIndices.hsn_code] || '00000000') : '00000000',
          moq: fieldIndices.moq !== -1 ? (this.parseNumber(values[fieldIndices.moq]) ?? 1) : 1,
          leadTimeDays: fieldIndices.lead_time_days !== -1 ? (this.parseNumber(values[fieldIndices.lead_time_days]) ?? 7) : 7,
          rateAltInr: fieldIndices.rate_alt_inr !== -1 ? this.parseNumber(values[fieldIndices.rate_alt_inr]) : undefined,
        };

        // Validate required fields
        if (!sku.skuCode || !sku.productFamily || !sku.description || !sku.uom || !sku.material) {
          console.warn(`Skipping SKU with missing required fields at line ${i + 1}`);
          continue;
        }

        skus.push(sku);
      } catch (error) {
        console.warn(`Error parsing SKU at line ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        continue; // Skip this row and continue processing
      }
    }

    if (skus.length === 0) {
      throw new Error('No valid SKU entries found in price master CSV');
    }

    return skus;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    result.push(current.trim());
    return result;
  }

  private parseNumber(value: string): number | undefined {
    if (!value || value.trim() === '') return undefined;
    const parsed = parseFloat(value.trim());
    return isNaN(parsed) ? undefined : parsed;
  }
}