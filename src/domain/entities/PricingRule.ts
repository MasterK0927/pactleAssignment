export interface FreightRule {
  condition: string;
  amount: number;
  description: string;
}

export interface DiscountRule {
  type: 'line' | 'header';
  condition?: string;
  percentage: number;
  description: string;
}

export interface PricingConfiguration {
  defaultMaterialCorrugated: string;
  defaultGaugePvc: string;
  defaultValidityDays: number;
  defaultLeadTimeDays: number;
  defaultGstPercent: number;
  freightRules: FreightRule[];
  discountRules: DiscountRule[];
  sizeTolerance: number;
  skuMappingThreshold: number;
  skuMappingMarginThreshold: number;
}

export interface PricingContext {
  subtotal: number;
  netAfterDiscount: number;
  buyerId?: string;
  specialTerms?: {
    headerDiscountPct?: number;
    freightWaived?: boolean;
    customFreight?: number;
  };
}
