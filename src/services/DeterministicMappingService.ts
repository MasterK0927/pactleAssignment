import * as levenshtein from 'fast-levenshtein';
import { ParsedLineItem, MappedLineItem, MappingExplanation } from '../domain/entities/RFQRun';
import { SKU } from '../domain/entities/SKU';
import { ConfigService } from './ConfigService';

interface MappingConfig {
  auto_map_threshold: number;
  confidence_delta: number;
  size_tolerance_mm: number;
  fuzzy_weight: number;
  size_weight: number;
  material_weight: number;
  alias_weight: number;
}

interface AliasEntry {
  alias: string;
  boost: number;
}

interface SKUCandidate {
  sku: SKU;
  score: number;
  reasons: string[];
  breakdown: {
    fuzzy_score: number;
    size_score: number;
    material_score: number;
    alias_score: number;
  };
}

export class DeterministicMappingService {
  private config: MappingConfig;
  private aliases: Map<string, AliasEntry[]> = new Map();
  private configService: ConfigService;

  constructor(config?: Partial<MappingConfig>) {
    this.configService = ConfigService.getInstance();
    const mappingConfig = this.configService.getMappingConfig();

    this.config = {
      auto_map_threshold: mappingConfig.auto_map_threshold,
      confidence_delta: mappingConfig.confidence_delta,
      size_tolerance_mm: mappingConfig.size_tolerance_mm,
      fuzzy_weight: mappingConfig.fuzzy_weight,
      size_weight: mappingConfig.size_weight,
      material_weight: mappingConfig.material_weight,
      alias_weight: mappingConfig.alias_weight,
      ...config,
    };

    this.initializeAliases();
  }

  private async initializeAliases(): Promise<void> {
    try {
      // Load aliases from CSV file
      const aliasData = this.configService.getSkuAliases();

      for (const entry of aliasData) {
        const { alias, sku_code, score_boost } = entry;
        if (!this.aliases.has(sku_code)) {
          this.aliases.set(sku_code, []);
        }
        this.aliases.get(sku_code)!.push({
          alias: alias.toLowerCase(),
          boost: parseFloat(score_boost.toString()) || 0.3
        });
      }
    } catch (error) {
      console.warn('Failed to load SKU aliases, using fallback:', error);
      this.initializeFallbackAliases();
    }
  }

  private initializeFallbackAliases(): void {
    // Fallback aliases if CSV loading fails
    const fallbackAliases = [
      { sku: 'NFC25', aliases: ['25mm', '25', 'corrugated', 'flexible'] },
      { sku: 'NFC32', aliases: ['32mm', '32', 'corrugated', 'flexible'] },
      { sku: 'PVC25M', aliases: ['25mm', '25', 'pvc', 'conduit', 'medium'] },
      { sku: 'GFB3OCT', aliases: ['fan box', '3"', '3 inch', 'octagonal'] },
    ];

    for (const entry of fallbackAliases) {
      this.aliases.set(entry.sku, entry.aliases.map(alias => ({
        alias: alias.toLowerCase(),
        boost: 0.3
      })));
    }
  }

  async mapLineItems(
    parsedLines: ParsedLineItem[],
    skuCatalog: SKU[]
  ): Promise<MappedLineItem[]> {
    const mappedLines: MappedLineItem[] = [];

    for (const line of parsedLines) {
      const normalizedLine = this.normalizeLineItem(line);
      const candidates = await this.findCandidates(normalizedLine, skuCatalog);
      const mappingResult = this.decideMappingResult(candidates, normalizedLine);

      mappedLines.push({
        ...normalizedLine,
        mapping_result: mappingResult,
      });
    }

    return mappedLines;
  }

  private normalizeLineItem(line: ParsedLineItem): ParsedLineItem {
    const normalized = { ...line };

    // Normalize size
    if (line.raw_tokens.size_token) {
      normalized.normalized = {
        ...normalized.normalized,
        size_mm: this.extractSizeMm(line.raw_tokens.size_token),
      };
    }

    // Normalize material
    if (line.raw_tokens.material_token) {
      normalized.normalized = {
        ...normalized.normalized,
        material: this.normalizeMaterial(line.raw_tokens.material_token),
      };
    }

    // Normalize color
    if (line.raw_tokens.color_token) {
      normalized.normalized = {
        ...normalized.normalized,
        color: this.normalizeColor(line.raw_tokens.color_token),
      };
    }

    // Normalize gauge
    if (line.raw_tokens.gauge_token) {
      normalized.normalized = {
        ...normalized.normalized,
        gauge: this.normalizeGauge(line.raw_tokens.gauge_token),
      };
    }

    return normalized;
  }

  private extractSizeMm(sizeToken: string): number | undefined {
    // Extract numeric value and convert to mm
    const match = sizeToken.match(/(\d+(?:\.\d+)?)\s*(mm|inch|in|"|')?/i);
    if (!match) return undefined;

    const value = parseFloat(match[1]);
    const unit = (match[2] || 'mm').toLowerCase();

    switch (unit) {
      case 'inch':
      case 'in':
      case '"':
      case "'":
        return value * 25.4; // Convert inches to mm
      case 'mm':
      default:
        return value;
    }
  }

  private normalizeMaterial(material: string): string {
    const lower = material.toLowerCase().trim();

    // Handle FRPP variants first (most specific)
    if (lower.includes('frpp') || lower.includes('fr-pp') ||
        (lower.includes('fr') && lower.includes('pp'))) {
      return 'FRPP';
    }

    // Handle other materials
    if (lower.includes('pvc')) return 'PVC';
    if (lower.includes('nylon')) return 'NYLON';
    if (lower.includes('hdpe')) return 'HDPE';
    if (lower.includes('ldpe')) return 'LDPE';
    if (lower.includes('ms') || lower.includes('gi') || lower.includes('galvanized')) return 'MS';
    if (lower.includes('pp') || lower.includes('polypropylene')) return 'PP';
    if (lower.includes('fr') && !lower.includes('pp')) return 'FR';

    return material.toUpperCase();
  }

  private normalizeGauge(gauge: string): string {
    const lower = gauge.toLowerCase().trim();

    if (['light', 'l'].includes(lower)) return 'L';
    if (['medium', 'med', 'm'].includes(lower)) return 'M';
    if (['heavy', 'h'].includes(lower)) return 'H';

    return gauge.toUpperCase();
  }

  private getProductFamily(description: string): string {
    const desc = description.toLowerCase();

    if (desc.includes('corrugated') || desc.includes('flexible') || desc.includes('cfp')) {
      return 'Corrugated Flexible Pipe';
    }
    if (desc.includes('pvc') && desc.includes('conduit')) {
      return 'Rigid PVC Conduit';
    }
    if (desc.includes('fan') && desc.includes('box')) {
      return 'GI Fan Box';
    }
    if (desc.includes('modular') || desc.includes('switch') || desc.includes('msb')) {
      return 'MS Box';
    }
    if (desc.includes('cable') && desc.includes('gland')) {
      return 'Cable Gland';
    }
    if (desc.includes('cable') && (desc.includes('tie') || desc.includes('ties'))) {
      return 'Cable Tie';
    }
    if (desc.includes('junction') && desc.includes('box')) {
      return 'GI Junction Box';
    }
    if (desc.includes('clamp') || desc.includes('saddle')) {
      return 'Accessories';
    }

    return 'Unknown';
  }

  private normalizeColor(color: string): string {
    return color.toLowerCase();
  }

  private async findCandidates(
    line: ParsedLineItem,
    skuCatalog: SKU[]
  ): Promise<SKUCandidate[]> {
    const candidates: SKUCandidate[] = [];
    const inputFamily = this.getProductFamily(line.input_text);

    for (const sku of skuCatalog) {
      // Apply hard constraints first (Pactle requirement)
      if (!this.passesHardConstraints(line, sku, inputFamily)) {
        continue;
      }

      const candidate = this.scoreSKUMatch(line, sku);
      if (candidate.score > 0.1) { // Only include reasonable candidates
        candidates.push(candidate);
      }
    }

    // Sort by score descending
    return candidates.sort((a, b) => b.score - a.score);
  }

  private passesHardConstraints(
    line: ParsedLineItem,
    sku: SKU,
    inputFamily: string
  ): boolean {
    // Hard Constraint 1: Family match
    if (inputFamily !== 'Unknown' && sku.productFamily !== inputFamily) {
      return false;
    }

    // Hard Constraint 2: Size tolerance (if size is specified)
    const inputSize = line.normalized?.size_mm;
    if (inputSize && sku.sizeOdMm) {
      const tolerance = sku.toleranceMm || this.config.size_tolerance_mm;
      const sizeDiff = Math.abs(inputSize - sku.sizeOdMm);
      if (sizeDiff > tolerance) {
        return false;
      }
    }

    // Hard Constraint 3: Material compatibility (allow for material hierarchy)
    const inputMaterial = line.normalized?.material;
    if (inputMaterial && sku.material) {
      if (!this.isMaterialCompatible(inputMaterial, sku)) {
        return false;
      }
    }

    return true;
  }

  private isMaterialCompatible(inputMaterial: string, sku: SKU): boolean {
    const input = inputMaterial.toUpperCase();
    const skuMaterial = sku.material.toUpperCase();
    const skuAltMaterial = sku.altMaterial?.toUpperCase();

    // Direct match
    if (input === skuMaterial || input === skuAltMaterial) {
      return true;
    }

    // Material hierarchy for corrugated pipes
    if (sku.productFamily === 'Corrugated Flexible Pipe') {
      // FRPP requested can match FRPP or PP SKUs
      if (input === 'FRPP' && (skuMaterial === 'PP' || skuAltMaterial === 'FRPP')) {
        return true;
      }
      // FR requested can match FRPP or PP SKUs
      if (input === 'FR' && (skuMaterial === 'PP' || skuAltMaterial === 'FRPP')) {
        return true;
      }
      // PP requested matches PP SKUs
      if (input === 'PP' && skuMaterial === 'PP') {
        return true;
      }
    }

    return false;
  }

  private scoreSKUMatch(line: ParsedLineItem, sku: SKU): SKUCandidate {
    const reasons: string[] = [];
    const breakdown = {
      fuzzy_score: 0,
      size_score: 0,
      material_score: 0,
      alias_score: 0,
    };

    // 1. Fuzzy string matching
    const fuzzyScore = this.calculateFuzzyScore(line.input_text, sku);
    breakdown.fuzzy_score = fuzzyScore;
    if (fuzzyScore > 0.5) {
      reasons.push(`Description similarity: ${(fuzzyScore * 100).toFixed(1)}%`);
    }

    // 2. Size matching
    const sizeScore = this.calculateSizeScore(line, sku);
    breakdown.size_score = sizeScore;
    if (sizeScore > 0.8) {
      reasons.push(`Size match within tolerance`);
    } else if (sizeScore > 0.5) {
      reasons.push(`Partial size match`);
    }

    // 3. Material matching
    const materialScore = this.calculateMaterialScore(line, sku);
    breakdown.material_score = materialScore;
    if (materialScore > 0.9) {
      reasons.push(`Exact material match`);
    } else if (materialScore > 0.5) {
      reasons.push(`Material similarity`);
    }

    // 4. Alias matching
    const aliasScore = this.calculateAliasScore(line.input_text, sku);
    breakdown.alias_score = aliasScore;
    if (aliasScore > 0.5) {
      reasons.push(`Alias match detected`);
    }

    // Calculate total weighted score
    const totalScore =
      breakdown.fuzzy_score * this.config.fuzzy_weight +
      breakdown.size_score * this.config.size_weight +
      breakdown.material_score * this.config.material_weight +
      breakdown.alias_score * this.config.alias_weight;

    return {
      sku,
      score: Math.min(totalScore, 1.0),
      reasons,
      breakdown,
    };
  }

  private calculateFuzzyScore(input: string, sku: SKU): number {
    const inputLower = input.toLowerCase();
    const skuDescription = (sku.description || '').toLowerCase();

    // Use Levenshtein distance for deterministic similarity
    const distance = levenshtein.get(inputLower, skuDescription);
    const maxLength = Math.max(inputLower.length, skuDescription.length);

    return maxLength > 0 ? 1 - (distance / maxLength) : 0;
  }

  private calculateSizeScore(line: ParsedLineItem, sku: SKU): number {
    const inputSize = line.normalized?.size_mm;
    const skuSize = sku.sizeOdMm;

    if (!inputSize || !skuSize) return 0;

    const sizeDiff = Math.abs(inputSize - skuSize);
    if (sizeDiff <= this.config.size_tolerance_mm) {
      return 1.0; // Perfect match within tolerance
    } else if (sizeDiff <= this.config.size_tolerance_mm * 2) {
      return 0.7; // Close match
    } else if (sizeDiff <= this.config.size_tolerance_mm * 4) {
      return 0.3; // Distant match
    }

    return 0;
  }

  private calculateMaterialScore(line: ParsedLineItem, sku: SKU): number {
    const inputMaterial = line.normalized?.material;
    const skuMaterial = sku.material;

    if (!inputMaterial && !skuMaterial) return 0.5; // Both undefined
    if (!inputMaterial || !skuMaterial) return 0.2; // One undefined

    let materialScore = inputMaterial.toLowerCase() === skuMaterial.toLowerCase() ? 1.0 : 0;

    // For PVC conduits, also consider gauge matching
    if (sku.productFamily === 'Rigid PVC Conduit' && materialScore > 0) {
      const inputGauge = line.normalized?.gauge;
      const skuGauge = sku.gauge;

      if (inputGauge && skuGauge) {
        if (inputGauge === skuGauge) {
          materialScore = 1.0; // Perfect match including gauge
        } else {
          materialScore = 0.7; // Material matches but gauge doesn't
        }
      }
    }

    return materialScore;
  }

  private calculateAliasScore(input: string, sku: SKU): number {
    const inputLower = input.toLowerCase();
    let maxAliasScore = 0;

    // Check if this SKU has any aliases
    const skuAliases = this.aliases.get(sku.skuCode);
    if (!skuAliases) {
      return 0;
    }

    // Check each alias for matches in the input
    for (const aliasEntry of skuAliases) {
      const { alias, boost } = aliasEntry;

      // Check for exact word matches (more precise)
      const aliasWords = alias.split(/\s+/);
      const inputWords = inputLower.split(/\s+/);

      let wordMatches = 0;
      for (const aliasWord of aliasWords) {
        if (inputWords.some(inputWord =>
          inputWord.includes(aliasWord) || aliasWord.includes(inputWord)
        )) {
          wordMatches++;
        }
      }

      if (wordMatches > 0) {
        // Calculate score based on word match ratio and boost
        const matchRatio = wordMatches / aliasWords.length;
        const aliasScore = matchRatio * boost;
        maxAliasScore = Math.max(maxAliasScore, aliasScore);
      }

      // Also check for substring matches
      if (inputLower.includes(alias) || alias.includes(inputLower.replace(/[^a-z0-9]/g, ''))) {
        const substringScore = boost * 0.8; // Slightly lower score for substring matches
        maxAliasScore = Math.max(maxAliasScore, substringScore);
      }
    }

    return Math.min(maxAliasScore, 1.0); // Cap at 1.0
  }

  private decideMappingResult(
    candidates: SKUCandidate[],
    _line: ParsedLineItem
  ): MappedLineItem['mapping_result'] {
    if (candidates.length === 0) {
      return {
        status: 'failed',
        candidates: [],
        explanation: this.createExplanation(candidates, 'failed', [
          'No suitable SKU candidates found',
          'Consider checking product catalog or input format'
        ]),
      };
    }

    const topCandidate = candidates[0];
    const secondCandidate = candidates[1];

    const confidence = this.calculateConfidence(topCandidate.score, secondCandidate?.score);
    const needsReview = topCandidate.score < this.config.auto_map_threshold ||
                       (secondCandidate &&
                        (topCandidate.score - secondCandidate.score) < this.config.confidence_delta);

    const status = needsReview ? 'needs_review' : 'auto_mapped';
    const selectedSku = needsReview ? undefined : topCandidate.sku.skuCode;

    return {
      status,
      selected_sku: selectedSku,
      candidates: candidates.slice(0, 3).map(c => ({
        sku_code: c.sku.skuCode,
        score: c.score,
        reason: c.reasons.join('; '),
      })),
      explanation: this.createExplanation(candidates, confidence, topCandidate.reasons),
    };
  }

  private calculateConfidence(
    topScore: number,
    secondScore?: number
  ): 'high' | 'medium' | 'low' {
    if (topScore >= this.config.auto_map_threshold &&
        (!secondScore || (topScore - secondScore) >= this.config.confidence_delta)) {
      return 'high';
    } else if (topScore >= 0.6) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private createExplanation(
    candidates: SKUCandidate[],
    confidence: 'high' | 'medium' | 'low' | 'failed',
    assumptions: string[]
  ): MappingExplanation {
    const topCandidate = candidates[0];

    return {
      matched_fields: topCandidate ? this.getMatchedFields(topCandidate) : [],
      scores: topCandidate ? {
        fuzzy_score: topCandidate.breakdown.fuzzy_score,
        size_score: topCandidate.breakdown.size_score,
        material_score: topCandidate.breakdown.material_score,
        alias_score: topCandidate.breakdown.alias_score,
        total_score: topCandidate.score,
      } : {
        fuzzy_score: 0,
        size_score: 0,
        material_score: 0,
        alias_score: 0,
        total_score: 0,
      },
      tolerances: {
        size_tolerance_mm: this.config.size_tolerance_mm,
        material_match: topCandidate?.breakdown.material_score > 0.9,
      },
      assumptions,
      confidence: confidence === 'failed' ? 'low' : confidence,
      needs_review: confidence === 'failed' ||
                   !topCandidate ||
                   topCandidate.score < this.config.auto_map_threshold,
    };
  }

  private getMatchedFields(candidate: SKUCandidate): string[] {
    const fields: string[] = [];

    if (candidate.breakdown.fuzzy_score > 0.5) fields.push('description');
    if (candidate.breakdown.size_score > 0.5) fields.push('size');
    if (candidate.breakdown.material_score > 0.5) fields.push('material');
    if (candidate.breakdown.alias_score > 0.5) fields.push('aliases');

    return fields;
  }
}