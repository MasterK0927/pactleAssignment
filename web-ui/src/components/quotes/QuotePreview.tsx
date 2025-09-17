import React, { useState, useEffect } from 'react';
import { Download, Eye, FileText, Database, BarChart3, AlertCircle, CheckCircle, Info } from 'lucide-react';

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
  created_at: string;
  valid_until: string;
  line_items: Array<{
    line_no: number;
    sku_code: string;
    description: string;
    qty: number;
    uom: string;
    unit_rate: number;
    line_total: number;
    hsn_code: string;
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

interface QuotePreviewProps {
  quoteId: string;
  onClose: () => void;
}

export const QuotePreview: React.FC<QuotePreviewProps> = ({ quoteId, onClose }) => {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'summary' | 'validation'>('preview');
  const [exportLoading, setExportLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchPreviewData();
  }, [quoteId]);

  const fetchPreviewData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/quotes/${quoteId}/preview`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch preview data');
      }

      const data = await response.json();
      setPreviewData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'pdf-enhanced' | 'csv' | 'json' | 'tax-csv' | 'explainability' | 'bundle') => {
    try {
      setExportLoading(format);
      const token = localStorage.getItem('access_token');
      
      let endpoint = '';
      let filename = '';
      
      switch (format) {
        case 'pdf':
          endpoint = `/api/quotes/${quoteId}/pdf`;
          filename = `quote-${quoteId}.pdf`;
          break;
        case 'pdf-enhanced':
          endpoint = `/api/quotes/${quoteId}/pdf/enhanced`;
          filename = `quote-${quoteId}-enhanced.pdf`;
          break;
        case 'csv':
          endpoint = `/api/quotes/${quoteId}/export/csv`;
          filename = `quote-${quoteId}.csv`;
          break;
        case 'json':
          endpoint = `/api/quotes/${quoteId}/export/json`;
          filename = `quote-${quoteId}.json`;
          break;
        case 'tax-csv':
          endpoint = `/api/quotes/${quoteId}/export/tax-csv`;
          filename = `tax-breakup-${quoteId}.csv`;
          break;
        case 'explainability':
          endpoint = `/api/quotes/${quoteId}/explainability`;
          filename = `explainability-${quoteId}.json`;
          break;
        case 'bundle':
          endpoint = `/api/quotes/${quoteId}/export/bundle`;
          // Bundle returns JSON with file paths
          const bundleResponse = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          const bundleData = await bundleResponse.json();
          alert(`Bundle exported successfully! Files: ${Object.keys(bundleData.files).join(', ')}`);
          return;
      }

      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to export ${format}`);
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportLoading(null);
    }
  };

  const getValidationIcon = (type: 'error' | 'warning' | 'info') => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading preview...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md">
          <div className="text-red-600 mb-4">Error loading preview: {error}</div>
          <button
            onClick={onClose}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!previewData) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="border-b p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Quote Preview - {previewData.quote.quote_id}</h2>
            <p className="text-gray-600">Revision {previewData.quote.revision}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <nav className="flex space-x-8 px-4">
            {[
              { id: 'preview', label: 'Preview', icon: Eye },
              { id: 'summary', label: 'Summary', icon: BarChart3 },
              { id: 'validation', label: 'Validation', icon: CheckCircle },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Main Content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'preview' && (
              <div
                className="prose max-w-none"
                dangerouslySetInnerHTML={{ __html: previewData.html_preview }}
              />
            )}

            {activeTab === 'summary' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {previewData.summary.total_items}
                    </div>
                    <div className="text-sm text-gray-600">Total Items</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      ₹{previewData.summary.total_amount.toLocaleString('en-IN')}
                    </div>
                    <div className="text-sm text-gray-600">Total Amount</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-yellow-600">
                      {(previewData.summary.mapping_success_rate * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Mapping Success</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {(previewData.summary.confidence_score * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">Confidence Score</div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Quote Details</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Buyer:</span> {previewData.quote.buyer.name}
                    </div>
                    <div>
                      <span className="font-medium">Created:</span> {new Date(previewData.quote.created_at).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="font-medium">Valid Until:</span> {new Date(previewData.quote.valid_until).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="font-medium">Payment Terms:</span> {previewData.quote.terms.payment_terms}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'validation' && (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${previewData.validation.is_valid ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex items-center space-x-2">
                    {previewData.validation.is_valid ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className={`font-medium ${previewData.validation.is_valid ? 'text-green-800' : 'text-red-800'}`}>
                      {previewData.validation.is_valid ? 'Quote is valid' : 'Quote has validation issues'}
                    </span>
                  </div>
                </div>

                {previewData.validation.errors.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold">Validation Issues:</h3>
                    {previewData.validation.errors.map((error, index) => (
                      <div key={index} className="flex items-start space-x-2 p-3 bg-gray-50 rounded">
                        {getValidationIcon(error.type)}
                        <div className="flex-1">
                          <div className="font-medium">{error.message}</div>
                          {error.field && (
                            <div className="text-sm text-gray-600">Field: {error.field}</div>
                          )}
                          {error.line_item && (
                            <div className="text-sm text-gray-600">Line Item: {error.line_item}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Export Sidebar */}
          <div className="w-64 border-l bg-gray-50 p-4">
            <h3 className="font-semibold mb-4 flex items-center space-x-2">
              <Download className="w-4 h-4" />
              <span>Export Options</span>
            </h3>
            
            <div className="space-y-2">
              <button
                onClick={() => handleExport('pdf-enhanced')}
                disabled={exportLoading === 'pdf-enhanced'}
                className="w-full flex items-center space-x-2 p-2 text-left hover:bg-white rounded border disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                <span>Enhanced PDF</span>
                {exportLoading === 'pdf-enhanced' && <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 ml-auto"></div>}
              </button>

              <button
                onClick={() => handleExport('pdf')}
                disabled={exportLoading === 'pdf'}
                className="w-full flex items-center space-x-2 p-2 text-left hover:bg-white rounded border disabled:opacity-50"
              >
                <FileText className="w-4 h-4" />
                <span>Standard PDF</span>
                {exportLoading === 'pdf' && <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 ml-auto"></div>}
              </button>

              <button
                onClick={() => handleExport('csv')}
                disabled={exportLoading === 'csv'}
                className="w-full flex items-center space-x-2 p-2 text-left hover:bg-white rounded border disabled:opacity-50"
              >
                <Database className="w-4 h-4" />
                <span>CSV Export</span>
                {exportLoading === 'csv' && <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 ml-auto"></div>}
              </button>

              <button
                onClick={() => handleExport('json')}
                disabled={exportLoading === 'json'}
                className="w-full flex items-center space-x-2 p-2 text-left hover:bg-white rounded border disabled:opacity-50"
              >
                <Database className="w-4 h-4" />
                <span>JSON Export</span>
                {exportLoading === 'json' && <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 ml-auto"></div>}
              </button>

              <button
                onClick={() => handleExport('tax-csv')}
                disabled={exportLoading === 'tax-csv'}
                className="w-full flex items-center space-x-2 p-2 text-left hover:bg-white rounded border disabled:opacity-50"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Tax Breakup CSV</span>
                {exportLoading === 'tax-csv' && <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 ml-auto"></div>}
              </button>

              <button
                onClick={() => handleExport('explainability')}
                disabled={exportLoading === 'explainability'}
                className="w-full flex items-center space-x-2 p-2 text-left hover:bg-white rounded border disabled:opacity-50"
              >
                <Info className="w-4 h-4" />
                <span>Explainability JSON</span>
                {exportLoading === 'explainability' && <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 ml-auto"></div>}
              </button>

              <button
                onClick={() => handleExport('bundle')}
                disabled={exportLoading === 'bundle'}
                className="w-full flex items-center space-x-2 p-2 text-left hover:bg-white rounded border bg-blue-50 border-blue-200 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Complete Bundle</span>
                {exportLoading === 'bundle' && <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 ml-auto"></div>}
              </button>
            </div>

            <div className="mt-6 p-3 bg-blue-50 rounded text-sm">
              <div className="font-medium text-blue-800 mb-1">Export Features:</div>
              <ul className="text-blue-700 space-y-1">
                <li>• Enhanced PDF with branding</li>
                <li>• Tax breakup by HSN</li>
                <li>• Processing explainability</li>
                <li>• Revision differences</li>
                <li>• Multiple export formats</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
