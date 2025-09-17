export interface ParsedLineItem {
  input_text: string;
  qty: number;
  uom: string;
  raw_tokens: {
    description?: string;
    size_token?: string;
    material_token?: string;
    color_token?: string;
    gauge_token?: string;
  };
  normalized?: {
    size_mm?: number;
    material?: string;
    color?: string;
    gauge?: string;
  };
}

export interface RFQParseResult {
  run_id: string;
  idempotency_key: string;
  buyer_id: string;
  parsed_lines: ParsedLineItem[];
  warnings: string[];
  created_at: Date;
  status: 'parsed' | 'mapped' | 'quoted';
}

export interface MappingExplanation {
  matched_fields: string[];
  scores: {
    fuzzy_score: number;
    size_score: number;
    material_score: number;
    alias_score: number;
    total_score: number;
  };
  tolerances: {
    size_tolerance_mm?: number;
    material_match?: boolean;
  };
  assumptions: string[];
  confidence: 'high' | 'medium' | 'low';
  needs_review: boolean;
}

export interface MappedLineItem extends ParsedLineItem {
  mapping_result: {
    status: 'auto_mapped' | 'needs_review' | 'failed';
    selected_sku?: string;
    candidates: Array<{
      sku_code: string;
      score: number;
      reason: string;
    }>;
    explanation: MappingExplanation;
  };
}