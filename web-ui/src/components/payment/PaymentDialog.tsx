import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Quote } from '../../App';
import { apiClient } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { CreditCard, Download, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote;
}

export const PaymentDialog: React.FC<PaymentDialogProps> = ({
  open,
  onOpenChange,
  quote
}) => {
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'completed'>('pending');
  const [error, setError] = useState<string | null>(null);
  const { user, token } = useAuth();

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const handleStripeCheckout = async () => {
    if (!user || !token) {
      setError('Authentication required');
      return;
    }

    setLoading(true);
    setPaymentStatus('processing');
    setError(null);

    try {
      // Create payment session using apiClient
      const session = await apiClient.createPaymentSession(
        quote.quote_id,
        quote.totals.grand_total
      );

      // Redirect to Stripe checkout
      if (session.checkout_url) {
        window.location.href = session.checkout_url;
        return;
      }

      // If no checkout URL is provided, this is an error
      throw new Error('No checkout URL received from payment service');

    } catch (error: any) {
      console.error('Payment error:', error);
      setError(error.message || 'Payment failed');
      setPaymentStatus('pending');
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    // Simulate PDF download
    const link = document.createElement('a');
    link.href = `/api/quotes/${quote.quote_id}/pdf/`;
    link.download = `quote-${quote.quote_id}.pdf`;
    link.click();
  };

  const resetPayment = () => {
    setPaymentStatus('pending');
    setLoading(false);
    setError(null);
  };

  if (paymentStatus === 'completed') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <span>Payment Successful!</span>
            </DialogTitle>
            <DialogDescription>
              Your quote has been purchased and is ready for download.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Quote ID:</span>
                    <span className="font-medium">{quote.quote_id}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Amount Paid:</span>
                    <span className="font-medium text-green-600">
                      {formatCurrency(quote.totals.grand_total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Payment Status:</span>
                    <Badge className="bg-green-600">Paid</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Button onClick={handleDownloadPDF} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download PDF Quote
              </Button>

              <Button variant="outline" onClick={resetPayment} className="w-full">
                Make Another Purchase
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CreditCard className="h-5 w-5" />
            <span>Purchase Quote</span>
          </DialogTitle>
          <DialogDescription>
            Complete your purchase to download the final quote PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Error Banner */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="text-sm font-medium text-red-800">Payment Error</p>
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quote Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Quote ID:</span>
                  <span className="font-medium">{quote.quote_id}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span>{formatCurrency(quote.totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax:</span>
                  <span>{formatCurrency(quote.totals.tax)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Freight:</span>
                  <span>{formatCurrency(quote.totals.freight)}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span className="text-lg text-blue-600">
                      {formatCurrency(quote.totals.grand_total)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">Payment Method</div>

            <Button
              onClick={handleStripeCheckout}
              disabled={loading || paymentStatus === 'processing'}
              className="w-full h-12"
            >
              {paymentStatus === 'processing' ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Processing Payment...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-4 w-4" />
                  <span>Pay with Stripe</span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              )}
            </Button>

            <div className="text-xs text-gray-500 text-center">
              Secure payment powered by Stripe. Your payment information is encrypted and secure.
            </div>
          </div>

          {/* Terms */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>By completing this purchase, you agree to our terms of service.</p>
            <p>• Quote valid for {quote.terms?.validity_days || 30} days</p>
            <p>• Lead time: {quote.terms?.lead_time_days || 7} days</p>
            <p>• Payment terms: {quote.terms?.payment_terms || 'Standard terms'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};