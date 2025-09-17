import { SKU } from '../entities/SKU';

export interface IPriceMasterRepository {
  getAllSKUs(): Promise<SKU[]>;
  getSKUByCode(skuCode: string): Promise<SKU | null>;
  getSKUsByFamily(family: string): Promise<SKU[]>;
  getSKUsBySize(sizeOdMm: number, tolerance?: number): Promise<SKU[]>;
  getSKUsByMaterial(material: string): Promise<SKU[]>;
}

