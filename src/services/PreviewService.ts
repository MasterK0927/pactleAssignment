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

interface PreviewData {
  quote: Quote;
  html_preview: string;
  summary: {
    total_items: number;
    total_amount: number;
    mapping_success_rate: number;
    confidence_score: number;
  };
  validation: {
    errors: Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      field?: string;
      line_item?: number;
    }>;
    is_valid: boolean;
  };
}

export class PreviewService {
  
  /**
   * Generate HTML preview of the quote
   */
  generateQuotePreview(quote: Quote): PreviewData {
    const htmlPreview = this.generateHTMLPreview(quote);
    const summary = this.generateSummary(quote);
    const validation = this.validateQuote(quote);

    return {
      quote,
      html_preview: htmlPreview,
      summary,
      validation
    };
  }

  private generateHTMLPreview(quote: Quote): string {
    const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    const formatDate = (date: Date) => date.toLocaleDateString('en-IN');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quote Preview - ${quote.quote_id}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f8fafc;
            color: #1f2937;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5rem;
            font-weight: 700;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1rem;
        }
        .content {
            padding: 30px;
        }
        .quote-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
            padding: 20px;
            background: #f8fafc;
            border-radius: 8px;
        }
        .info-group h3 {
            margin: 0 0 15px 0;
            color: #374151;
            font-size: 1.2rem;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 8px;
        }
        .info-item {
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
        }
        .info-label {
            font-weight: 600;
            color: #6b7280;
        }
        .info-value {
            color: #1f2937;
        }
        .line-items {
            margin: 30px 0;
        }
        .line-items h3 {
            margin: 0 0 20px 0;
            color: #374151;
            font-size: 1.3rem;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 10px;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .items-table th {
            background: #374151;
            color: white;
            padding: 12px 8px;
            text-align: left;
            font-weight: 600;
            font-size: 0.9rem;
        }
        .items-table td {
            padding: 12px 8px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 0.9rem;
        }
        .items-table tr:hover {
            background: #f9fafb;
        }
        .items-table tr:last-child td {
            border-bottom: none;
        }
        .financial-summary {
            background: #f8fafc;
            padding: 25px;
            border-radius: 8px;
            margin: 30px 0;
        }
        .financial-summary h3 {
            margin: 0 0 20px 0;
            color: #374151;
            font-size: 1.3rem;
        }
        .summary-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
        }
        .summary-row.total {
            border-top: 2px solid #2563eb;
            font-weight: 700;
            font-size: 1.2rem;
            color: #2563eb;
            margin-top: 15px;
            padding-top: 15px;
        }
        .tax-breakup {
            margin: 30px 0;
        }
        .tax-breakup h3 {
            margin: 0 0 20px 0;
            color: #374151;
            font-size: 1.3rem;
        }
        .tax-table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        .tax-table th {
            background: #059669;
            color: white;
            padding: 12px 8px;
            text-align: left;
            font-weight: 600;
            font-size: 0.9rem;
        }
        .tax-table td {
            padding: 12px 8px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 0.9rem;
        }
        .terms {
            background: #fef3c7;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #f59e0b;
            margin: 30px 0;
        }
        .terms h3 {
            margin: 0 0 15px 0;
            color: #92400e;
        }
        .terms ul {
            margin: 0;
            padding-left: 20px;
        }
        .terms li {
            margin-bottom: 8px;
            color: #92400e;
        }
        .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8rem;
            font-weight: 600;
        }
        .badge-success {
            background: #d1fae5;
            color: #065f46;
        }
        .badge-warning {
            background: #fef3c7;
            color: #92400e;
        }
        .badge-info {
            background: #dbeafe;
            color: #1e40af;
        }
        .explainability {
            background: #f0f9ff;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #0ea5e9;
            margin: 30px 0;
        }
        .confidence-bar {
            background: #e5e7eb;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            margin: 5px 0;
        }
        .confidence-fill {
            height: 100%;
            background: linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%);
            transition: width 0.3s ease;
        }
        @media (max-width: 768px) {
            .quote-info {
                grid-template-columns: 1fr;
                gap: 20px;
            }
            .items-table {
                font-size: 0.8rem;
            }
            .items-table th,
            .items-table td {
                padding: 8px 4px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>QUOTATION</h1>
            <p>Quote ID: ${quote.quote_id} | Revision: ${quote.revision}</p>
        </div>
        
        <div class="content">
            <div class="quote-info">
                <div class="info-group">
                    <h3>Quote Details</h3>
                    <div class="info-item">
                        <span class="info-label">Quote ID:</span>
                        <span class="info-value">${quote.quote_id}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Revision:</span>
                        <span class="info-value">${quote.revision}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Created:</span>
                        <span class="info-value">${formatDate(quote.created_at)}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Valid Until:</span>
                        <span class="info-value">${formatDate(quote.valid_until)}</span>
                    </div>
                </div>
                
                <div class="info-group">
                    <h3>Buyer Information</h3>
                    <div class="info-item">
                        <span class="info-label">Name:</span>
                        <span class="info-value">${quote.buyer.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Buyer ID:</span>
                        <span class="info-value">${quote.buyer.buyer_id}</span>
                    </div>
                    ${quote.buyer.gstin ? `
                    <div class="info-item">
                        <span class="info-label">GSTIN:</span>
                        <span class="info-value">${quote.buyer.gstin}</span>
                    </div>
                    ` : ''}
                    ${quote.buyer.contact ? `
                    <div class="info-item">
                        <span class="info-label">Contact:</span>
                        <span class="info-value">${quote.buyer.contact}</span>
                    </div>
                    ` : ''}
                </div>
            </div>

            <div class="line-items">
                <h3>Line Items</h3>
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>S.No</th>
                            <th>SKU Code</th>
                            <th>Description</th>
                            <th>HSN</th>
                            <th>Qty</th>
                            <th>UOM</th>
                            <th>Rate</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${quote.line_items.map((item, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td><strong>${item.sku_code}</strong></td>
                            <td>${item.description}</td>
                            <td>${item.hsn_code}</td>
                            <td>${item.qty}</td>
                            <td>${item.uom}</td>
                            <td>${formatCurrency(item.unit_rate)}</td>
                            <td>${formatCurrency(item.line_total)}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            ${quote.totals.tax_breakup ? `
            <div class="tax-breakup">
                <h3>Tax Breakup by HSN</h3>
                <table class="tax-table">
                    <thead>
                        <tr>
                            <th>HSN Code</th>
                            <th>Taxable Value</th>
                            <th>CGST</th>
                            <th>SGST</th>
                            <th>IGST</th>
                            <th>Total Tax</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(quote.totals.tax_breakup).map(([hsn, tax]) => `
                        <tr>
                            <td><strong>${hsn}</strong></td>
                            <td>${formatCurrency(tax.taxable_value)}</td>
                            <td>${tax.cgst_rate}% - ${formatCurrency(tax.cgst_amount)}</td>
                            <td>${tax.sgst_rate}% - ${formatCurrency(tax.sgst_amount)}</td>
                            <td>${tax.igst_rate ? `${tax.igst_rate}% - ${formatCurrency(tax.igst_amount || 0)}` : '-'}</td>
                            <td>${formatCurrency(tax.total_tax)}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}

            <div class="financial-summary">
                <h3>Financial Summary</h3>
                <div class="summary-row">
                    <span>Subtotal:</span>
                    <span>${formatCurrency(quote.totals.subtotal)}</span>
                </div>
                <div class="summary-row">
                    <span>Discount:</span>
                    <span>${formatCurrency(quote.totals.discount)}</span>
                </div>
                <div class="summary-row">
                    <span>Freight:</span>
                    <span>${formatCurrency(quote.totals.freight)}</span>
                </div>
                <div class="summary-row">
                    <span>Tax:</span>
                    <span>${formatCurrency(quote.totals.tax)}</span>
                </div>
                <div class="summary-row total">
                    <span>Grand Total:</span>
                    <span>${formatCurrency(quote.totals.grand_total)}</span>
                </div>
            </div>

            <div class="terms">
                <h3>Terms & Conditions</h3>
                <ul>
                    <li>Validity: ${quote.terms.validity_days} days from quote date</li>
                    <li>Lead Time: ${quote.terms.lead_time_days} days from order confirmation</li>
                    <li>Payment Terms: ${quote.terms.payment_terms}</li>
                    <li>Prices are subject to change without notice</li>
                    <li>All disputes subject to Mumbai jurisdiction</li>
                </ul>
            </div>

            ${quote.explainability ? `
            <div class="explainability">
                <h3>Processing Insights</h3>
                <div style="margin-bottom: 20px;">
                    <h4>Processing Steps:</h4>
                    ${quote.explainability.processing_steps.map((step, index) => `
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span><strong>${index + 1}. ${step.step}</strong></span>
                            <span class="badge badge-info">${(step.confidence * 100).toFixed(1)}% confidence</span>
                        </div>
                        <div class="confidence-bar">
                            <div class="confidence-fill" style="width: ${step.confidence * 100}%"></div>
                        </div>
                        <p style="margin: 5px 0; color: #6b7280; font-size: 0.9rem;">${step.description}</p>
                    </div>
                    `).join('')}
                </div>
                
                <div>
                    <h4>SKU Mapping Confidence:</h4>
                    ${Object.entries(quote.explainability.mapping_confidence).map(([sku, confidence]) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span>${sku}</span>
                        <span class="badge ${confidence > 0.8 ? 'badge-success' : confidence > 0.6 ? 'badge-warning' : 'badge-info'}">${(confidence * 100).toFixed(1)}%</span>
                    </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            ${quote.revision_diff ? `
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 30px 0;">
                <h3 style="color: #991b1b; margin: 0 0 15px 0;">Revision Changes (from Rev ${quote.revision_diff.previous_revision})</h3>
                ${quote.revision_diff.changes.map(change => {
                    const colorClass = change.type === 'added' ? '#065f46' : change.type === 'removed' ? '#991b1b' : '#1e40af';
                    const symbol = change.type === 'added' ? '+' : change.type === 'removed' ? '-' : '~';
                    const linePrefix = change.line_item ? `Line ${change.line_item}: ` : '';
                    return `
                    <div style="color: ${colorClass}; margin-bottom: 8px; font-family: monospace;">
                        ${symbol} ${linePrefix}${change.field}: ${change.type === 'modified' ? `${change.old_value} → ${change.new_value}` : change.new_value || change.old_value}
                    </div>
                    `;
                }).join('')}
            </div>
            ` : ''}
        </div>
    </div>
</body>
</html>
    `;
  }

  private generateSummary(quote: Quote): PreviewData['summary'] {
    const mappingSuccessRate = this.calculateMappingSuccessRate(quote);
    const confidenceScore = this.calculateOverallConfidence(quote);

    return {
      total_items: quote.line_items.length,
      total_amount: quote.totals.grand_total,
      mapping_success_rate: mappingSuccessRate,
      confidence_score: confidenceScore
    };
  }

  private validateQuote(quote: Quote): PreviewData['validation'] {
    const errors: PreviewData['validation']['errors'] = [];

    // Validate basic quote information
    if (!quote.quote_id || quote.quote_id.trim() === '') {
      errors.push({ type: 'error', message: 'Quote ID is required', field: 'quote_id' });
    }

    if (!quote.buyer.name || quote.buyer.name.trim() === '') {
      errors.push({ type: 'error', message: 'Buyer name is required', field: 'buyer.name' });
    }

    if (quote.line_items.length === 0) {
      errors.push({ type: 'error', message: 'At least one line item is required' });
    }

    // Validate line items
    quote.line_items.forEach((item, index) => {
      if (!item.sku_code || item.sku_code.trim() === '') {
        errors.push({ 
          type: 'error', 
          message: 'SKU code is required', 
          field: 'sku_code',
          line_item: index + 1 
        });
      }

      if (!item.description || item.description.trim() === '') {
        errors.push({ 
          type: 'warning', 
          message: 'Description is missing', 
          field: 'description',
          line_item: index + 1 
        });
      }

      if (item.qty <= 0) {
        errors.push({ 
          type: 'error', 
          message: 'Quantity must be greater than 0', 
          field: 'qty',
          line_item: index + 1 
        });
      }

      if (item.unit_rate <= 0) {
        errors.push({ 
          type: 'error', 
          message: 'Unit rate must be greater than 0', 
          field: 'unit_rate',
          line_item: index + 1 
        });
      }

      if (!item.hsn_code || item.hsn_code.trim() === '') {
        errors.push({ 
          type: 'warning', 
          message: 'HSN code is missing', 
          field: 'hsn_code',
          line_item: index + 1 
        });
      }
    });

    // Validate financial totals
    if (quote.totals.grand_total <= 0) {
      errors.push({ type: 'error', message: 'Grand total must be greater than 0', field: 'totals.grand_total' });
    }

    // Validate dates
    if (quote.valid_until <= quote.created_at) {
      errors.push({ type: 'warning', message: 'Valid until date should be after creation date' });
    }

    if (quote.valid_until <= new Date()) {
      errors.push({ type: 'warning', message: 'Quote has expired' });
    }

    // Check mapping success rate
    const mappingSuccessRate = this.calculateMappingSuccessRate(quote);
    if (mappingSuccessRate < 0.8) {
      errors.push({ 
        type: 'warning', 
        message: `Low mapping success rate: ${(mappingSuccessRate * 100).toFixed(1)}%` 
      });
    }

    // Check confidence scores
    if (quote.explainability) {
      const avgConfidence = this.calculateOverallConfidence(quote);
      if (avgConfidence < 0.7) {
        errors.push({ 
          type: 'info', 
          message: `Low overall confidence: ${(avgConfidence * 100).toFixed(1)}%` 
        });
      }
    }

    const hasErrors = errors.some(error => error.type === 'error');

    return {
      errors,
      is_valid: !hasErrors
    };
  }

  private calculateMappingSuccessRate(quote: Quote): number {
    if (!quote.original_items || quote.original_items.length === 0) return 1;
    
    const mappedCount = quote.original_items.filter(item => 
      item.mapped_sku && item.mapped_sku !== 'Not mapped'
    ).length;
    
    return mappedCount / quote.original_items.length;
  }

  private calculateOverallConfidence(quote: Quote): number {
    if (!quote.explainability) return 1;
    
    const avgProcessingConfidence = quote.explainability.processing_steps.reduce(
      (sum, step) => sum + step.confidence, 0
    ) / quote.explainability.processing_steps.length;
    
    const mappingConfidences = Object.values(quote.explainability.mapping_confidence);
    const avgMappingConfidence = mappingConfidences.reduce((sum, conf) => sum + conf, 0) / mappingConfidences.length;
    
    return (avgProcessingConfidence + avgMappingConfidence) / 2;
  }
}
