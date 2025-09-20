import React, { useState } from 'react';
import { Quote } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { CheckCircle, AlertTriangle, Clock, FileText, Calendar, BarChart3, TrendingUp, Eye, Download } from 'lucide-react';
import { QuotePreview } from './quotes/QuotePreview';

interface QuoteOutputProps {
  quote: Quote | null;
  loading: boolean;
}


export const QuoteOutput: React.FC<QuoteOutputProps> = ({ quote, loading }) => {
  const [showPreview, setShowPreview] = useState(false);
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-muted-foreground">Processing RFQ...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quote) {
    return null;
  }

  const formatCurrency = (amount: number | undefined) => {
    return `₹${(amount || 0).toLocaleString('en-IN')}`;
  };

  const mappedLines = quote.lines?.filter(line => !line.needs_review) || [];
  const reviewLines = quote.lines?.filter(line => line.needs_review) || [];
  const assumptionNotes: { lineIndex: number; notes: string[] }[] = [];
  quote.lines?.forEach((line, idx) => {
    const notes = line.explain?.assumptions || [];
    if (notes.length) {
      assumptionNotes.push({ lineIndex: idx + 1, notes });
    }
  });

  return (
    <div className="space-y-6">
      {/* Quote Summary */}
      <Card className="bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">
                Quote #{quote.quote_id}
              </CardTitle>
              <CardDescription className="flex items-center space-x-2 mt-1">
                <Calendar className="h-4 w-4" />
                <span>Generated on {new Date(quote.created_at).toLocaleString()}</span>
              </CardDescription>
            </div>
            <Badge variant="default" className="bg-green-600">
              Ready
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-card rounded-lg border">
              <div className="text-lg font-semibold">{formatCurrency(quote.totals?.subtotal)}</div>
              <div className="text-sm text-muted-foreground">Subtotal</div>
            </div>
            <div className="text-center p-4 bg-card rounded-lg border">
              <div className="text-lg font-semibold">{formatCurrency(quote.totals?.tax)}</div>
              <div className="text-sm text-muted-foreground">Tax (18%)</div>
            </div>
            <div className="text-center p-4 bg-card rounded-lg border">
              <div className="text-lg font-semibold">{formatCurrency(quote.totals?.freight)}</div>
              <div className="text-sm text-muted-foreground">Freight</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg border">
              <div className="text-lg font-bold">{formatCurrency(quote.totals?.grand_total)}</div>
              <div className="text-sm opacity-90">Grand Total</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Original RFQ Items */}
      {quote.lines && quote.lines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-600" />
              <span>Original RFQ Items</span>
            </CardTitle>
            <CardDescription>
              All items from your uploaded RFQ with mapping status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-4 py-2 text-left text-sm font-semibold">No.</th>
                    <th className="border border-gray-200 px-4 py-2 text-left text-sm font-semibold">Original Description</th>
                    <th className="border border-gray-200 px-4 py-2 text-left text-sm font-semibold">Qty</th>
                    <th className="border border-gray-200 px-4 py-2 text-left text-sm font-semibold">Mapped to SKU</th>
                    <th className="border border-gray-200 px-4 py-2 text-left text-sm font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lines.map((line, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-4 py-2 text-sm">{index + 1}</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm">{line.input_text}</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm">
                        {line.resolved?.qty_uom || 'N/A'} {line.resolved?.uom || ''}
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-sm">
                        {line.resolved?.sku_code || 'Not mapped'}
                      </td>
                      <td className="border border-gray-200 px-4 py-2 text-sm">
                        {line.needs_review ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Needs Review
                          </Badge>
                        ) : line.resolved?.sku_code ? (
                          <Badge variant="default" className="text-xs bg-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Mapped
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Not Mapped
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grouped Quote Items */}
      {quote.line_items && quote.line_items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              <span>Final Quote Items (Grouped by SKU)</span>
            </CardTitle>
            <CardDescription>
              Similar items consolidated with pricing details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-200">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-200 px-4 py-2 text-left text-sm font-semibold">Line</th>
                    <th className="border border-gray-200 px-4 py-2 text-left text-sm font-semibold">SKU Code</th>
                    <th className="border border-gray-200 px-4 py-2 text-left text-sm font-semibold">Description</th>
                    <th className="border border-gray-200 px-4 py-2 text-left text-sm font-semibold">HSN</th>
                    <th className="border border-gray-200 px-4 py-2 text-right text-sm font-semibold">Qty</th>
                    <th className="border border-gray-200 px-4 py-2 text-left text-sm font-semibold">UOM</th>
                    <th className="border border-gray-200 px-4 py-2 text-right text-sm font-semibold">Rate (₹)</th>
                    <th className="border border-gray-200 px-4 py-2 text-right text-sm font-semibold">Total (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.line_items.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="border border-gray-200 px-4 py-2 text-sm">{item.line_no}</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm font-mono">{item.sku_code}</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm">{item.description}</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm">{item.hsn_code}</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm text-right">{item.qty}</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm">{item.uom}</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm text-right">{item.unit_rate.toFixed(2)}</td>
                      <td className="border border-gray-200 px-4 py-2 text-sm text-right font-semibold">{item.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-semibold">
                    <td colSpan={7} className="border border-gray-200 px-4 py-2 text-sm text-right">Subtotal:</td>
                    <td className="border border-gray-200 px-4 py-2 text-sm text-right">{formatCurrency(quote.totals?.subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Summary */}
      {quote.lines && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-purple-600" />
              <span>Processing Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg border">
                <div className="text-lg font-semibold text-blue-900">{quote.lines.length}</div>
                <div className="text-sm text-blue-600">Original Items</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border">
                <div className="text-lg font-semibold text-green-900">{quote.line_items?.length || 0}</div>
                <div className="text-sm text-green-600">Grouped Items</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border">
                <div className="text-lg font-semibold text-green-900">
                  {quote.lines.filter(line => line.resolved?.sku_code && !line.needs_review).length}
                </div>
                <div className="text-sm text-green-600">Successfully Mapped</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border">
                <div className="text-lg font-semibold text-orange-900">
                  {quote.lines.filter(line => line.needs_review).length}
                </div>
                <div className="text-sm text-orange-600">Need Review</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes & Assumptions */}
      {(assumptionNotes.length > 0 || reviewLines.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span>Notes & Assumptions</span>
            </CardTitle>
            <CardDescription>
              Deterministic defaults and items requiring manual review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assumptionNotes.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-2">Assumptions</div>
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {assumptionNotes.map((a, i) => (
                    <li key={`assump-${i}`}>
                      <span className="font-medium">Line {a.lineIndex}:</span> {a.notes.join('; ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {reviewLines.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-2">Needs Review</div>
                <ul className="list-disc pl-5 space-y-3 text-sm text-muted-foreground">
                  {reviewLines.map((line, i) => (
                    <li key={`review-${i}`}>
                      <div>
                        <span className="font-medium">Input:</span> {line.input_text}
                      </div>
                      {line.candidates && line.candidates.length > 0 && (
                        <div className="mt-1">
                          <div className="text-xs text-muted-foreground mb-1">Top candidates:</div>
                          <ul className="list-disc pl-5 space-y-1">
                            {line.candidates.slice(0, 3).map((c, idx) => (
                              <li key={`cand-${i}-${idx}`} className="text-xs">
                                <span className="font-medium">{c.sku_code}</span> – {c.description} (score: {c.score?.toFixed?.(2) ?? c.score})
                                {c.reason ? ` • ${c.reason}` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Terms & Conditions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Terms & Conditions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-lg font-semibold text-gray-900">{quote.terms?.validity_days || 30} days</div>
              <div className="text-sm text-gray-600">Quote Validity</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-lg font-semibold text-gray-900">{quote.terms?.lead_time_days || 7} days</div>
              <div className="text-sm text-gray-600">Lead Time</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-sm font-semibold text-gray-900">{quote.terms?.payment_terms || 'Standard terms'}</div>
              <div className="text-sm text-gray-600">Payment Terms</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Quote Actions</span>
          </CardTitle>
          <CardDescription>
            Preview and export your quote in various formats
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Eye className="h-4 w-4" />
              <span>Preview Quote</span>
            </button>
            
            <button
              onClick={async () => {
                if (!quote.line_items || quote.line_items.length === 0) {
                  alert('This quote has no line items to export. Please review the RFQ/mapping and generate again.');
                  return;
                }
                try {
                  const token = localStorage.getItem('access_token');
                  if (!token) {
                    alert('Please sign in to download PDF');
                    return;
                  }
                  
                  const response = await fetch(`/api/quotes/${quote.quote_id}/pdf/enhanced`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  
                  if (!response.ok) {
                    const errorText = await response.text();
                    console.error('PDF download failed:', errorText);
                    throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
                  }
                  
                  const blob = await response.blob();
                  if (blob.size === 0) {
                    throw new Error('PDF file is empty');
                  }
                  
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `quote-${quote.quote_id}-enhanced.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } catch (error: any) {
                  console.error('Error downloading PDF:', error);
                  alert(`Failed to download PDF: ${error.message || 'Unknown error'}`);
                }
              }}
              className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download Enhanced PDF</span>
            </button>

            {quote.line_items && quote.line_items.length > 0 && (
            <button
              onClick={async () => {
                try {
                  const token = localStorage.getItem('access_token');
                  if (!token) {
                    alert('Please sign in to export CSV');
                    return;
                  }
                  
                  const response = await fetch(`/api/quotes/${quote.quote_id}/export/csv`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  
                  if (!response.ok) {
                    const errorText = await response.text();
                    console.error('CSV export failed:', errorText);
                    throw new Error(`Failed to export CSV: ${response.status} ${response.statusText}`);
                  }
                  
                  const blob = await response.blob();
                  if (blob.size === 0) {
                    throw new Error('CSV file is empty');
                  }
                  
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `quote-${quote.quote_id}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } catch (error: any) {
                  console.error('Error exporting CSV:', error);
                  alert(`Failed to export CSV: ${error.message || 'Unknown error'}`);
                }
              }}
              className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            )}

            {quote.line_items && quote.line_items.length > 0 && (
            <button
              onClick={async () => {
                try {
                  const token = localStorage.getItem('access_token');
                  if (!token) {
                    alert('Please sign in to export explainability data');
                    return;
                  }
                  
                  const response = await fetch(`/api/quotes/${quote.quote_id}/explainability`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  
                  if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Explainability export failed:', errorText);
                    throw new Error(`Failed to export explainability data: ${response.status} ${response.statusText}`);
                  }
                  
                  const blob = await response.blob();
                  if (blob.size === 0) {
                    throw new Error('Explainability file is empty');
                  }
                  
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `explainability-${quote.quote_id}.json`;
                  document.body.appendChild(a);
                  a.click();
                  window.URL.revokeObjectURL(url);
                  document.body.removeChild(a);
                } catch (error: any) {
                  console.error('Error exporting explainability data:', error);
                  alert(`Failed to export explainability data: ${error.message || 'Unknown error'}`);
                }
              }}
              className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <TrendingUp className="h-4 w-4" />
              <span>Explainability Data</span>
            </button>
            )}
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Enhanced Features Available:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Professional PDF with company branding and signature block</li>
              <li>• Tax breakup by HSN codes with CGST/SGST/IGST details</li>
              <li>• Processing explainability and confidence metrics</li>
              <li>• Revision tracking and change history</li>
              <li>• Multiple export formats (PDF, CSV, JSON)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {showPreview && (
        <QuotePreview
          quoteId={quote.quote_id}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};
