import { RFQ, ParsedRFQInput } from '../entities/RFQ';
import { Quote } from '../entities/Quote';
import { SKUMatchResult } from '../entities/SKU';

export interface IRFQParser {
  parse(input: ParsedRFQInput): Promise<RFQ>;
  canHandle(source: string): boolean;
}


export interface IAuditService {
  logQuoteGeneration(quote: Quote, rfq: RFQ): Promise<void>;
  logSKUMapping(
    inputText: string,
    result: SKUMatchResult,
    runId: string
  ): Promise<void>;
}
