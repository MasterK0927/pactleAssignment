import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { PostgreSQLRFQRepository } from '../infrastructure/repositories/PostgreSQLRFQRepository';
import { Database } from '../infrastructure/database/Database';

// Simple, deterministic parser interfaces exactly as per spec
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

export class RFQParsers {
  private rfqRepository: PostgreSQLRFQRepository;
  private database: Database;
  private inMemoryCache = new Map<string, ParseResult>(); // Fallback cache
  private runIdCache = new Map<string, ParseResult>(); // Fallback run ID cache
  // Soft limits for parsing to avoid blocking requests on huge inputs
  private static readonly MAX_CSV_ROWS = 2000; // process at most 2000 data rows
  private static readonly DB_TIMEOUT_MS = 500; // fast timeout for DB touches

  constructor() {
    this.rfqRepository = new PostgreSQLRFQRepository();
    this.database = Database.getInstance();
  }

  /**
   * Utility to guard any awaited call with a timeout to keep request responsive
   */
  private async withTimeout<T>(promise: Promise<T>, ms: number, label?: string): Promise<T> {
    return await Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error(`${label || 'operation'} timed out in ${ms}ms`));
        }, ms);
      }) as Promise<T>,
    ]);
  }

  /**
   * Clear in-memory caches (idempotency and run cache)
   */
  public clearCaches(): { inMemory: number; runId: number } {
    const inMemSize = this.inMemoryCache.size;
    const runIdSize = this.runIdCache.size;
    this.inMemoryCache.clear();
    this.runIdCache.clear();
    return { inMemory: inMemSize, runId: runIdSize };
  }

  /**
   * Main entry point - exactly as per spec API
   */
  async parseRFQ(params: {
    type: 'email' | 'chat' | 'csv';
    text?: string;
    file?: Buffer;
    buyer_id: string;
    idempotency_key?: string;
    user_id?: string;
  }): Promise<ParseResult> {

    // Generate content for processing
    let content = '';
    if (params.file) {
      content = params.file.toString('utf-8');
    } else if (params.text) {
      content = params.text;
    }

    if (!content.trim()) {
      throw new Error('No content provided for parsing');
    }

    // Generate idempotency key
    const idempotencyKey = params.idempotency_key ||
      crypto.createHash('sha256').update(`${params.buyer_id}:${params.type}:${content.slice(0, 1000)}`).digest('hex');

    // Check cache (database first, then in-memory fallback)
    let existingResult = null;
    try {
      const isConnected = await this.withTimeout(
        this.database.isConnected(),
        RFQParsers.DB_TIMEOUT_MS,
        'db:isConnected'
      ).catch(() => false);
      if (isConnected) {
        existingResult = await this.withTimeout(
          this.rfqRepository.getParseResultByIdempotencyKey(idempotencyKey),
          RFQParsers.DB_TIMEOUT_MS,
          'repo:getParseResultByIdempotencyKey'
        ).catch(() => null);
      }
    } catch (error) {
      console.warn('Database check failed, using in-memory cache:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Fallback to in-memory cache
    if (!existingResult && this.inMemoryCache.has(idempotencyKey)) {
      existingResult = this.inMemoryCache.get(idempotencyKey)!;
    }

    if (existingResult) {
      console.log('Returning cached result for idempotency key:', idempotencyKey);
      return existingResult;
    }

    const runId = `run-${uuidv4()}`;
    let parsedLines: ParsedLineItem[] = [];
    const warnings: string[] = [];
    const startTime = Date.now();

    console.log(`Starting parsing for type: ${params.type}, runId: ${runId}`);

    try {
      switch (params.type) {
        case 'email':
          parsedLines = this.parseEmail(content);
          break;
        case 'chat':
          parsedLines = this.parseChat(content);
          break;
        case 'csv':
          parsedLines = this.parseCSV(content, warnings);
          break;
        default:
          throw new Error(`Unsupported type: ${params.type}`);
      }

      if (parsedLines.length === 0) {
        warnings.push('No line items were extracted from the input');
      }

      console.log(`Parsed ${parsedLines.length} lines successfully`);

    } catch (error) {
      console.error('Parsing error:', error);
      throw new Error(`Parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const processingTimeMs = Date.now() - startTime;

    const result: ParseResult = {
      run_id: runId,
      parsed_lines: parsedLines,
      warnings
    };

    // Store in database if available, otherwise use in-memory cache
    try {
      const isConnected = await this.withTimeout(
        this.database.isConnected(),
        RFQParsers.DB_TIMEOUT_MS,
        'db:isConnected'
      ).catch(() => false);
      if (isConnected) {
        await this.withTimeout(
          this.rfqRepository.storeParseResult(result, {
            userId: params.user_id,
            buyerId: params.buyer_id,
            type: params.type,
            originalContent: content,
            idempotencyKey,
            processingTimeMs
          }),
          RFQParsers.DB_TIMEOUT_MS,
          'repo:storeParseResult'
        );
        console.log(`Stored result in PostgreSQL with runId: ${runId}`);
      } else {
        throw new Error('Database not available');
      }
    } catch (error) {
      console.warn('Database storage failed, using in-memory cache:', error instanceof Error ? error.message : 'Unknown error');
      // Fallback to in-memory storage
      this.inMemoryCache.set(idempotencyKey, result);
      this.runIdCache.set(runId, result);
      console.log(`Stored result in memory cache with runId: ${runId}`);
    }

    return result;
  }

  /**
   * Email parser - extract numbered lines or semicolon-separated items
   */
  private parseEmail(text: string): ParsedLineItem[] {
    const lines: ParsedLineItem[] = [];

    // Find the main content section - more flexible pattern
    let content = text;
    const patterns = [
      /(?:following|quotation for|quote for)[:\s]+(.*?)(?:please|thanks|regards|delivery|best)/is,
      /(?:need|require|want).*?(?:for|:)\s*(.*?)(?:please|thanks|regards|delivery|best)/is,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1].trim().length > 20) {
        content = match[1];
        break;
      }
    }

    // Split by numbered lines first, then by semicolons/newlines
    let rawLines: string[] = [];

    // Check for numbered format first
    const numberedItems = content.match(/\d+\.\s*[^.]+/g);
    if (numberedItems && numberedItems.length > 1) {
      rawLines = numberedItems.map(item => item.replace(/^\d+\.\s*/, '').trim());
    } else {
      // Split by semicolons and newlines
      rawLines = content
        .split(/[;\n]/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    }

    // Filter and parse each line
    for (const line of rawLines) {
      if (this.looksLikeProduct(line)) {
        const parsed = this.parseProductLine(line);
        if (parsed) {
          lines.push(parsed);
        }
      }
    }

    return lines;
  }

  /**
   * Chat parser - handle JSON structure
   */
  private parseChat(text: string): ParsedLineItem[] {
    const lines: ParsedLineItem[] = [];

    try {
      const data = JSON.parse(text);

      if (data.items && Array.isArray(data.items)) {
        for (const item of data.items) {
          const line: ParsedLineItem = {
            input_text: item.description || '',
            qty: this.parseNumber(item.quantity) || 1,
            uom: this.normalizeUOM(item.unit || 'PC'),
            raw_tokens: {
              description: item.description || '',
              size_token: this.extractSize(item.description || ''),
              material_token: this.extractMaterial(item.description || ''),
              color_token: item.notes && item.notes.toLowerCase().includes('color') ?
                item.notes.replace(/.*color/i, '').trim() : undefined,
            }
          };
          lines.push(line);
        }
      }
    } catch (error) {
      // If not JSON, treat as plain text
      return this.parseEmail(text);
    }

    return lines;
  }

  /**
   * CSV parser - improved column mapping and error handling
   */
  private parseCSV(content: string, warnings?: string[]): ParsedLineItem[] {
    const lines: ParsedLineItem[] = [];

    try {
      // Handle different line endings and clean the content
      const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const rows = normalizedContent.split('\n').map(row => row.trim()).filter(row => row.length > 0);

      if (rows.length < 2) {
        throw new Error('CSV must have header and at least one data row');
      }

      const headers = this.parseCSVRow(rows[0]);
      console.log('CSV Headers detected:', headers);

      // More flexible column detection
      const descCol = this.findColumn(headers, ['description', 'desc', 'item', 'product', 'name', 'specification']);
      const qtyCol = this.findColumn(headers, ['quantity', 'qty', 'amount', 'count', 'no']);
      const unitCol = this.findColumn(headers, ['unit', 'uom', 'units', 'measure']);
      const notesCol = this.findColumn(headers, ['notes', 'note', 'comments', 'specification', 'spec']);
      const sizeCol = this.findColumn(headers, ['size', 'diameter', 'mm', 'inch']);

      console.log('Column mapping:', { descCol, qtyCol, unitCol, notesCol, sizeCol });

      if (descCol === -1) {
        // Try to use the first column if no description column found
        console.log('No description column found, using first column');
        if (headers.length > 0) {
          for (let i = 1; i < rows.length; i++) {
            const values = this.parseCSVRow(rows[i]);
            const description = values[0] || '';
            if (description.trim()) {
              const line: ParsedLineItem = {
                input_text: description,
                qty: this.parseNumber(values[1]) || 1,
                uom: this.normalizeUOM(values[2] || 'PC'),
                raw_tokens: {
                  description,
                  size_token: this.extractSize(description),
                  material_token: this.extractMaterial(description),
                  color_token: this.extractColor(description),
                  gauge_token: this.extractGauge(description),
                }
              };
              lines.push(line);
            }
          }
          return lines;
        }
        throw new Error('CSV must have a description/item column or at least one column with data');
      }

      // Enforce a maximum number of data rows to keep parsing bounded
      const maxDataRows = RFQParsers.MAX_CSV_ROWS;
      const totalDataRows = rows.length - 1;
      const effectiveEnd = 1 + Math.min(totalDataRows, maxDataRows);
      if (totalDataRows > maxDataRows) {
        warnings?.push(`Input truncated: processed first ${maxDataRows} rows out of ${totalDataRows}. Please split the file and try again for the remaining rows.`);
      }

      for (let i = 1; i < effectiveEnd; i++) {
        const values = this.parseCSVRow(rows[i]);

        // Try to read description; if missing, rebuild from all non-empty string fragments
        let description = values[descCol] || '';
        if (!description.trim()) {
          const rebuilt = values
            .filter((v, idx) => idx !== qtyCol && idx !== unitCol)
            .filter(v => typeof v === 'string' && v.trim().length > 0)
            .join(' ');
          description = rebuilt;
        }
        if (!description.trim()) continue;

        // Additional fields
        const sizeFromCol = sizeCol >= 0 ? values[sizeCol] : '';
        const notesFromCol = notesCol >= 0 ? values[notesCol] : '';
        const baseDesc = [description, sizeFromCol, notesFromCol].filter(Boolean).join(' ').trim();

        // Derive qty and uom: prefer columns, else extract from description text
        let qty = this.parseNumber(qtyCol >= 0 ? values[qtyCol] : '');
        let uom = unitCol >= 0 ? this.normalizeUOM(values[unitCol]) : '';
        if (!qty) {
          const qmatch = baseDesc.match(/\b(\d+(?:[\.,]\d+)?)\s*(meters?|m\b|pcs?|pieces?|nos\b|coils?|packs?|packets?)\b/i) ||
                        baseDesc.match(/\b(\d+(?:[\.,]\d+)?)(m|pcs?|nos|coils?|packs?)\b/i);
          if (qmatch) {
            qty = this.parseNumber(qmatch[1]);
            if (!uom && qmatch[2]) uom = this.normalizeUOM(qmatch[2]);
          }
        }
        if (!uom) uom = 'PC';
        if (!qty) qty = 1;

        const line: ParsedLineItem = {
          input_text: baseDesc,
          qty,
          uom,
          raw_tokens: {
            description: baseDesc,
            size_token: this.extractSize(baseDesc) || (typeof sizeFromCol === 'string' ? sizeFromCol : undefined),
            material_token: this.extractMaterial(baseDesc),
            color_token: this.extractColor(baseDesc),
            gauge_token: this.extractGauge(baseDesc),
          }
        };

        lines.push(line);
      }

      return lines;
    } catch (error) {
      console.error('CSV parsing error:', error);
      throw new Error(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse individual product line - extract qty, unit, and tokens
   */
  private parseProductLine(line: string): ParsedLineItem | null {
    if (!this.looksLikeProduct(line)) return null;

    // Extract quantity and unit patterns - try multiple patterns
    const qtyUnitPatterns = [
      // "- 300 meters", "– 100 m"
      /[–\-]\s*(\d+(?:\.\d+)?)\s+(meters?|pcs?|pieces?|m\b|coils?|packs?)/i,
      // "300 meters", "100 m", "50m"
      /\b(\d+(?:\.\d+)?)\s*(meters?|pcs?|pieces?|m\b|coils?|packs?)\b/i,
      // "300m" (no space)
      /\b(\d+(?:\.\d+)?)(m|meters?|pcs?|pieces?|coils?|packs?)\b/i,
    ];

    let qty = 1;
    let unit = 'PC';

    for (const pattern of qtyUnitPatterns) {
      const match = line.match(pattern);
      if (match) {
        qty = parseFloat(match[1]);
        unit = this.normalizeUOM(match[2]);
        break;
      }
    }

    return {
      input_text: line,
      qty,
      uom: unit,
      raw_tokens: {
        description: line,
        size_token: this.extractSize(line),
        material_token: this.extractMaterial(line),
        color_token: this.extractColor(line),
        gauge_token: this.extractGauge(line),
      }
    };
  }

  /**
   * Simple heuristics to detect if line contains product info
   */
  private looksLikeProduct(line: string): boolean {
    if (line.length < 5) return false;

    // Skip obvious non-product lines
    if (/^(dear|thanks|regards|delivery|payment|please)/i.test(line)) return false;

    // Must contain either size, product type, or quantity
    return /\d+\s*(mm|inch|meters?|pcs?|pieces?|m\b)/i.test(line) ||
           /\b(conduit|pipe|box|gland|tie|clamp)/i.test(line) ||
           /\b(corrugated|flexible|rigid|pvc|pp)/i.test(line);
  }

  /**
   * Extract size from text - look for patterns like "25mm", "3 inch", "PG16"
   */
  private extractSize(text: string): string | undefined {
    const patterns = [
      // 25 mm, 25mm, Ø25, 3 inch, 3"
      /(\d+(?:\.\d+)?)\s*(mm|inch|in|”)\b/i,
      /Ø\s*(\d+(?:\.\d+)?)/i,
      /PG\s*(\d+(?:\.\d+)?)/i,
      // dimensions like 4x4x2 or 6x6x2
      /(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)(?:\s*x\s*(\d+(?:\.\d+)?))?/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[0];
    }
    return undefined;
  }

  /**
   * Extract material tokens
   */
  private extractMaterial(text: string): string | undefined {
    const materials = [
      { pattern: /\bPVC\b/i, token: 'PVC' },
      { pattern: /\bPP\b/i, token: 'PP' },
      { pattern: /\bFRPP\b/i, token: 'FRPP' },
      { pattern: /\bFR\b/i, token: 'FRPP' },
      { pattern: /\bMS\b/i, token: 'MS' },
      { pattern: /\bGI\b/i, token: 'MS' },
      { pattern: /\bnylon\b/i, token: 'NYLON' },
    ];

    for (const mat of materials) {
      if (mat.pattern.test(text)) return mat.token;
    }
    return undefined;
  }

  /**
   * Extract color information
   */
  private extractColor(text: string): string | undefined {
    const colorMatch = text.match(/\b(black|white|natural|grey|gray)\b/i);
    return colorMatch ? colorMatch[1].toLowerCase() : undefined;
  }

  /**
   * Extract gauge/weight information
   */
  private extractGauge(text: string): string | undefined {
    const gaugeMatch = text.match(/\b(light|medium|heavy|med)\b/i);
    if (gaugeMatch) {
      const gauge = gaugeMatch[1].toLowerCase();
      if (gauge === 'light') return 'L';
      if (gauge === 'medium' || gauge === 'med') return 'M';
      if (gauge === 'heavy') return 'H';
    }
    return undefined;
  }

  /**
   * Normalize units to standard form
   */
  private normalizeUOM(unit: string): string {
    if (!unit) return 'PC';
    // Strip non-letters at end (e.g., PACK100 -> PACK)
    const raw = unit.toString().trim();
    const alphaOnly = raw.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const normalized = alphaOnly || raw.toLowerCase();

    if (['m', 'meter', 'meters', 'metre', 'metres', 'mtr', 'mtrs'].includes(normalized)) return 'M';
    if (['pc', 'pcs', 'piece', 'pieces', 'nos', 'no', 'qty'].includes(normalized)) return 'PC';
    if (['pack', 'packs', 'packet', 'packets', 'pkt', 'pkts'].includes(normalized)) return 'PACK';
    if (['coil', 'coils'].includes(normalized)) return 'COIL';

    return 'PC'; // default
  }

  /**
   * Parse number from string
   */
  private parseNumber(value: string | number): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    const cleaned = value.toString().replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Simple CSV row parser
   */
  private parseCSVRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < row.length) {
      const char = row[i];

      if (char === '"') {
        if (inQuotes) {
          // If next char is also a quote, it's an escaped quote
          if (row[i + 1] === '"') {
            current += '"';
            i += 2;
            continue;
          } else {
            // End of quoted section
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          // Start of quoted section (only if at field start)
          inQuotes = true;
          i++;
          continue;
        }
      }

      if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
        i++;
        continue;
      }

      current += char;
      i++;
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Find column index by name
   */
  private findColumn(headers: string[], names: string[]): number {
    for (const name of names) {
      const index = headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
      if (index >= 0) return index;
    }
    return -1;
  }

  /**
   * Get cached run by ID
   */
  async getRun(runId: string): Promise<ParseResult | null> {
    console.log(`Looking for run: ${runId}`);

    // Try database first
    try {
      const isConnected = await this.withTimeout(
        this.database.isConnected(),
        RFQParsers.DB_TIMEOUT_MS,
        'db:isConnected'
      ).catch(() => false);
      if (isConnected) {
        const result = await this.withTimeout(
          this.rfqRepository.getParseResultByRunId(runId),
          RFQParsers.DB_TIMEOUT_MS,
          'repo:getParseResultByRunId'
        ).catch(() => null);
        if (result) {
          console.log(`Found run in database: ${runId}`);
          return result;
        }
      }
    } catch (error) {
      console.warn('Database lookup failed, checking in-memory cache:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Fallback to in-memory cache
    const result = this.runIdCache.get(runId);
    if (result) {
      console.log(`Found run in memory cache: ${runId}`);
      return result;
    }

    console.log(`Run not found: ${runId}`);
    return null;
  }

  /**
   * Get all cached runs
   */
  async getAllRuns(): Promise<ParseResult[]> {
    return await this.rfqRepository.getAllRuns();
  }

  /**
   * Clean up expired runs
   */
  async cleanupExpiredRuns(): Promise<number> {
    return await this.rfqRepository.deleteExpiredRuns();
  }
}