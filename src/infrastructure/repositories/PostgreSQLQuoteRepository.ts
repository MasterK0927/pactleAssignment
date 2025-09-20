import { Database } from '../database/Database';

export interface QuoteRecord {
  id: string;
  quote_id: string;
  rfq_id?: string;
  user_id?: string;
  revision: number;
  status: string;
  buyer_id: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_address?: any;
  header_discount_pct: number;
  freight_taxable: boolean;
  region: string;
  currency: string;
  subtotal: number;
  discount: number;
  freight: number;
  tax: number;
  total: number;
  needs_review_count: number;
  pdf_url?: string;
  json_url?: string;
  csv_url?: string;
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface QuoteLineRecord {
  id: string;
  quote_id: string;
  line_number: number;
  input_description?: string;
  mapped_sku?: string;
  sku_description?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  status?: string;
  explanation_data?: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateQuoteInput {
  quote_id: string;
  rfq_id?: string;
  user_id?: string;
  buyer_id: string;
  buyer_name?: string;
  buyer_email?: string;
  buyer_address?: any;
  header_discount_pct?: number;
  freight_taxable?: boolean;
  region?: string;
  currency?: string;
  subtotal: number;
  discount: number;
  freight: number;
  tax: number;
  total: number;
  needs_review_count?: number;
  expires_at?: Date;
  line_items: Array<{
    line_number: number;
    input_description?: string;
    mapped_sku?: string;
    sku_description?: string;
    quantity: number;
    unit_price?: number;
    total_price?: number;
    status?: string;
    explanation_data?: any;
  }>;
}

export class PostgreSQLQuoteRepository {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async createQuote(input: CreateQuoteInput): Promise<QuoteRecord> {
    try {
      return await this.db.transaction(async (client) => {
        // Insert quote
        const quoteResult = await client.query(
          `INSERT INTO quotes (
            quote_id, rfq_id, user_id, buyer_id, buyer_name, buyer_email, buyer_address,
            header_discount_pct, freight_taxable, region, currency,
            subtotal, discount, freight, tax, total, needs_review_count, expires_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING *`,
          [
            input.quote_id,
            input.rfq_id,
            input.user_id,
            input.buyer_id,
            input.buyer_name,
            input.buyer_email,
            input.buyer_address ? JSON.stringify(input.buyer_address) : null,
            input.header_discount_pct || 0,
            input.freight_taxable !== false,
            input.region || 'US',
            input.currency || 'USD',
            input.subtotal,
            input.discount,
            input.freight,
            input.tax,
            input.total,
            input.needs_review_count || 0,
            input.expires_at
          ]
        );

        const quote = this.mapQuoteRecord(quoteResult.rows[0]);

        // Insert quote lines
        for (const line of input.line_items) {
          await client.query(
            `INSERT INTO quote_lines (
              quote_id, line_number, input_description, mapped_sku, sku_description,
              quantity, unit_price, total_price, status, explanation_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              input.quote_id,
              line.line_number,
              line.input_description,
              line.mapped_sku,
              line.sku_description,
              line.quantity,
              line.unit_price,
              line.total_price,
              line.status,
              line.explanation_data ? JSON.stringify(line.explanation_data) : null
            ]
          );
        }

        return quote;
      });
    } catch (error) {
      console.error('Error creating quote:', error);
      throw new Error('Failed to create quote');
    }
  }

  async getQuote(quoteId: string): Promise<QuoteRecord | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM quotes WHERE quote_id = $1',
        [quoteId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapQuoteRecord(result.rows[0]);
    } catch (error) {
      console.error('Error getting quote:', error);
      return null;
    }
  }

  async getQuoteLines(quoteId: string): Promise<QuoteLineRecord[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM quote_lines WHERE quote_id = $1 ORDER BY line_number',
        [quoteId]
      );

      return result.rows.map(this.mapQuoteLineRecord);
    } catch (error) {
      console.error('Error getting quote lines:', error);
      return [];
    }
  }

  async getQuotesByUser(userId: string): Promise<QuoteRecord[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM quotes WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );

      return result.rows.map(this.mapQuoteRecord);
    } catch (error) {
      console.error('Error getting quotes by user:', error);
      return [];
    }
  }

  async getAllQuotes(): Promise<QuoteRecord[]> {
    try {
      const result = await this.db.query(
        'SELECT * FROM quotes ORDER BY created_at DESC'
      );

      return result.rows.map(this.mapQuoteRecord);
    } catch (error) {
      console.error('Error getting all quotes:', error);
      return [];
    }
  }

  async updateQuoteStatus(quoteId: string, status: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        'UPDATE quotes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE quote_id = $2',
        [status, quoteId]
      );

      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error updating quote status:', error);
      return false;
    }
  }

  async deleteQuote(quoteId: string): Promise<boolean> {
    try {
      return await this.db.transaction(async (client) => {
        // Delete quote lines first (due to foreign key)
        await client.query('DELETE FROM quote_lines WHERE quote_id = $1', [quoteId]);
        
        // Delete quote
        const result = await client.query('DELETE FROM quotes WHERE quote_id = $1', [quoteId]);
        
        return (result.rowCount || 0) > 0;
      });
    } catch (error) {
      console.error('Error deleting quote:', error);
      return false;
    }
  }

  async getQuoteStats(userId?: string): Promise<{
    totalQuotes: number;
    totalValue: number;
    avgValue: number;
  }> {
    try {
      let query = 'SELECT COUNT(*) as count, SUM(total) as sum, AVG(total) as avg FROM quotes';
      const params: any[] = [];

      if (userId) {
        query += ' WHERE user_id = $1';
        params.push(userId);
      }

      const result = await this.db.query(query, params);
      const row = result.rows[0];

      return {
        totalQuotes: parseInt(row.count) || 0,
        totalValue: parseFloat(row.sum) || 0,
        avgValue: parseFloat(row.avg) || 0
      };
    } catch (error) {
      console.error('Error getting quote stats:', error);
      return {
        totalQuotes: 0,
        totalValue: 0,
        avgValue: 0
      };
    }
  }

  private mapQuoteRecord(row: any): QuoteRecord {
    return {
      id: row.id,
      quote_id: row.quote_id,
      rfq_id: row.rfq_id,
      user_id: row.user_id,
      revision: row.revision,
      status: row.status,
      buyer_id: row.buyer_id,
      buyer_name: row.buyer_name,
      buyer_email: row.buyer_email,
      buyer_address: row.buyer_address ? JSON.parse(row.buyer_address) : null,
      header_discount_pct: row.header_discount_pct,
      freight_taxable: row.freight_taxable,
      region: row.region,
      currency: row.currency,
      subtotal: row.subtotal,
      discount: row.discount,
      freight: row.freight,
      tax: row.tax,
      total: row.total,
      needs_review_count: row.needs_review_count,
      pdf_url: row.pdf_url,
      json_url: row.json_url,
      csv_url: row.csv_url,
      expires_at: row.expires_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  private mapQuoteLineRecord(row: any): QuoteLineRecord {
    // explanation_data can be JSONB (object) or TEXT (stringified). Be robust.
    let explanation: any = null;
    const raw = row.explanation_data;
    if (raw !== null && raw !== undefined) {
      if (typeof raw === 'string') {
        try {
          explanation = JSON.parse(raw);
        } catch {
          // If it's not valid JSON, keep the raw string to avoid throwing
          explanation = raw;
        }
      } else {
        // Already an object (from JSONB)
        explanation = raw;
      }
    }

    return {
      id: row.id,
      quote_id: row.quote_id,
      line_number: row.line_number,
      input_description: row.input_description,
      mapped_sku: row.mapped_sku,
      sku_description: row.sku_description,
      quantity: row.quantity,
      unit_price: row.unit_price,
      total_price: row.total_price,
      status: row.status,
      explanation_data: explanation,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}
