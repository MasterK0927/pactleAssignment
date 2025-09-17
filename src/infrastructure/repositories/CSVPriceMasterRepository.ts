import { IPriceMasterRepository } from '../../domain/interfaces/repositories';
import { SKU } from '../../domain/entities/SKU';
import { DataNotFoundError } from '../../domain/common/errors';
import * as fs from 'fs';
import csv from 'csv-parser';

export class CSVPriceMasterRepository implements IPriceMasterRepository {
  private skus: SKU[] = [];
  private loaded = false;

  constructor(private csvFilePath: string) { }

  async getAllSKUs(): Promise<SKU[]> {
    await this.ensureLoaded();
    return [...this.skus];
  }

  async getSKUByCode(skuCode: string): Promise<SKU | null> {
    await this.ensureLoaded();
    return this.skus.find(sku => sku.skuCode === skuCode) || null;
  }

  async getSKUsByFamily(family: string): Promise<SKU[]> {
    await this.ensureLoaded();
    return this.skus.filter(sku => sku.productFamily === family);
  }

  async getSKUsBySize(sizeOdMm: number, tolerance: number = 2): Promise<SKU[]> {
    await this.ensureLoaded();
    return this.skus.filter(sku => {
      if (!sku.sizeOdMm) return false;
      const diff = Math.abs(sku.sizeOdMm - sizeOdMm);
      const skuTolerance = sku.toleranceMm || tolerance;
      return diff <= skuTolerance;
    });
  }

  async getSKUsByMaterial(material: string): Promise<SKU[]> {
    await this.ensureLoaded();
    return this.skus.filter(sku =>
      sku.material === material || sku.altMaterial === material
    );
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    if (!fs.existsSync(this.csvFilePath)) {
      throw new DataNotFoundError(
        `Price master file not found: ${this.csvFilePath}`,
        'PriceMaster',
        this.csvFilePath
      );
    }

    this.skus = await this.loadFromCSV();
    this.loaded = true;
  }

  private async loadFromCSV(): Promise<SKU[]> {
    return new Promise((resolve, reject) => {
      const skus: SKU[] = [];

      fs.createReadStream(this.csvFilePath)
        .pipe(csv())
        .on('data', (row: any) => {
          try {
            const sku = this.mapRowToSKU(row);
            skus.push(sku);
          } catch (error: any) {
            console.warn(`Warning: Failed to parse SKU row:`, row, error.message);
          }
        })
        .on('end', () => {
          resolve(skus);
        })
        .on('error', (error: any) => {
          reject(new Error(`Failed to load price master: ${error.message}`));
        });
    });
  }

  private mapRowToSKU(row: any): SKU {
    return {
      skuCode: row.sku_code?.trim() || '',
      productFamily: row.product_family?.trim() || '',
      description: row.description?.trim() || '',
      hsnCode: row.hsn_code?.trim() || '',
      uom: row.uom?.trim() || '',
      coilLengthM: row.coil_length_m ? parseFloat(row.coil_length_m) : undefined,
      material: row.material?.trim() || '',
      gauge: row.gauge?.trim() || undefined,
      sizeOdMm: row.size_od_mm ? parseFloat(row.size_od_mm) : undefined,
      auxSize: row.aux_size?.trim() || undefined,
      colour: row.colour?.trim() || undefined,
      moq: parseInt(row.moq) || 0,
      leadTimeDays: parseInt(row.lead_time_days) || 7,
      rateInr: parseFloat(row.rate_inr) || 0,
      rateAltInr: row.rate_alt_inr ? parseFloat(row.rate_alt_inr) : undefined,
      altMaterial: row.alt_material?.trim() || undefined,
      toleranceMm: 2,
    };
  }

  async reload(): Promise<void> {
    this.loaded = false;
    this.skus = [];
    await this.ensureLoaded();
  }
}
