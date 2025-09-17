import PDFDocument from 'pdfkit';

interface Quote {
  quote_id: string;
  revision: number;
  buyer: {
    buyer_id: string;
    name: string;
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
    explanation?: any;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    freight: number;
    tax: number;
    grand_total: number;
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
}

export class PDFGenerationService {
  async generatePDF(quote: Quote): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Header
        doc.fontSize(20).text('QUOTATION', { align: 'center' });
        doc.moveDown();

        // Quote details
        doc.fontSize(12);
        const currentY = doc.y;
        doc.text(`Quote ID: ${quote.quote_id}`, 50, currentY);
        doc.text(`Date: ${new Date(quote.created_at).toLocaleDateString()}`, 400, currentY);
        
        doc.text(`Valid Until: ${new Date(quote.valid_until).toLocaleDateString()}`, 50, doc.y);
        doc.text(`Revision: ${quote.revision}`, 400, doc.y - 14);
        doc.moveDown();

        // Buyer details
        doc.text(`Buyer: ${quote.buyer.name}`);
        doc.text(`Buyer ID: ${quote.buyer.buyer_id}`);
        doc.moveDown();

        // Original RFQ Items Section (if available)
        if (quote.original_items && quote.original_items.length > 0) {
          doc.fontSize(14).text('Original RFQ Items:', { underline: true });
          doc.moveDown(0.5);
          
          // Table headers
          const tableTop = doc.y;
          doc.fontSize(10);
          doc.text('No.', 50, tableTop);
          doc.text('Original Description', 80, tableTop);
          doc.text('Qty', 350, tableTop);
          doc.text('UOM', 380, tableTop);
          doc.text('Mapped to SKU', 420, tableTop);
          
          // Draw header line
          doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
          
          let currentY = tableTop + 25;
          quote.original_items.forEach((item, index) => {
            if (currentY > 700) {
              doc.addPage();
              currentY = 50;
            }
            
            doc.text((index + 1).toString(), 50, currentY);
            const description = item.input_text.length > 40 ? item.input_text.substring(0, 37) + '...' : item.input_text;
            doc.text(description, 80, currentY);
            doc.text(item.qty.toString(), 350, currentY);
            doc.text(item.uom || 'PCS', 380, currentY);
            doc.text(item.mapped_sku || 'Not mapped', 420, currentY);
            currentY += 20;
          });
          
          // Draw final line
          doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
          doc.y = currentY + 20;
        }

        // Grouped Quote Items Section
        if (quote.line_items && quote.line_items.length > 0) {
          doc.fontSize(14).text('Final Quote Items (Grouped by SKU):', { underline: true });
          doc.moveDown(0.5);
          
          // Table headers
          const tableTop = doc.y;
          doc.fontSize(9);
          doc.text('Line', 50, tableTop);
          doc.text('SKU Code', 80, tableTop);
          doc.text('Description', 150, tableTop);
          doc.text('HSN', 280, tableTop);
          doc.text('Qty', 320, tableTop);
          doc.text('UOM', 350, tableTop);
          doc.text('Rate (₹)', 380, tableTop);
          doc.text('Total (₹)', 450, tableTop);
          
          // Draw header line
          doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
          
          let currentY = tableTop + 25;
          quote.line_items.forEach((item, index) => {
            if (currentY > 700) {
              doc.addPage();
              currentY = 50;
            }
            
            doc.text(item.line_no.toString(), 50, currentY);
            doc.text(item.sku_code, 80, currentY);
            const description = item.description.length > 20 ? item.description.substring(0, 17) + '...' : item.description;
            doc.text(description, 150, currentY);
            doc.text(item.hsn_code, 280, currentY);
            doc.text(item.qty.toString(), 320, currentY);
            doc.text(item.uom, 350, currentY);
            doc.text(item.unit_rate.toFixed(2), 380, currentY);
            doc.text(item.line_total.toFixed(2), 450, currentY);
            currentY += 18;
          });
          
          // Draw final line and subtotal
          doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
          currentY += 10;
          doc.fontSize(10).text('Subtotal:', 380, currentY);
          doc.text(`₹${quote.totals.subtotal.toFixed(2)}`, 450, currentY);
          doc.y = currentY + 20;
        }

        // Totals section
        doc.moveDown();
        doc.fontSize(12);
        const totalsY = doc.y;
        doc.text('Financial Summary:', 50, totalsY, { underline: true });
        doc.moveDown(0.5);
        
        doc.fontSize(11);
        doc.text(`Subtotal: ₹${quote.totals.subtotal.toFixed(2)}`, 350);
        doc.text(`Discount: ₹${quote.totals.discount.toFixed(2)}`, 350);
        doc.text(`Freight: ₹${quote.totals.freight.toFixed(2)}`, 350);
        doc.text(`Tax (18%): ₹${quote.totals.tax.toFixed(2)}`, 350);
        doc.moveDown(0.3);
        doc.fontSize(13).text(`Grand Total: ₹${quote.totals.grand_total.toFixed(2)}`, 350, doc.y, { 
          underline: true 
        });

        // Summary section
        if (quote.original_items && quote.original_items.length > 0) {
          doc.moveDown();
          doc.fontSize(12).text('Processing Summary:', { underline: true });
          doc.moveDown(0.5);
          doc.fontSize(10);
          doc.text(`• Total Original Items: ${quote.original_items.length}`);
          doc.text(`• Grouped Quote Items: ${quote.line_items.length}`);
          
          const mappedCount = quote.original_items.filter(item => item.mapped_sku && item.mapped_sku !== 'Not mapped').length;
          doc.text(`• Successfully Mapped: ${mappedCount}/${quote.original_items.length}`);
          
          if (mappedCount < quote.original_items.length) {
            doc.fillColor('red').text(`• Unmapped Items: ${quote.original_items.length - mappedCount} (please review)`);
            doc.fillColor('black');
          }
        }

        // Terms & Conditions
        doc.moveDown();
        doc.fontSize(12).text('Terms & Conditions:', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);
        doc.text(`Validity: ${quote.terms.validity_days} days`);
        doc.text(`Lead Time: ${quote.terms.lead_time_days} days`);
        doc.text(`Payment Terms: ${quote.terms.payment_terms}`);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
