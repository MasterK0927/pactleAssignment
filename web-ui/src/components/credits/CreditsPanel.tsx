import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { apiClient } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { PlusCircle, RefreshCw, CreditCard, AlertCircle } from 'lucide-react';

export const CreditsPanel: React.FC = () => {
  const [credits, setCredits] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const { user, isAuthenticated } = useAuth();

  const refresh = async () => {
    if (!isAuthenticated || !user) return;
    
    setLoading(true);
    setError(null);
    try {
      const buyerId = user.id || 'WEB-USER';
      const res = await apiClient.getCredits(buyerId);
      setCredits(res.credits || 0);
    } catch (e: any) {
      console.error('Failed to fetch credits:', e);
      setError(e.message || 'Failed to load credits');
      setCredits(0);
    } finally {
      setLoading(false);
    }
  };

  const topup = async (amount: number) => {
    if (!isAuthenticated || !user) return;
    
    setLoading(true);
    setError(null);
    try {
      const cost = amount * 10; // 10 INR per credit
      
      // Create Stripe checkout session
      const session = await apiClient.createCreditsSession(amount, cost);
      
      // Redirect to Stripe checkout
      if (session.checkout_url) {
        window.location.href = session.checkout_url;
      } else {
        throw new Error('No checkout URL received from server');
      }
    } catch (e: any) {
      console.error('Failed to create checkout session:', e);
      setError(e.message || 'Failed to create checkout session');
      setLoading(false);
    }
    // Note: Don't set loading to false here as we're redirecting to Stripe
  };

  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">Authentication Required</p>
              <p className="text-xs text-amber-700">Please sign in to manage your credits.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-800">Error</p>
                <p className="text-xs text-red-700">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Credits</span>
              </CardTitle>
              <CardDescription>Manage credits for quote generation • User: {user?.email}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-between">
              <div>
                <div className="text-sm text-blue-600 font-medium">Available Credits</div>
                <div className="text-3xl font-bold text-blue-800">{loading ? '...' : credits}</div>
                <div className="text-xs text-blue-600 mt-1">
                  {credits === 0 ? 'No credits remaining' : `${credits} quote${credits !== 1 ? 's' : ''} available`}
                </div>
              </div>
              <Badge variant="outline" className="bg-white">1 credit per quote</Badge>
            </div>

            <div className="md:col-span-2 p-4 border rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-3">Quick Top-up</div>
              <div className="flex flex-wrap gap-2 mb-3">
                {[10, 50, 100].map((amt) => (
                  <Button 
                    key={amt} 
                    variant="outline" 
                    onClick={() => topup(amt)} 
                    disabled={loading}
                    className="flex-1 min-w-[100px]"
                  >
                    <PlusCircle className="h-4 w-4 mr-1" /> 
                    Add {amt}
                    <span className="ml-1 text-xs text-muted-foreground">(₹{amt * 10})</span>
                  </Button>
                ))}
              </div>
              <div className="text-xs text-gray-500">
                Rate: ₹10 per credit. Credits are used for quote generation and are non-refundable.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage Statistics</CardTitle>
          <CardDescription>Your credit usage overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">0</div>
              <div className="text-sm text-muted-foreground">Quotes Generated</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">0</div>
              <div className="text-sm text-muted-foreground">Credits Used</div>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-purple-600">0</div>
              <div className="text-sm text-muted-foreground">Credits Purchased</div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Detailed usage history will be available in a future update.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
