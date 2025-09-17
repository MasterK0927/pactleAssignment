import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Ensure PDFDocument is properly imported
const PDFDoc = PDFDocument as any;

// Type definition for PDFDocument
type PDFDoc = PDFKit.PDFDocument;

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

interface CompanyBranding {
  company_name: string;
  logo_path?: string;
  address: string;
  gstin: string;
  pan: string;
  contact: {
    phone: string;
    email: string;
    website?: string;
  };
  authorized_signatory: {
    name: string;
    designation: string;
  };
}

export class PDFGenerationService {
  private readonly defaultBranding: CompanyBranding = {
    company_name: 'Pactle Manufacturing Solutions',
    address: '123 Industrial Area, Manufacturing Hub, Mumbai - 400001',
    gstin: '27ABCDE1234F1Z5',
    pan: 'ABCDE1234F',
    contact: {
      phone: '+91-22-12345678',
      email: 'quotes@pactle.com',
      website: 'www.pactle.com'
    },
    authorized_signatory: {
      name: 'Rajesh Kumar',
      designation: 'Sales Manager'
    }
  };

  async generatePDF(quote: Quote, branding?: CompanyBranding): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Comprehensive input validation
        if (!quote) {
          throw new Error('Quote data is required');
        }
        
        if (!quote.quote_id || typeof quote.quote_id !== 'string' || quote.quote_id.trim() === '') {
          throw new Error('Invalid quote data: quote_id is required and must be a non-empty string');
        }
        
        if (!quote.line_items || !Array.isArray(quote.line_items) || quote.line_items.length === 0) {
          throw new Error('Invalid quote data: at least one line item is required');
        }
        
        if (!quote.buyer || !quote.buyer.name || typeof quote.buyer.name !== 'string') {
          throw new Error('Invalid quote data: buyer name is required');
        }
        
        if (!quote.totals || typeof quote.totals.grand_total !== 'number' || quote.totals.grand_total <= 0) {
          throw new Error('Invalid quote data: valid totals are required');
        }
        
        // Validate line items
        for (let i = 0; i < quote.line_items.length; i++) {
          const item = quote.line_items[i];
          if (!item.sku_code || !item.description || typeof item.qty !== 'number' || item.qty <= 0) {
            throw new Error(`Invalid line item at index ${i}: missing required fields or invalid quantity`);
          }
        }

        // Create PDF document with error handling
        let doc: any;
        try {
          doc = new PDFDoc({ 
            size: 'A4',
            margin: 50,
            info: {
              Title: `Quotation ${quote.quote_id}`,
              Author: branding?.company_name || this.defaultBranding.company_name,
              Subject: `Quote for ${quote.buyer.name}`,
              Keywords: 'quote, rfq, manufacturing'
            }
          });
        } catch (pdfError) {
          console.error('PDF document creation failed:', pdfError);
          throw new Error(`PDF document creation failed: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
        }
        const chunks: Buffer[] = [];
        const brand = branding || this.defaultBranding;
        let pageNumber = 1;

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add page numbering function
        const addPageNumber = () => {
          doc.fontSize(8).fillColor('gray')
            .text(`Page ${pageNumber}`, 50, doc.page.height - 30, { align: 'center' });
          pageNumber++;
          doc.fillColor('black');
        };

        // Header with company branding
        this.addCompanyHeader(doc, brand);
        
        // Quote details section
        this.addQuoteDetails(doc, quote);
        
        // Buyer details
        this.addBuyerDetails(doc, quote.buyer);

        // Line items with enhanced formatting
        this.addLineItems(doc, quote);
        
        // Tax breakup by HSN
        if (quote.totals.tax_breakup) {
          this.addTaxBreakup(doc, quote.totals.tax_breakup);
        }
        
        // Financial summary
        this.addFinancialSummary(doc, quote.totals);
        
        // Terms & Conditions
        this.addTermsAndConditions(doc, quote.terms);
        
        // Explainability section (if available)
        if (quote.explainability) {
          this.addExplainabilitySection(doc, quote.explainability);
        }
        
        // Revision diff (if available)
        if (quote.revision_diff) {
          this.addRevisionDiff(doc, quote.revision_diff);
        }
        
        // Signature block
        this.addSignatureBlock(doc, brand);
        
        // Add page number to first page
        addPageNumber();

        doc.end();
      } catch (error) {
        console.error('PDF generation error:', error);
        // Provide more specific error information
        const errorMessage = error instanceof Error ? error.message : 'Unknown PDF generation error';
        reject(new Error(`PDF generation failed: ${errorMessage}`));
      }
    });
  }

  private addCompanyHeader(doc: any, branding: CompanyBranding): void {
    try {
      // Company header with branding
      doc.fontSize(18).fillColor('#2563eb').text(branding.company_name || 'Company Name', { align: 'center' });
      doc.fontSize(10).fillColor('black').text(branding.address || 'Company Address', { align: 'center' });
      doc.text(`GSTIN: ${branding.gstin || 'N/A'} | PAN: ${branding.pan || 'N/A'}`, { align: 'center' });
      doc.text(`Phone: ${branding.contact?.phone || 'N/A'} | Email: ${branding.contact?.email || 'N/A'}`, { align: 'center' });
      if (branding.contact?.website) {
        doc.text(`Website: ${branding.contact.website}`, { align: 'center' });
      }
      
      // Draw line separator
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown();
      
      // QUOTATION title
      doc.fontSize(20).fillColor('#1f2937').text('QUOTATION', { align: 'center' });
      doc.moveDown();
    } catch (error) {
      console.error('Error adding company header:', error);
      // Add fallback header
      doc.fontSize(20).fillColor('#1f2937').text('QUOTATION', { align: 'center' });
      doc.moveDown();
    }
  }

  private addQuoteDetails(doc: any, quote: Quote): void {
    try {
      const startY = doc.y;
      
      // Left column
      doc.fontSize(11);
      doc.text(`Quote ID: ${quote.quote_id || 'N/A'}`, 50, startY);
      
      const createdDate = quote.created_at ? new Date(quote.created_at).toLocaleDateString('en-IN') : 'N/A';
      doc.text(`Date: ${createdDate}`, 50, startY + 15);
      
      const validUntilDate = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('en-IN') : 'N/A';
      doc.text(`Valid Until: ${validUntilDate}`, 50, startY + 30);
      
      // Right column
      doc.text(`Revision: ${quote.revision || 1}`, 400, startY);
      doc.text(`Currency: INR (₹)`, 400, startY + 15);
      
      doc.y = startY + 50;
      doc.moveDown(0.5);
    } catch (error) {
      console.error('Error adding quote details:', error);
      // Add minimal fallback details
      doc.fontSize(11);
      doc.text(`Quote ID: ${quote.quote_id || 'N/A'}`, 50);
      doc.moveDown();
    }
  }

  private addBuyerDetails(doc: any, buyer: Quote['buyer']): void {
    try {
      doc.fontSize(12).text('Bill To:', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11);
      doc.text(`${buyer?.name || 'N/A'}`);
      if (buyer?.address) doc.text(`${buyer.address}`);
      if (buyer?.gstin) doc.text(`GSTIN: ${buyer.gstin}`);
      if (buyer?.contact) doc.text(`Contact: ${buyer.contact}`);
      doc.moveDown();
    } catch (error) {
      console.error('Error adding buyer details:', error);
      // Add fallback buyer info
      doc.fontSize(12).text('Bill To:', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11);
      doc.text('Buyer Information');
      doc.moveDown();
    }
  }

  private addLineItems(doc: any, quote: Quote): void {
    try {
      if (!quote.line_items || quote.line_items.length === 0) {
        doc.fontSize(12).text('No line items available', { underline: true });
        doc.moveDown();
        return;
      }
      
      doc.fontSize(12).text('Line Items:', { underline: true });
      doc.moveDown(0.5);
      
      // Table headers
      const tableTop = doc.y;
      doc.fontSize(9);
      const headers = ['S.No', 'SKU Code', 'Description', 'HSN', 'Qty', 'UOM', 'Rate (₹)', 'Total (₹)'];
      const positions = [50, 80, 150, 280, 320, 350, 400, 480];
      
      headers.forEach((header, i) => {
        doc.text(header, positions[i], tableTop);
      });
      
      // Draw header line
      doc.moveTo(50, tableTop + 15).lineTo(545, tableTop + 15).stroke();
      
      let currentY = tableTop + 25;
      quote.line_items.forEach((item, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }
        
        const values = [
          (index + 1).toString(),
          item.sku_code || 'N/A',
          item.description ? (item.description.length > 20 ? item.description.substring(0, 17) + '...' : item.description) : 'N/A',
          item.hsn_code || 'N/A',
          (item.qty || 0).toString(),
          item.uom || 'N/A',
          (item.unit_rate || 0).toFixed(2),
          (item.line_total || 0).toFixed(2)
        ];
        
        values.forEach((value, i) => {
          doc.text(value, positions[i], currentY);
        });
        
        currentY += 18;
      });
      
      // Draw final line
      doc.moveTo(50, currentY).lineTo(545, currentY).stroke();
      doc.y = currentY + 10;
    } catch (error) {
      console.error('Error adding line items:', error);
      // Add fallback line items section
      doc.fontSize(12).text('Line Items: Error displaying items', { underline: true });
      doc.moveDown();
    }
  }

  private addTaxBreakup(doc: PDFDoc, taxBreakup: NonNullable<Quote['totals']['tax_breakup']>): void {
    doc.moveDown();
    doc.fontSize(12).text('Tax Breakup by HSN:', { underline: true });
    doc.moveDown(0.5);
    
    // Table headers
    const tableTop = doc.y;
    doc.fontSize(9);
    const headers = ['HSN Code', 'Taxable Value', 'CGST', 'SGST', 'IGST', 'Total Tax'];
    const positions = [50, 120, 200, 260, 320, 380];
    
    headers.forEach((header, i) => {
      doc.text(header, positions[i], tableTop);
    });
    
    doc.moveTo(50, tableTop + 15).lineTo(450, tableTop + 15).stroke();
    
    let currentY = tableTop + 25;
    Object.entries(taxBreakup).forEach(([hsn, tax]) => {
      const values = [
        hsn,
        `₹${tax.taxable_value.toFixed(2)}`,
        `${tax.cgst_rate}% - ₹${tax.cgst_amount.toFixed(2)}`,
        `${tax.sgst_rate}% - ₹${tax.sgst_amount.toFixed(2)}`,
        tax.igst_rate ? `${tax.igst_rate}% - ₹${tax.igst_amount?.toFixed(2)}` : '-',
        `₹${tax.total_tax.toFixed(2)}`
      ];
      
      values.forEach((value, i) => {
        doc.text(value, positions[i], currentY);
      });
      
      currentY += 18;
    });
    
    doc.moveTo(50, currentY).lineTo(450, currentY).stroke();
    doc.y = currentY + 10;
  }

  private addFinancialSummary(doc: any, totals: Quote['totals']): void {
    try {
      doc.moveDown();
      doc.fontSize(12).text('Financial Summary:', { underline: true });
      doc.moveDown(0.5);
      
      const summaryItems = [
        ['Subtotal:', `₹${(totals?.subtotal || 0).toFixed(2)}`],
        ['Discount:', `₹${(totals?.discount || 0).toFixed(2)}`],
        ['Freight:', `₹${(totals?.freight || 0).toFixed(2)}`],
        ['Tax:', `₹${(totals?.tax || 0).toFixed(2)}`],
        ['Grand Total:', `₹${(totals?.grand_total || 0).toFixed(2)}`]
      ];
      
      doc.fontSize(11);
      summaryItems.forEach(([label, value], index) => {
        if (index === summaryItems.length - 1) {
          doc.fontSize(13).fillColor('#2563eb');
        }
        doc.text(label, 350, doc.y);
        doc.text(value, 450, doc.y - 14);
        doc.moveDown(0.3);
      });
      
      doc.fillColor('black').fontSize(11);
    } catch (error) {
      console.error('Error adding financial summary:', error);
      // Add fallback financial summary
      doc.moveDown();
      doc.fontSize(12).text('Financial Summary: Error displaying totals', { underline: true });
      doc.moveDown();
    }
  }

  private addTermsAndConditions(doc: PDFDoc, terms: Quote['terms']): void {
    doc.moveDown();
    doc.fontSize(12).text('Terms & Conditions:', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`• Validity: ${terms.validity_days} days from quote date`);
    doc.text(`• Lead Time: ${terms.lead_time_days} days from order confirmation`);
    doc.text(`• Payment Terms: ${terms.payment_terms}`);
    doc.text('• Prices are subject to change without notice');
    doc.text('• All disputes subject to Mumbai jurisdiction');
  }

  private addExplainabilitySection(doc: PDFDoc, explainability: NonNullable<Quote['explainability']>): void {
    doc.addPage();
    doc.fontSize(14).text('Quote Processing Explainability', { underline: true });
    doc.moveDown();
    
    // Processing steps
    doc.fontSize(12).text('Processing Steps:', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    
    explainability.processing_steps.forEach((step, index) => {
      doc.text(`${index + 1}. ${step.step} (Confidence: ${(step.confidence * 100).toFixed(1)}%)`);
      doc.text(`   ${step.description}`);
      doc.moveDown(0.3);
    });
    
    // Mapping confidence
    doc.moveDown();
    doc.fontSize(12).text('SKU Mapping Confidence:', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    
    Object.entries(explainability.mapping_confidence).forEach(([sku, confidence]) => {
      doc.text(`• ${sku}: ${(confidence * 100).toFixed(1)}%`);
    });
    
    // Pricing logic
    doc.moveDown();
    doc.fontSize(12).text('Pricing Logic:', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Base Pricing: ${explainability.pricing_logic.base_pricing}`);
    
    if (explainability.pricing_logic.adjustments.length > 0) {
      doc.text('Adjustments:');
      explainability.pricing_logic.adjustments.forEach(adj => {
        doc.text(`• ${adj.factor}: ${adj.impact > 0 ? '+' : ''}${adj.impact}% - ${adj.reason}`);
      });
    }
  }

  private addRevisionDiff(doc: PDFDoc, revisionDiff: NonNullable<Quote['revision_diff']>): void {
    doc.moveDown();
    doc.fontSize(12).text(`Changes from Revision ${revisionDiff.previous_revision}:`, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    
    revisionDiff.changes.forEach(change => {
      let changeText = '';
      const linePrefix = change.line_item ? `Line ${change.line_item}: ` : '';
      
      switch (change.type) {
        case 'added':
          doc.fillColor('green');
          changeText = `+ ${linePrefix}${change.field}: ${change.new_value}`;
          break;
        case 'removed':
          doc.fillColor('red');
          changeText = `- ${linePrefix}${change.field}: ${change.old_value}`;
          break;
        case 'modified':
          doc.fillColor('blue');
          changeText = `~ ${linePrefix}${change.field}: ${change.old_value} → ${change.new_value}`;
          break;
      }
      
      doc.text(changeText);
      doc.fillColor('black');
      doc.moveDown(0.2);
    });
  }

  private addSignatureBlock(doc: PDFDoc, branding: CompanyBranding): void {
    // Move to bottom of page or add space
    const bottomY = doc.page.height - 150;
    if (doc.y < bottomY - 100) {
      doc.y = bottomY - 100;
    }
    
    doc.moveDown();
    doc.fontSize(12).text('Authorized Signatory:', { underline: true });
    doc.moveDown(2);
    
    // Signature line
    doc.moveTo(50, doc.y).lineTo(250, doc.y).stroke();
    doc.moveDown(0.5);
    
    doc.fontSize(11);
    doc.text(branding.authorized_signatory.name);
    doc.text(branding.authorized_signatory.designation);
    doc.text(branding.company_name);
    
    // Company stamp placeholder
    doc.text('Place for Company Stamp', 350, doc.y - 40);
    doc.rect(350, doc.y - 35, 150, 50).stroke();
  }

  // Method to generate explainability JSON
  async generateExplainabilityJSON(quote: Quote): Promise<string> {
    const explainabilityData = {
      quote_id: quote.quote_id,
      revision: quote.revision,
      timestamp: new Date().toISOString(),
      processing_summary: {
        total_original_items: quote.original_items?.length || 0,
        total_line_items: quote.line_items.length,
        mapping_success_rate: this.calculateMappingSuccessRate(quote)
      },
      explainability: quote.explainability,
      confidence_metrics: this.calculateConfidenceMetrics(quote)
    };
    
    return JSON.stringify(explainabilityData, null, 2);
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
