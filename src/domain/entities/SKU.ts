export interface SKU {
  skuCode: string;
  productFamily: string;
  description: string;
  hsnCode: string;
  uom: string;
  coilLengthM?: number;
  material: string;
  gauge?: string;
  sizeOdMm?: number;
  auxSize?: string;
  colour?: string;
  moq: number;
  leadTimeDays: number;
  rateInr: number;
  rateAltInr?: number;
  altMaterial?: string;
  toleranceMm?: number;
}

export interface SKUAlias {
  alias: string;
  skuCode: string;
  scoreBoost: number;
}

export interface SKUMatchCandidate {
  sku: SKU;
  score: number;
  reasons: string[];
  matchedFields: {
    family: boolean;
    size: boolean;
    material: boolean;
    gauge: boolean;
    colour: boolean;
  };
}

export interface SKUMatchResult {
  matched: boolean;
  candidate?: SKU;
  candidates?: SKUMatchCandidate[];
  needsReview: boolean;
  explanation: string;
}
