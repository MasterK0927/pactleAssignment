import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Quote } from '../../App';
import { PaymentDialog } from '../payment/PaymentDialog';
import { apiClient } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Download, Eye, Calendar, DollarSign, CreditCard, CheckCircle } from 'lucide-react';

interface QuoteHistoryItem extends Quote {
  status: 'draft' | 'finalized' | 'paid';
  payment_status?: 'pending' | 'paid' | 'failed';
  created_at: string;
}

export const QuoteHistory: React.FC = () => {
  const [quotes, setQuotes] = useState<QuoteHistoryItem[]>([]);
  const [selectedQuote, setSelectedQuote] = useState<QuoteHistoryItem | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, token } = useAuth();

  useEffect(() => {
    const fetchQuotes = async () => {
      if (!user || !token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const response = await apiClient.getQuotes();
        
        // Transform the API response to match our interface
        const transformedQuotes: QuoteHistoryItem[] = (response.quotes || []).map((quote: any) => ({
          quote_id: quote.quote_id,
          revision: quote.revision || 1,
          created_at: quote.created_at,
          currency: quote.currency || 'INR',
          status: quote.status || 'draft',
          payment_status: quote.payment_status,
          lines: quote.lines || [],
          totals: {
            subtotal: quote.subtotal || 0,
            discount: quote.discount || 0,
            tax: quote.tax || 0,
            freight: quote.freight || 0,
            grand_total: quote.total || 0,
          },
          terms: {
            validity_days: 30,
            payment_terms: '50% advance, balance before dispatch',
            lead_time_days: 7,
          },
        }));

        setQuotes(transformedQuotes);
      } catch (err: any) {
        console.error('Failed to fetch quotes:', err);
        setError(err.message || 'Failed to load quotes');
        
        // Fallback to empty array on error
        setQuotes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchQuotes();
  }, [user, token]);

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string, paymentStatus?: string) => {
    if (status === 'paid' || paymentStatus === 'paid') {
      return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
    }
    if (status === 'finalized') {
      return <Badge variant="secondary"><FileText className="w-3 h-3 mr-1" />Finalized</Badge>;
    }
    return <Badge variant="outline">Draft</Badge>;
  };

  const handlePayment = (quote: QuoteHistoryItem) => {
    setSelectedQuote(quote);
    setPaymentDialogOpen(true);
  };

  const handleViewQuote = (quote: QuoteHistoryItem) => {
    // In a real app, this would navigate to a detailed quote view
    console.log('Viewing quote:', quote.quote_id);
  };

  const handleDownload = (quote: QuoteHistoryItem) => {
    // Simulate PDF download
    const link = document.createElement('a');
    link.href = `/api/quotes/${quote.quote_id}/pdf/`;
    link.download = `quote-${quote.quote_id}.pdf`;
    link.click();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="text-gray-600">Loading quote history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Quote History</span>
          </CardTitle>
          <CardDescription>
            View and manage your generated quotes
          </CardDescription>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No quotes found</p>
              <p className="text-sm">Generate your first quote to see it here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {quotes.map((quote) => (
                <div
                  key={`${quote.quote_id}-${quote.revision}`}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {quote.quote_id}
                          {quote.revision > 1 && (
                            <span className="text-sm text-gray-500 ml-2">
                              (Rev {quote.revision})
                            </span>
                          )}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(quote.created_at)}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <DollarSign className="h-3 w-3" />
                            <span>{formatCurrency(quote.totals.grand_total)}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(quote.status, quote.payment_status)}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewQuote(quote)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>

                    {(quote.status === 'paid' || quote.payment_status === 'paid') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(quote)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    )}

                    {quote.status === 'finalized' && quote.payment_status !== 'paid' && (
                      <Button
                        size="sm"
                        onClick={() => handlePayment(quote)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        Pay Now
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedQuote && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          quote={selectedQuote}
        />
      )}
    </>
  );
};