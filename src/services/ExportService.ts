import { createObjectCsvWriter } from 'csv-writer';
import path from 'path';

interface Quote {
  quote_id: string;
  revision: number;
  buyer: {
    buyer_id: string;
    name: string;
    address?: string;
    gstin?: string;
    contact?: string;
  };
  created_at: Date;
  valid_until: Date;
  line_items: Array<{
    line_no: number;
    sku_code: string;
    description: string;
    qty: number;
    uom: string;
    unit_rate: number;
    line_total: number;
    hsn_code: string;
    tax_rate?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    explanation?: any;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    freight: number;
    tax: number;
    grand_total: number;
    tax_breakup?: {
      [hsn: string]: {
        taxable_value: number;
        cgst_rate: number;
        cgst_amount: number;
        sgst_rate: number;
        sgst_amount: number;
        igst_rate?: number;
        igst_amount?: number;
        total_tax: number;
      };
    };
  };
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
  explainability?: {
    processing_steps: Array<{
      step: string;
      description: string;
      confidence: number;
      details: any;
    }>;
    mapping_confidence: {
      [sku: string]: number;
    };
    pricing_logic: {
      base_pricing: string;
      adjustments: Array<{
        factor: string;
        impact: number;
        reason: string;
      }>;
    };
  };
  revision_diff?: {
    previous_revision: number;
    changes: Array<{
      type: 'added' | 'removed' | 'modified';
      field: string;
      old_value?: any;
      new_value?: any;
      line_item?: number;
    }>;
  };
}

export class ExportService {
  
  /**
   * Export quote data to CSV format
   */
  async exportToCSV(quote: Quote, outputPath?: string): Promise<string> {
    try {
      if (!quote || !quote.quote_id) {
        throw new Error('Invalid quote data: quote_id is required');
      }
      
      const csvPath = outputPath || path.join(process.cwd(), 'exports', `quote_${quote.quote_id}_rev${quote.revision || 1}.csv`);
      
      // Ensure exports directory exists
      const fsPromises1 = await import('fs/promises');
      const dir = path.dirname(csvPath);
      await fsPromises1.mkdir(dir, { recursive: true });
    
    // Prepare line items data for CSV
    const csvData = quote.line_items.map((item, index) => ({
      quote_id: quote.quote_id,
      revision: quote.revision,
      buyer_name: quote.buyer.name,
      buyer_id: quote.buyer.buyer_id,
      buyer_gstin: quote.buyer.gstin || '',
      line_no: item.line_no,
      sku_code: item.sku_code,
      description: item.description,
      hsn_code: item.hsn_code,
      quantity: item.qty,
      uom: item.uom,
      unit_rate: item.unit_rate,
      line_total: item.line_total,
      cgst_rate: item.cgst || 0,
      sgst_rate: item.sgst || 0,
      igst_rate: item.igst || 0,
      subtotal: index === 0 ? quote.totals.subtotal : '', // Only show totals in first row
      discount: index === 0 ? quote.totals.discount : '',
      freight: index === 0 ? quote.totals.freight : '',
      total_tax: index === 0 ? quote.totals.tax : '',
      grand_total: index === 0 ? quote.totals.grand_total : '',
      validity_days: index === 0 ? quote.terms.validity_days : '',
      lead_time_days: index === 0 ? quote.terms.lead_time_days : '',
      payment_terms: index === 0 ? quote.terms.payment_terms : '',
      created_at: index === 0 ? quote.created_at.toISOString() : '',
      valid_until: index === 0 ? quote.valid_until.toISOString() : ''
    }));

    const csvWriter = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'quote_id', title: 'Quote ID' },
        { id: 'revision', title: 'Revision' },
        { id: 'buyer_name', title: 'Buyer Name' },
        { id: 'buyer_id', title: 'Buyer ID' },
        { id: 'buyer_gstin', title: 'Buyer GSTIN' },
        { id: 'line_no', title: 'Line No' },
        { id: 'sku_code', title: 'SKU Code' },
        { id: 'description', title: 'Description' },
        { id: 'hsn_code', title: 'HSN Code' },
        { id: 'quantity', title: 'Quantity' },
        { id: 'uom', title: 'UOM' },
        { id: 'unit_rate', title: 'Unit Rate (₹)' },
        { id: 'line_total', title: 'Line Total (₹)' },
        { id: 'cgst_rate', title: 'CGST Rate (%)' },
        { id: 'sgst_rate', title: 'SGST Rate (%)' },
        { id: 'igst_rate', title: 'IGST Rate (%)' },
        { id: 'subtotal', title: 'Subtotal (₹)' },
        { id: 'discount', title: 'Discount (₹)' },
        { id: 'freight', title: 'Freight (₹)' },
        { id: 'total_tax', title: 'Total Tax (₹)' },
        { id: 'grand_total', title: 'Grand Total (₹)' },
        { id: 'validity_days', title: 'Validity (Days)' },
        { id: 'lead_time_days', title: 'Lead Time (Days)' },
        { id: 'payment_terms', title: 'Payment Terms' },
        { id: 'created_at', title: 'Created At' },
        { id: 'valid_until', title: 'Valid Until' }
      ]
    });

      await csvWriter.writeRecords(csvData);
      return csvPath;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw new Error(`CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export quote data to JSON format with clean structure
   */
  async exportToJSON(quote: Quote, outputPath?: string): Promise<string> {
    try {
      if (!quote || !quote.quote_id) {
        throw new Error('Invalid quote data: quote_id is required');
      }
      
      const jsonPath = outputPath || path.join(process.cwd(), 'exports', `quote_${quote.quote_id}_rev${quote.revision || 1}.json`);
      
      // Ensure exports directory exists
      const fsPromises2 = await import('fs/promises');
      const dir = path.dirname(jsonPath);
      await fsPromises2.mkdir(dir, { recursive: true });
    
    // Create a clean, structured JSON export
    const exportData: any = {
      metadata: {
        quote_id: quote.quote_id,
        revision: quote.revision,
        export_timestamp: new Date().toISOString(),
        currency: 'INR'
      },
      buyer_information: {
        buyer_id: quote.buyer.buyer_id,
        name: quote.buyer.name,
        address: quote.buyer.address,
        gstin: quote.buyer.gstin,
        contact: quote.buyer.contact
      },
      quote_details: {
        created_at: quote.created_at.toISOString(),
        valid_until: quote.valid_until.toISOString(),
        validity_days: quote.terms.validity_days,
        lead_time_days: quote.terms.lead_time_days,
        payment_terms: quote.terms.payment_terms
      },
      line_items: quote.line_items.map(item => ({
        line_no: item.line_no,
        sku_code: item.sku_code,
        description: item.description,
        hsn_code: item.hsn_code,
        quantity: item.qty,
        uom: item.uom,
        unit_rate: item.unit_rate,
        line_total: item.line_total,
        tax_details: {
          cgst_rate: item.cgst || 0,
          sgst_rate: item.sgst || 0,
          igst_rate: item.igst || 0
        }
      })),
      financial_summary: {
        subtotal: quote.totals.subtotal,
        discount: quote.totals.discount,
        freight: quote.totals.freight,
        total_tax: quote.totals.tax,
        grand_total: quote.totals.grand_total,
        tax_breakup_by_hsn: quote.totals.tax_breakup
      },
      original_rfq_items: quote.original_items?.map(item => ({
        input_text: item.input_text,
        quantity: item.qty,
        uom: item.uom,
        mapped_sku: item.mapped_sku,
        mapped_description: item.mapped_description
      })) || [],
      processing_summary: {
        total_original_items: quote.original_items?.length || 0,
        total_line_items: quote.line_items.length,
        mapping_success_rate: this.calculateMappingSuccessRate(quote)
      }
    };

    // Add explainability data if available
    if (quote.explainability) {
      exportData['explainability'] = {
        processing_steps: quote.explainability.processing_steps,
        mapping_confidence: quote.explainability.mapping_confidence,
        pricing_logic: quote.explainability.pricing_logic,
        confidence_metrics: this.calculateConfidenceMetrics(quote)
      };
    }

    // Add revision diff if available
    if (quote.revision_diff) {
      exportData['revision_changes'] = {
        previous_revision: quote.revision_diff.previous_revision,
        changes: quote.revision_diff.changes
      };
    }

      await fsPromises2.writeFile(jsonPath, JSON.stringify(exportData, null, 2), 'utf8');
      return jsonPath;
    } catch (error) {
      console.error('Error exporting to JSON:', error);
      throw new Error(`JSON export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export tax breakup to CSV
   */
  async exportTaxBreakupToCSV(quote: Quote, outputPath?: string): Promise<string> {
    try {
      if (!quote || !quote.quote_id) {
        throw new Error('Invalid quote data: quote_id is required');
      }
      
      if (!quote.totals?.tax_breakup) {
        throw new Error('No tax breakup data available');
      }

      const csvPath = outputPath || path.join(process.cwd(), 'exports', `tax_breakup_${quote.quote_id}_rev${quote.revision || 1}.csv`);
      
      // Ensure exports directory exists
      const fsPromises3 = await import('fs/promises');
      const dir = path.dirname(csvPath);
      await fsPromises3.mkdir(dir, { recursive: true });
    
    const taxData = Object.entries(quote.totals.tax_breakup).map(([hsn, tax]) => ({
      quote_id: quote.quote_id,
      revision: quote.revision,
      hsn_code: hsn,
      taxable_value: tax.taxable_value,
      cgst_rate: tax.cgst_rate,
      cgst_amount: tax.cgst_amount,
      sgst_rate: tax.sgst_rate,
      sgst_amount: tax.sgst_amount,
      igst_rate: tax.igst_rate || 0,
      igst_amount: tax.igst_amount || 0,
      total_tax: tax.total_tax
    }));

    const csvWriter = createObjectCsvWriter({
      path: csvPath,
      header: [
        { id: 'quote_id', title: 'Quote ID' },
        { id: 'revision', title: 'Revision' },
        { id: 'hsn_code', title: 'HSN Code' },
        { id: 'taxable_value', title: 'Taxable Value (₹)' },
        { id: 'cgst_rate', title: 'CGST Rate (%)' },
        { id: 'cgst_amount', title: 'CGST Amount (₹)' },
        { id: 'sgst_rate', title: 'SGST Rate (%)' },
        { id: 'sgst_amount', title: 'SGST Amount (₹)' },
        { id: 'igst_rate', title: 'IGST Rate (%)' },
        { id: 'igst_amount', title: 'IGST Amount (₹)' },
        { id: 'total_tax', title: 'Total Tax (₹)' }
      ]
    });

      await csvWriter.writeRecords(taxData);
      return csvPath;
    } catch (error) {
      console.error('Error exporting tax breakup to CSV:', error);
      throw new Error(`Tax breakup CSV export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate revision diff in a readable format
   */
  generateRevisionDiffReport(quote: Quote): string {
    try {
      if (!quote.revision_diff) {
        return 'No revision changes available.';
      }

      let report = `Revision Diff Report\n`;
      report += `====================\n`;
      report += `Quote ID: ${quote.quote_id || 'N/A'}\n`;
      report += `Current Revision: ${quote.revision || 1}\n`;
      report += `Previous Revision: ${quote.revision_diff.previous_revision || 0}\n`;
      report += `Generated: ${new Date().toISOString()}\n\n`;

    report += `Changes Summary:\n`;
    report += `----------------\n`;

    const changesByType = {
      added: quote.revision_diff.changes.filter(c => c.type === 'added'),
      removed: quote.revision_diff.changes.filter(c => c.type === 'removed'),
      modified: quote.revision_diff.changes.filter(c => c.type === 'modified')
    };

    if (changesByType.added.length > 0) {
      report += `\n✅ ADDED (${changesByType.added.length} changes):\n`;
      changesByType.added.forEach(change => {
        const linePrefix = change.line_item ? `Line ${change.line_item}: ` : '';
        report += `  + ${linePrefix}${change.field}: ${change.new_value}\n`;
      });
    }

    if (changesByType.removed.length > 0) {
      report += `\n❌ REMOVED (${changesByType.removed.length} changes):\n`;
      changesByType.removed.forEach(change => {
        const linePrefix = change.line_item ? `Line ${change.line_item}: ` : '';
        report += `  - ${linePrefix}${change.field}: ${change.old_value}\n`;
      });
    }

    if (changesByType.modified.length > 0) {
      report += `\n🔄 MODIFIED (${changesByType.modified.length} changes):\n`;
      changesByType.modified.forEach(change => {
        const linePrefix = change.line_item ? `Line ${change.line_item}: ` : '';
        report += `  ~ ${linePrefix}${change.field}: ${change.old_value} → ${change.new_value}\n`;
      });
    }

      return report;
    } catch (error) {
      console.error('Error generating revision diff report:', error);
      return `Error generating revision diff report: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Export all quote data in multiple formats
   */
  async exportQuoteBundle(quote: Quote, outputDir?: string): Promise<{
    pdf_path?: string;
    csv_path: string;
    json_path: string;
    tax_csv_path?: string;
    explainability_json_path?: string;
    diff_report_path?: string;
  }> {
    try {
      if (!quote || !quote.quote_id) {
        throw new Error('Invalid quote data: quote_id is required');
      }
      
      const baseDir = outputDir || path.join(process.cwd(), 'exports', `quote_${quote.quote_id}_rev${quote.revision || 1}`);
      
      // Ensure directory exists
      const fsBundle = await import('fs/promises');
      await fsBundle.mkdir(baseDir, { recursive: true });

    const results: any = {};

    // Export CSV
    results.csv_path = await this.exportToCSV(quote, path.join(baseDir, 'quote.csv'));

    // Export JSON
    results.json_path = await this.exportToJSON(quote, path.join(baseDir, 'quote.json'));

    // Export tax breakup if available
    if (quote.totals.tax_breakup) {
      results.tax_csv_path = await this.exportTaxBreakupToCSV(quote, path.join(baseDir, 'tax_breakup.csv'));
    }

      // Export explainability JSON if available
      if (quote.explainability) {
        const explainabilityPath = path.join(baseDir, 'explainability.json');
        const explainabilityData = {
          quote_id: quote.quote_id,
          revision: quote.revision || 1,
          timestamp: new Date().toISOString(),
          explainability: quote.explainability,
          confidence_metrics: this.calculateConfidenceMetrics(quote)
        };
        await fsBundle.writeFile(explainabilityPath, JSON.stringify(explainabilityData, null, 2), 'utf8');
        results.explainability_json_path = explainabilityPath;
      }

      // Export revision diff report if available
      if (quote.revision_diff) {
        const diffReportPath = path.join(baseDir, 'revision_diff.txt');
        const diffReport = this.generateRevisionDiffReport(quote);
        await fsBundle.writeFile(diffReportPath, diffReport, 'utf8');
        results.diff_report_path = diffReportPath;
      }

      return results;
    } catch (error) {
      console.error('Error exporting quote bundle:', error);
      throw new Error(`Quote bundle export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private calculateMappingSuccessRate(quote: Quote): number {
    if (!quote.original_items || quote.original_items.length === 0) return 1;
    
    const mappedCount = quote.original_items.filter(item => 
      item.mapped_sku && item.mapped_sku !== 'Not mapped'
    ).length;
    
    return mappedCount / quote.original_items.length;
  }

  private calculateConfidenceMetrics(quote: Quote): any {
    if (!quote.explainability) return null;
    
    const avgProcessingConfidence = quote.explainability.processing_steps.reduce(
      (sum, step) => sum + step.confidence, 0
    ) / quote.explainability.processing_steps.length;
    
    const mappingConfidences = Object.values(quote.explainability.mapping_confidence);
    const avgMappingConfidence = mappingConfidences.reduce((sum, conf) => sum + conf, 0) / mappingConfidences.length;
    
    return {
      average_processing_confidence: avgProcessingConfidence,
      average_mapping_confidence: avgMappingConfidence,
      overall_confidence: (avgProcessingConfidence + avgMappingConfidence) / 2
    };
  }
}
