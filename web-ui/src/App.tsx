import React, { useEffect, useRef, useState } from 'react';
import './globals.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Sidebar, SidebarHeader, SidebarContent, SidebarItem } from './components/ui/sidebar';
import { Separator } from './components/ui/separator';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthDialog } from './components/auth/AuthDialog';
import { QuoteHistory } from './components/quotes/QuoteHistory';
import { RFQInput } from './components/RFQInput';
import { QuoteOutput } from './components/QuoteOutput';
import { SKUTester } from './components/SKUTester';
import { CreditsPanel } from './components/credits/CreditsPanel';
import { Calculator, FileText, Search, TrendingUp, Menu, Home, Settings, BarChart3, Users, HelpCircle, LogIn, LogOut, History, PlusCircle, CreditCard, Sun, Moon } from 'lucide-react';
import { apiClient } from './services/api';

export interface Quote {
  quote_id: string;
  revision: number;
  created_at: string;
  currency: string;
  lines: QuoteLine[];
  line_items?: Array<{
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
    tax: number;
    freight: number;
    grand_total: number;
  };
  terms: {
    validity_days: number;
    payment_terms: string;
    lead_time_days: number;
  };
}

export interface QuoteLine {
  input_text: string;
  resolved?: {
    sku_code: string;
    material: string;
    uom: string;
    qty_uom: number;
    unit_price: number;
    hsn_code: string;
  };
  amount_before_discount: number;
  amount_after_discount: number;
  line_discount_pct: number;
  tax_pct: number;
  tax_amount: number;
  total: number;
  needs_review: boolean;
  candidates?: Array<{
    sku_code: string;
    description: string;
    score: number;
    reason: string;
  }>;
  explain: {
    family?: string;
    size_match_mm?: number;
    tolerance_ok?: boolean;
    alias_hit?: boolean;
    score?: number;
    assumptions?: string[];
  };
}

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'rfq' | 'sku' | 'quotes' | 'credits'>('dashboard');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      return saved ? JSON.parse(saved) : false;
    } catch { return false; }
  });
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const { user, logout, isAuthenticated, authError, clearAuthError } = useAuth();
  const [credits, setCredits] = useState<number>(0);
  const [creditsLoading, setCreditsLoading] = useState<boolean>(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalQuotes: 0,
    successRate: 0,
    avgProcessingTime: 0,
    activeSKUs: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const { isDark, toggle } = useTheme();
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement | null>(null);
  
  // Checkout handling
  const [checkoutStatus, setCheckoutStatus] = useState<'success' | 'cancel' | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState('');

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'rfq', label: 'RFQ Processor', icon: FileText },
    { id: 'sku', label: 'SKU Tester', icon: Search },
    { id: 'credits', label: 'Credits', icon: CreditCard },
    ...(isAuthenticated ? [{ id: 'quotes', label: 'Quote History', icon: History }] : []),
  ];

  const refreshCredits = async () => {
    if (!isAuthenticated) return;
    
    try {
      setCreditsLoading(true);
      // Use the authenticated user's ID instead of hardcoded 'WEB-USER'
      const buyerId = user?.id || 'WEB-USER';
      const res = await apiClient.getCredits(buyerId);
      setCredits(res.credits || 0);
    } catch (e) {
      console.error('Failed to fetch credits:', e);
    } finally {
      setCreditsLoading(false);
    }
  };

  const refreshDashboardStats = async () => {
    if (!isAuthenticated) {
      setStatsLoading(false);
      return;
    }
    
    try {
      setStatsLoading(true);
      const stats = await apiClient.getDashboardStats();
      setDashboardStats(stats);
    } catch (e) {
      console.error('Failed to fetch dashboard stats:', e);
      // Set fallback stats on error
      setDashboardStats({
        totalQuotes: 0,
        successRate: 0,
        avgProcessingTime: 0,
        activeSKUs: 0,
      });
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshCredits();
      refreshDashboardStats();
    }
  }, [isAuthenticated, user]);

  // Persist sidebar collapsed state
  useEffect(() => {
    try { localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed)); } catch {}
  }, [sidebarCollapsed]);

  // Handle checkout success/cancel from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkout = urlParams.get('checkout');
    const sessionId = urlParams.get('session_id');

    if (checkout === 'success' && sessionId) {
      setCheckoutStatus('success');
      setCheckoutMessage('Processing payment...');
      
      // Complete the payment
      fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:3000'}/api/credits/purchase/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      })
      .then(response => response.json())
      .then(data => {
        if (data.status === 'completed') {
          setCheckoutMessage('Payment successful! Your credits have been added.');
          refreshCredits(); // Refresh credits display
        } else {
          setCheckoutMessage('Payment verification failed. Please contact support.');
        }
      })
      .catch(() => {
        setCheckoutMessage('Payment verification failed. Please contact support.');
      });

      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (checkout === 'cancel') {
      setCheckoutStatus('cancel');
      setCheckoutMessage('Payment was cancelled. No charges were made.');
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Close avatar menu on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!avatarOpen) return;
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [avatarOpen]);

  // Auth gate: show sign-in landing when not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Pactle</CardTitle>
                <CardDescription>Sign in to access your dashboard</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Welcome back. Please sign in to process RFQs, generate quotes, and manage credits.
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">v1.0.0</Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline" onClick={() => setAuthDialogOpen(true)}>
                    Sign In
                  </Button>
                  <Button size="sm" variant="outline" onClick={toggle} aria-label="Toggle theme">
                    {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <AuthDialog open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar className={`${sidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300`}>
        <SidebarHeader>
          <div
            className={`flex items-center ${sidebarCollapsed ? 'justify-center w-full cursor-pointer' : 'space-x-3'}`}
            onClick={() => {
              if (sidebarCollapsed) setSidebarCollapsed(false);
            }}
          >
            <div
              className="bg-blue-600 p-2 rounded-lg transition-transform hover:scale-105 active:scale-95"
              title={sidebarCollapsed ? 'Expand sidebar' : undefined}
            >
              <Calculator className="h-5 w-5 text-white" />
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-lg font-bold">Pactle</h1>
                <p className="text-xs text-muted-foreground">Quote Generator</p>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="ml-auto"
              aria-label="Collapse sidebar"
            >
              <Menu className="h-4 w-4" />
            </Button>
          )}
        </SidebarHeader>

        <SidebarContent>
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <SidebarItem
                  key={item.id}
                  active={activeTab === item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  title={item.label}
                  className={sidebarCollapsed ? 'justify-center px-2' : ''}
                >
                  <IconComponent className="h-4 w-4" />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </SidebarItem>
              );
            })}
          </div>

          <Separator className="my-4" />

          <div className="space-y-1">
            <SidebarItem className={sidebarCollapsed ? 'justify-center px-2' : ''}>
              <BarChart3 className="h-4 w-4" />
              {!sidebarCollapsed && <span>Analytics</span>}
            </SidebarItem>
            <SidebarItem className={sidebarCollapsed ? 'justify-center px-2' : ''}>
              <Users className="h-4 w-4" />
              {!sidebarCollapsed && <span>Team</span>}
            </SidebarItem>
            <SidebarItem className={sidebarCollapsed ? 'justify-center px-2' : ''}>
              <Settings className="h-4 w-4" />
              {!sidebarCollapsed && <span>Settings</span>}
            </SidebarItem>
          </div>

          <div className="mt-auto space-y-1">
            <SidebarItem className={sidebarCollapsed ? 'justify-center px-2' : ''}>
              <HelpCircle className="h-4 w-4" />
              {!sidebarCollapsed && <span>Help</span>}
            </SidebarItem>
          </div>
        </SidebarContent>
      </Sidebar>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-card border-b border-border px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'rfq' && 'RFQ Processor'}
                {activeTab === 'sku' && 'SKU Tester'}
                {activeTab === 'quotes' && 'Quote History'}
                {activeTab === 'credits' && 'Credits'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {activeTab === 'dashboard' && 'Overview of your quote generation system'}
                {activeTab === 'rfq' && 'Upload your RFQ in various formats to generate accurate quotes'}
                {activeTab === 'sku' && 'Test SKU matching accuracy with product descriptions'}
                {activeTab === 'quotes' && 'View and manage your generated quotes'}
                {activeTab === 'credits' && 'Manage credits for quote generation'}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                size="sm"
                variant="outline"
                onClick={toggle}
                aria-label="Toggle theme"
              >
                {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Badge variant="outline" className="text-xs">
                Credits: {creditsLoading ? '...' : credits}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const cost = 10 * 10; // 10 INR per credit
                    const session = await apiClient.createCreditsSession(10, cost);
                    
                    if (session.checkout_url) {
                      window.location.href = session.checkout_url;
                    } else {
                      console.error('No checkout URL received from server');
                    }
                  } catch (error) {
                    console.error('Failed to create checkout session:', error);
                  }
                }}
              >
                <PlusCircle className="h-4 w-4 mr-1" /> Buy 10 Credits (₹100)
              </Button>
              {/* Avatar menu with outside click */}
              <div className="relative" ref={avatarRef}>
                <button
                  className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium transition-transform hover:scale-105 active:scale-95"
                  onClick={() => setAvatarOpen((v) => !v)}
                  aria-label="User menu"
                  title={user?.email || 'Account'}
                >
                  {(user?.name || user?.email || 'U').slice(0,1).toUpperCase()}
                </button>
                {avatarOpen && (
                  <div className="absolute right-0 mt-2 w-44 rounded-md border border-border bg-card shadow-md z-50">
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setActiveTab('credits'); setAvatarOpen(false); }}>Credits</button>
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setActiveTab('dashboard'); setAvatarOpen(false); }}>Profile</button>
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { setAvatarOpen(false); logout(); }}>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
              <Badge variant="secondary" className="text-xs">v1.0.0</Badge>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Dashboard Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Quotes</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {statsLoading ? '...' : (dashboardStats.totalQuotes || 0).toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">Generated by you</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {statsLoading ? '...' : `${(dashboardStats.successRate || 0).toFixed(1)}%`}
                    </div>
                    <p className="text-xs text-muted-foreground">SKU mapping accuracy</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Processing</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {statsLoading ? '...' : `${(dashboardStats.avgProcessingTime || 0).toFixed(1)}s`}
                    </div>
                    <p className="text-xs text-muted-foreground">Per quote generation</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active SKUs</CardTitle>
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {statsLoading ? '...' : (dashboardStats.activeSKUs || 0).toLocaleString()}
                    </div>
                    <p className="text-xs text-muted-foreground">In product catalog</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Start</CardTitle>
                  <CardDescription>Get productive in minutes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-6">
                      <Button onClick={() => setActiveTab('rfq')} className="w-full h-20 flex items-center justify-center space-x-2">
                        <FileText className="h-6 w-6" />
                        <span>Process RFQ</span>
                      </Button>
                      <div className="mt-2 text-xs text-muted-foreground text-center">
                        or
                        <button
                          className="ml-1 underline"
                          onClick={() => {
                            try {
                              localStorage.setItem('rfqTrySample', JSON.stringify({ type: 'csv' }));
                            } catch {}
                            setActiveTab('rfq');
                          }}
                        >
                          Try a sample RFQ
                        </button>
                      </div>
                    </div>
                    <div className="lg:col-span-3">
                      <Button onClick={() => setActiveTab('sku')} variant="outline" className="w-full h-20 flex items-center justify-center space-x-2">
                        <Search className="h-6 w-6" />
                        <span>Test SKU</span>
                      </Button>
                    </div>
                    <div className="lg:col-span-3">
                      {isAuthenticated && (
                        <Button onClick={() => setActiveTab('quotes')} variant="outline" className="w-full h-20 flex items-center justify-center space-x-2">
                          <History className="h-6 w-6" />
                          <span>History</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Timeline steps */}
                  <div className="mt-6">
                    <ol className="relative border-l border-border pl-6 space-y-4">
                      <li>
                        <div className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-primary"></div>
                        <div className="text-sm font-medium">Sign in</div>
                        <div className="text-sm text-muted-foreground">Create an account or sign in to save runs and access history.</div>
                      </li>
                      <li>
                        <div className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-primary"></div>
                        <div className="text-sm font-medium">Upload or paste RFQ</div>
                        <div className="text-sm text-muted-foreground">Choose Email, Chat, or CSV. Upload a file or paste content.</div>
                      </li>
                      <li>
                        <div className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-primary"></div>
                        <div className="text-sm font-medium">Generate & manage credits</div>
                        <div className="text-sm text-muted-foreground">Generate the quote, download PDF, and top up credits anytime.</div>
                      </li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}


          {activeTab === 'rfq' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Process RFQ</CardTitle>
                  <CardDescription>Accepts Email text, Chat message, or CSV upload</CardDescription>
                </CardHeader>
                <CardContent>
                  <RFQInput
                    setQuote={setQuote}
                    setLoading={setLoading}
                    onCreditsChanged={refreshCredits}
                    onInsufficientCredits={() => {
                      // Surface that credits are low and switch to RFQ tab if needed
                      setActiveTab('rfq');
                    }}
                  />
                </CardContent>
              </Card>

              {quote && (
                <Card>
                  <QuoteOutput quote={quote} loading={loading} />
                </Card>
              )}
            </div>
          )}
          {activeTab === 'sku' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>SKU Mapping Tester</CardTitle>
                  <CardDescription>
                    Test SKU matching accuracy with product descriptions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SKUTester />
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'quotes' && isAuthenticated && (
            <QuoteHistory />
          )}

          {activeTab === 'credits' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Credits</CardTitle>
                  <CardDescription>Top-up and manage your credits</CardDescription>
                </CardHeader>
                <CardContent>
                  <CreditsPanel />
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      <AuthDialog
        open={authDialogOpen}
        onOpenChange={setAuthDialogOpen}
      />

      {/* Checkout Status Dialog */}
      {checkoutStatus && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2">
                {checkoutStatus === 'success' ? (
                  <>
                    Payment Successful
                  </>
                ) : (
                  <>
                    <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-sm font-bold">!</div>
                    Payment Cancelled
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-gray-600">{checkoutMessage}</p>
              <Button 
                onClick={() => setCheckoutStatus(null)} 
                className="w-full"
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Auth Error Dialog */}
      {authError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-red-600">
                <div className="h-6 w-6 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-sm font-bold">!</div>
                Authentication Error
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-gray-600">{authError}</p>
              <Button 
                onClick={() => {
                  clearAuthError();
                  setAuthDialogOpen(true);
                }} 
                className="w-full"
              >
                Sign In Again
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
