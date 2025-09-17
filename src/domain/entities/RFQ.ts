export interface RFQLineItem {
  inputText: string;
  description: string;
  quantity: number;
  uom: string;
  sizeOdMm?: number;
  material?: string;
  gauge?: string;
  colour?: string;
  coils?: number;
  assumptions: string[];
}

export interface RFQ {
  rfqId: string;
  source: 'email' | 'chat' | 'csv';
  rawInput: string;
  buyerId?: string;
  lineItems: RFQLineItem[];
  createdAt: Date;
  commercialTerms?: {
    headerDiscountPct?: number;
    freightRule?: string;
    validityDays?: number;
    paymentTerms?: string;
  };
}

export interface ParsedRFQInput {
  source: 'email' | 'chat' | 'csv';
  content: string | object;
}
