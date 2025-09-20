import { v4 as uuidv4 } from 'uuid';
import { MappedLineItem } from '../domain/entities/RFQRun';
import { SKU } from '../domain/entities/SKU';
import { ConfigService } from './ConfigService';
import { PostgreSQLQuoteRepository, QuoteRecord, CreateQuoteInput } from '../infrastructure/repositories/PostgreSQLQuoteRepository';

interface QuoteRequest {
  run_id: string;
  header_discount_pct: number;
  freight_taxable: boolean;
  buyer: {
    buyer_id: string;
    name: string;
  };
}

interface QuoteLineItem {
  line_no: number;
  sku_code: string;
  description: string;
  qty: number;
  uom: string;
  unit_rate: number;
  line_total: number;
  hsn_code: string;
  explanation: any;
}

interface QuoteTotals {
  subtotal: number;
  discount: number;
  freight: number;
  tax: number;
  grand_total: number;
}

interface Quote {
  quote_id: string;
  revision: number;
  buyer: {
    buyer_id: string;
    name: string;
  };
  created_at: Date;
  valid_until: Date;
  line_items: QuoteLineItem[];
  totals: QuoteTotals;
  terms: {
    validity_days: number;
    lead_time_days: number;
    payment_terms: string;
  };
  original_items?: Array<{
    input_text: string;
    qty: number;
    uom: string;
    mapped_sku?: string;
    mapped_description?: string;
  }>;
  links: {
    pdf: string;
  };
}

export class QuoteCreationService {
  private quoteRepo: PostgreSQLQuoteRepository;
  private configService: ConfigService;

  constructor() {
    this.quoteRepo = new PostgreSQLQuoteRepository();
    this.configService = ConfigService.getInstance();
  }

  async createQuote(
    request: QuoteRequest,
    mappedLines: MappedLineItem[],
    skuCatalog: SKU[],
    userId?: string,
    originalItems?: Array<{
      input_text: string;
      qty: number;
      uom: string;
      mapped_sku?: string;
      mapped_description?: string;
    }>
  ): Promise<Quote> {
    // Generate unique quote ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    const quoteId = `Q-${timestamp}-${random}`.toUpperCase();

    // Create SKU lookup map
    const skuMap = new Map<string, SKU>();
    skuCatalog.forEach(sku => skuMap.set(sku.skuCode, sku));

    // Process line items (group similar items by SKU, UOM, and Rate)
    const groupedMap = new Map<string, QuoteLineItem>();

    for (const mappedLine of mappedLines) {
      // Determine selected SKU (auto or top candidate for review)
      let selectedSkuCode: string | undefined = undefined;
      if (mappedLine.mapping_result.status === 'auto_mapped' && mappedLine.mapping_result.selected_sku) {
        selectedSkuCode = mappedLine.mapping_result.selected_sku;
      } else if (mappedLine.mapping_result.candidates.length > 0) {
        selectedSkuCode = mappedLine.mapping_result.candidates[0].sku_code;
      }

      if (!selectedSkuCode) continue;
      const sku = skuMap.get(selectedSkuCode);
      if (!sku) continue;

      const key = `${sku.skuCode}|${mappedLine.uom}|${sku.rateInr}`;
      const existing = groupedMap.get(key);

      if (existing) {
        // Accumulate quantity and total
        existing.qty += mappedLine.qty;
        existing.line_total = existing.qty * existing.unit_rate;
      } else {
        groupedMap.set(key, {
          line_no: 0, // assign after grouping
          sku_code: sku.skuCode,
          description: sku.description,
          qty: mappedLine.qty,
          uom: mappedLine.uom,
          unit_rate: sku.rateInr,
          line_total: mappedLine.qty * sku.rateInr,
          hsn_code: sku.hsnCode,
          explanation: mappedLine.mapping_result.explanation,
        });
      }
    }

    // Convert to array and assign line numbers
    const lineItems: QuoteLineItem[] = Array.from(groupedMap.values())
      .sort((a, b) => a.sku_code.localeCompare(b.sku_code))
      .map((item, idx) => ({ ...item, line_no: idx + 1 }));

    // Guard: Do not create quotes without any line items
    if (!lineItems || lineItems.length === 0) {
      throw new Error('No quotable line items were generated from RFQ mapping. Please review your RFQ content or mapping thresholds/aliases.');
    }

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum + item.line_total, 0);
    const discount = subtotal * (request.header_discount_pct / 100);
    const discountedAmount = subtotal - discount;

    // Calculate freight using config values
    const pricingConfig = this.configService.getPricingConfig();
    const freightAmount = Math.max(discountedAmount * pricingConfig.default_freight_rate, pricingConfig.freight_min_amount);
    const freight = request.freight_taxable ? freightAmount : freightAmount;

    // Calculate tax (18% on discounted amount + freight if taxable)
    const taxableAmount = discountedAmount + (request.freight_taxable ? freight : 0);
    const tax = taxableAmount * 0.18;

    const grandTotal = discountedAmount + freight + tax;

    // Save to database
    const createQuoteInput: CreateQuoteInput = {
      quote_id: quoteId,
      rfq_id: request.run_id,
      user_id: userId,
      buyer_id: request.buyer.buyer_id,
      buyer_name: request.buyer.name,
      header_discount_pct: request.header_discount_pct,
      freight_taxable: request.freight_taxable,
      currency: 'INR',
      subtotal,
      discount,
      freight,
      tax,
      total: grandTotal,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      line_items: lineItems.map(item => ({
        line_number: item.line_no,
        input_description: item.description,
        mapped_sku: item.sku_code,
        sku_description: item.description,
        quantity: item.qty,
        unit_price: item.unit_rate,
        total_price: item.line_total,
        explanation_data: item.explanation
      }))
    };

    await this.quoteRepo.createQuote(createQuoteInput);

    // Return the Quote format expected by the API
    const quote: Quote = {
      quote_id: quoteId,
      revision: 1,
      buyer: request.buyer,
      created_at: new Date(),
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      line_items: lineItems,
      totals: {
        subtotal,
        discount,
        freight,
        tax,
        grand_total: grandTotal,
      },
      terms: {
        validity_days: 30,
        lead_time_days: 14,
        payment_terms: 'Net 30 days',
      },
      original_items: originalItems, // Include original RFQ items for PDF
      links: {
        pdf: `/api/quotes/${quoteId}/pdf`,
      },
    };

    return quote;
  }

  async getQuote(quoteId: string): Promise<Quote | null> {
    try {
      const quoteRecord = await this.quoteRepo.getQuote(quoteId);
      if (!quoteRecord) return null;

      const lineRecords = await this.quoteRepo.getQuoteLines(quoteId);

      // Convert database records to Quote format
      const quote: Quote = {
        quote_id: quoteRecord.quote_id,
        revision: quoteRecord.revision,
        buyer: {
          buyer_id: quoteRecord.buyer_id,
          name: quoteRecord.buyer_name || 'Unknown'
        },
        created_at: quoteRecord.created_at,
        valid_until: quoteRecord.expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        line_items: lineRecords.map(line => ({
          line_no: line.line_number,
          sku_code: line.mapped_sku || '',
          description: line.sku_description || '',
          qty: line.quantity,
          uom: 'PC', // Default UOM
          unit_rate: line.unit_price || 0,
          line_total: line.total_price || 0,
          hsn_code: '8547', // Default HSN
          explanation: line.explanation_data
        })),
        totals: {
          subtotal: quoteRecord.subtotal,
          discount: quoteRecord.discount,
          freight: quoteRecord.freight,
          tax: quoteRecord.tax,
          grand_total: quoteRecord.total,
        },
        terms: {
          validity_days: 30,
          lead_time_days: 14,
          payment_terms: 'Net 30 days',
        },
        links: {
          pdf: `/api/quotes/${quoteId}/pdf`,
        },
      };

      return quote;
    } catch (error) {
      console.error('Error getting quote:', error);
      return null;
    }
  }

  async getAllQuotes(): Promise<Quote[]> {
    try {
      const quoteRecords = await this.quoteRepo.getAllQuotes();
      const quotes: Quote[] = [];

      for (const record of quoteRecords) {
        const quote = await this.getQuote(record.quote_id);
        if (quote) quotes.push(quote);
      }

      return quotes;
    } catch (error) {
      console.error('Error getting all quotes:', error);
      return [];
    }
  }

  async getQuotesByUser(userId: string): Promise<Quote[]> {
    try {
      const quoteRecords = await this.quoteRepo.getQuotesByUser(userId);
      const quotes: Quote[] = [];

      for (const record of quoteRecords) {
        const quote = await this.getQuote(record.quote_id);
        if (quote) quotes.push(quote);
      }

      return quotes;
    } catch (error) {
      console.error('Error getting quotes by user:', error);
      return [];
    }
  }

  async updateQuote(quoteId: string, updates: Partial<Quote>): Promise<Quote | null> {
    try {
      // For now, just support status updates
      if (updates.totals) {
        // This would require more complex update logic
        console.warn('Quote totals update not implemented yet');
      }
      
      const quote = await this.getQuote(quoteId);
      return quote;
    } catch (error) {
      console.error('Error updating quote:', error);
      return null;
    }
  }

  async getQuoteStats(userId?: string): Promise<{
    totalQuotes: number;
    totalValue: number;
    avgValue: number;
  }> {
    try {
      return await this.quoteRepo.getQuoteStats(userId);
    } catch (error) {
      console.error('Error getting quote stats:', error);
      return {
        totalQuotes: 0,
        totalValue: 0,
        avgValue: 0
      };
    }
  }
}