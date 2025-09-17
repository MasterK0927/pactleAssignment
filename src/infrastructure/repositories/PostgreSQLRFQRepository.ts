import { Database } from '../database/Database';
import { v4 as uuidv4 } from 'uuid';

export interface RFQRun {
  id: string;
  runId: string;
  idempotencyKey?: string;
  buyerId: string;
  contentHash: string;
  status: string;
  createdAt: Date;
  expiresAt?: Date;
  updatedAt: Date;
}

export interface RFQ {
  id: string;
  runId: string;
  userId?: string;
  buyerId: string;
  type: string;
  originalContent: string;
  idempotencyKey?: string;
  status: string;
  processingTimeMs?: number;
  warnings: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RFQLineItem {
  id: string;
  rfqId: string;
  lineNumber: number;
  inputText?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  extractedSize?: string;
  extractedFamily?: string;
  extractedColor?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParsedLineItem {
  input_text: string;
  qty: number;
  uom: string;
  raw_tokens: {
    description: string;
    size_token?: string;
    material_token?: string;
    color_token?: string;
    gauge_token?: string;
  };
}

export interface ParseResult {
  run_id: string;
  parsed_lines: ParsedLineItem[];
  warnings: string[];
}

export class PostgreSQLRFQRepository {
  private db: Database;

  constructor() {
    this.db = Database.getInstance();
  }

  async createProcessingRun(data: {
    runId: string;
    idempotencyKey?: string;
    buyerId: string;
    contentHash: string;
    status?: string;
    expiresAt?: Date;
  }): Promise<RFQRun> {
    const result = await this.db.query(
      `INSERT INTO processing_runs (run_id, idempotency_key, buyer_id, content_hash, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, run_id, idempotency_key, buyer_id, content_hash, status, created_at, expires_at, updated_at`,
      [data.runId, data.idempotencyKey, data.buyerId, data.contentHash, data.status || 'processing', data.expiresAt]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      runId: row.run_id,
      idempotencyKey: row.idempotency_key,
      buyerId: row.buyer_id,
      contentHash: row.content_hash,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      updatedAt: row.updated_at
    };
  }

  async createRFQ(data: {
    runId: string;
    userId?: string;
    buyerId: string;
    type: string;
    originalContent: string;
    idempotencyKey?: string;
    status?: string;
    processingTimeMs?: number;
    warnings?: string[];
  }): Promise<RFQ> {
    const result = await this.db.query(
      `INSERT INTO rfqs (run_id, user_id, buyer_id, type, original_content, idempotency_key, status, processing_time_ms, warnings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, run_id, user_id, buyer_id, type, original_content, idempotency_key, status, processing_time_ms, warnings, created_at, updated_at`,
      [data.runId, data.userId, data.buyerId, data.type, data.originalContent, data.idempotencyKey, data.status || 'parsing', data.processingTimeMs, data.warnings || []]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      runId: row.run_id,
      userId: row.user_id,
      buyerId: row.buyer_id,
      type: row.type,
      originalContent: row.original_content,
      idempotencyKey: row.idempotency_key,
      status: row.status,
      processingTimeMs: row.processing_time_ms,
      warnings: row.warnings || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async createRFQLineItems(rfqId: string, lines: ParsedLineItem[]): Promise<RFQLineItem[]> {
    const lineItems: RFQLineItem[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const result = await this.db.query(
        `INSERT INTO rfq_lines (rfq_id, line_number, input_text, description, quantity, unit, extracted_size, extracted_family, extracted_color)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, rfq_id, line_number, input_text, description, quantity, unit, extracted_size, extracted_family, extracted_color, created_at, updated_at`,
        [
          rfqId,
          i + 1,
          line.input_text,
          line.raw_tokens.description,
          line.qty,
          line.uom,
          line.raw_tokens.size_token,
          line.raw_tokens.material_token,
          line.raw_tokens.color_token
        ]
      );

      const row = result.rows[0];
      lineItems.push({
        id: row.id,
        rfqId: row.rfq_id,
        lineNumber: row.line_number,
        inputText: row.input_text,
        description: row.description,
        quantity: row.quantity,
        unit: row.unit,
        extractedSize: row.extracted_size,
        extractedFamily: row.extracted_family,
        extractedColor: row.extracted_color,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      });
    }

    return lineItems;
  }

  async storeParseResult(parseResult: ParseResult, data: {
    userId?: string;
    buyerId: string;
    type: string;
    originalContent: string;
    idempotencyKey?: string;
    processingTimeMs?: number;
  }): Promise<void> {
    await this.db.transaction(async (client) => {
      // Create processing run
      await client.query(
        `INSERT INTO processing_runs (run_id, idempotency_key, buyer_id, content_hash, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (run_id) DO NOTHING`,
        [parseResult.run_id, data.idempotencyKey, data.buyerId, data.originalContent.slice(0, 100), 'completed']
      );

      // Create RFQ
      const rfqResult = await client.query(
        `INSERT INTO rfqs (run_id, user_id, buyer_id, type, original_content, idempotency_key, status, processing_time_ms, warnings)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [parseResult.run_id, data.userId, data.buyerId, data.type, data.originalContent, data.idempotencyKey, 'completed', data.processingTimeMs, parseResult.warnings]
      );

      const rfqId = rfqResult.rows[0].id;

      // Create RFQ line items
      for (let i = 0; i < parseResult.parsed_lines.length; i++) {
        const line = parseResult.parsed_lines[i];
        await client.query(
          `INSERT INTO rfq_lines (rfq_id, line_number, input_text, description, quantity, unit, extracted_size, extracted_family, extracted_color)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            rfqId,
            i + 1,
            line.input_text,
            line.raw_tokens.description,
            line.qty,
            line.uom,
            line.raw_tokens.size_token,
            line.raw_tokens.material_token,
            line.raw_tokens.color_token
          ]
        );
      }
    });
  }

  async getParseResultByRunId(runId: string): Promise<ParseResult | null> {
    const rfqResult = await this.db.query(
      `SELECT r.*, pr.status as run_status
       FROM rfqs r
       LEFT JOIN processing_runs pr ON r.run_id = pr.run_id
       WHERE r.run_id = $1`,
      [runId]
    );

    if (rfqResult.rows.length === 0) {
      return null;
    }

    const rfq = rfqResult.rows[0];

    const linesResult = await this.db.query(
      `SELECT *
       FROM rfq_lines
       WHERE rfq_id = $1
       ORDER BY line_number`,
      [rfq.id]
    );

    const parsed_lines: ParsedLineItem[] = linesResult.rows.map((line: any) => ({
      input_text: line.input_text,
      qty: line.quantity,
      uom: line.unit,
      raw_tokens: {
        description: line.description,
        size_token: line.extracted_size,
        material_token: line.extracted_family,
        color_token: line.extracted_color
      }
    }));

    return {
      run_id: rfq.run_id,
      parsed_lines,
      warnings: rfq.warnings || []
    };
  }

  async getParseResultByIdempotencyKey(idempotencyKey: string): Promise<ParseResult | null> {
    const rfqResult = await this.db.query(
      `SELECT r.*, pr.status as run_status
       FROM rfqs r
       LEFT JOIN processing_runs pr ON r.run_id = pr.run_id
       WHERE r.idempotency_key = $1`,
      [idempotencyKey]
    );

    if (rfqResult.rows.length === 0) {
      return null;
    }

    const rfq = rfqResult.rows[0];

    const linesResult = await this.db.query(
      `SELECT *
       FROM rfq_lines
       WHERE rfq_id = $1
       ORDER BY line_number`,
      [rfq.id]
    );

    const parsed_lines: ParsedLineItem[] = linesResult.rows.map((line: any) => ({
      input_text: line.input_text,
      qty: line.quantity,
      uom: line.unit,
      raw_tokens: {
        description: line.description,
        size_token: line.extracted_size,
        material_token: line.extracted_family,
        color_token: line.extracted_color
      }
    }));

    return {
      run_id: rfq.run_id,
      parsed_lines,
      warnings: rfq.warnings || []
    };
  }

  async getAllRuns(): Promise<ParseResult[]> {
    const rfqsResult = await this.db.query(
      `SELECT r.*, pr.status as run_status
       FROM rfqs r
       LEFT JOIN processing_runs pr ON r.run_id = pr.run_id
       ORDER BY r.created_at DESC`
    );

    const results: ParseResult[] = [];

    for (const rfq of rfqsResult.rows) {
      const linesResult = await this.db.query(
        `SELECT *
         FROM rfq_lines
         WHERE rfq_id = $1
         ORDER BY line_number`,
        [rfq.id]
      );

      const parsed_lines: ParsedLineItem[] = linesResult.rows.map((line: any) => ({
        input_text: line.input_text,
        qty: line.quantity,
        uom: line.unit,
        raw_tokens: {
          description: line.description,
          size_token: line.extracted_size,
          material_token: line.extracted_family,
          color_token: line.extracted_color
        }
      }));

      results.push({
        run_id: rfq.run_id,
        parsed_lines,
        warnings: rfq.warnings || []
      });
    }

    return results;
  }

  async deleteExpiredRuns(): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM processing_runs
       WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP`
    );

    return result.rowCount;
  }
}