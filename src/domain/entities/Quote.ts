import { SKU } from './SKU';

export interface QuoteLineItem {
  inputText: string;
  resolved?: {
    skuCode: string;
    material: string;
    uom: string;
    qtyUom: number;
    unitPrice: number;
    hsnCode: string;
  };
  amountBeforeDiscount: number;
  lineDiscountPct: number;
  amountAfterDiscount: number;
  taxPct: number;
  taxAmount: number;
  total: number;
  needsReview: boolean;
  candidates?: Array<{
    sku: SKU;
    score: number;
    reason: string;
  }>;
  explain: {
    family?: string;
    sizeMatchMm?: number;
    toleranceOk?: boolean;
    aliasHit?: string;
    score?: number;
    assumptions?: string[];
  };
}

export interface TaxBreakup {
  hsnCode: string;
  taxable: number;
  gstPct: number;
  gstAmount: number;
}

export interface QuoteTotals {
  subtotal: number;
  discount: number;
  tax: number;
  freight: number;
  grandTotal: number;
}

export interface QuoteTerms {
  validityDays: number;
  paymentTerms: string;
  leadTimeDays: number;
}

export interface Quote {
  quoteId: string;
  revision: number;
  createdAt: Date;
  buyer: {
    buyerId: string;
  };
  currency: string;
  lines: QuoteLineItem[];
  headerDiscountPct: number;
  freightAmount: number;
  taxBreakup: TaxBreakup[];
  totals: QuoteTotals;
  terms: QuoteTerms;
  runId: string;
  idempotencyKey: string;
}
