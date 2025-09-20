import React, { useState, useCallback, useEffect } from 'react';
import { getApiUrl, apiConfig } from '../config/api';
import { Quote } from '../App';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api';
import { Mail, MessageSquare, FileSpreadsheet, Rocket, FileText, Upload, Download, CheckCircle, X, AlertCircle } from 'lucide-react';

interface RFQInputProps {
  setQuote: (quote: Quote | null) => void;
  setLoading: (loading: boolean) => void;
  onCreditsChanged?: () => void;
  onInsufficientCredits?: () => void;
}


export const RFQInput: React.FC<RFQInputProps> = ({ setQuote, setLoading, onCreditsChanged, onInsufficientCredits }) => {
  const [inputType, setInputType] = useState<'email' | 'chat' | 'csv'>('csv');
  const [emailText, setEmailText] = useState('');
  const [chatMessage, setChatMessage] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState<string>('');
  // Per-type state maps
  const [processingResultsByType, setProcessingResultsByType] = useState<Record<'email'|'chat'|'csv', any>>({ email: null, chat: null, csv: null });
  const [mappingResultsByType, setMappingResultsByType] = useState<Record<'email'|'chat'|'csv', any>>({ email: null, chat: null, csv: null });
  const [runIdByType, setRunIdByType] = useState<Record<'email'|'chat'|'csv', string | null>>({ email: null, chat: null, csv: null });
  const [quoteIdByType, setQuoteIdByType] = useState<Record<'email'|'chat'|'csv', string | null>>({ email: null, chat: null, csv: null });
  const [processingStepByType, setProcessingStepByType] = useState<Record<'email'|'chat'|'csv', 'idle' | 'parsing' | 'mapping' | 'quote' | 'complete'>>({ email: 'idle', chat: 'idle', csv: 'idle' });
  const [quotesByType, setQuotesByType] = useState<Record<'email'|'chat'|'csv', Quote | null>>({ email: null, chat: null, csv: null });
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [availableSchemas, setAvailableSchemas] = useState<any>({});
  const { token, user } = useAuth();
  const [insufficientCredits, setInsufficientCredits] = useState(false);
  const [topupLoading, setTopupLoading] = useState(false);
  const [headerDiscountPct, setHeaderDiscountPct] = useState<number>(0);
  const [freightTaxable, setFreightTaxable] = useState<boolean>(true);
  const [historyByType, setHistoryByType] = useState<Record<'email'|'chat'|'csv', Array<{ quote_id: string; timestamp: string }>>>({ email: [], chat: [], csv: [] });
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Persistence helpers
  useEffect(() => {
    // By default, do NOT auto-prefill inputs. Only load saved inputs if explicitly opted-in.
    try {
      const remember = localStorage.getItem('rfqRemember') === 'true';
      if (remember) {
        const savedInputs = JSON.parse(localStorage.getItem('rfqInputs') || '{}');
        if (typeof savedInputs.email === 'string') setEmailText(savedInputs.email);
        if (typeof savedInputs.chat === 'string') setChatMessage(savedInputs.chat);
        if (typeof savedInputs.csv === 'string') setCsvContent(savedInputs.csv);
      }
    } catch {}
    // Do not auto-load sample data unless explicitly allowed by a flag
    try {
      const allowPrefill = localStorage.getItem('rfqAllowPrefill') === 'true';
      if (allowPrefill) {
        const trySample = JSON.parse(localStorage.getItem('rfqTrySample') || 'null');
        if (trySample?.type === 'csv' || trySample?.type === 'email' || trySample?.type === 'chat') {
          setInputType(trySample.type);
          const map: Record<string, string> = { email: sampleData.email, chat: sampleData.chat, csv: sampleData.csv } as any;
          if (trySample.type === 'email') setEmailText(map.email);
          if (trySample.type === 'chat') setChatMessage(map.chat);
          if (trySample.type === 'csv') setCsvContent(map.csv);
          localStorage.removeItem('rfqTrySample');
        }
      }
    } catch {}
    try {
      const savedHist = JSON.parse(localStorage.getItem('rfqHistory') || '{}');
      setHistoryByType((prev) => ({
        email: Array.isArray(savedHist.email) ? savedHist.email : prev.email,
        chat: Array.isArray(savedHist.chat) ? savedHist.chat : prev.chat,
        csv: Array.isArray(savedHist.csv) ? savedHist.csv : prev.csv,
      }));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('rfqInputs', JSON.stringify({ email: emailText, chat: chatMessage, csv: csvContent }));
    } catch {}
  }, [emailText, chatMessage, csvContent]);

  const sampleData = {
    email: `Need quotation for: 16 mm corrugated PP – 500 m; 25mm FR 300 m; 32 mm – 10 coils grey; GI fan box 3" medium octagonal with 18" rod – 40 pcs; PVC conduit 20mm Medium – 900 m; PG13.5 nylon glands – 200 nos; Cable ties 200x4.8 – 10 packs.`,
    chat: `need 3" hex cpwd fan box 25 nos, 40mm corr pipe FR 150m, 25mm flex conduit light 300m, msb 6M box 50pcs`,
    csv: `Item,Desc,Qty,UOM
1,Flexible conduit 25 mm black,200,M
2,GI FAN BOX MED OCT 14in rod,30,PC
3,Corr Pipe 16-mm PP,1200,M
4,PVC conduit 33mm medium,100,M
5,PG21 nylon gland,50,PC`
  };

  // Open confirmation dialog then run
  const processRFQ = () => {
    setConfirmOpen(true);
  };

  const loadSample = () => {
    switch (inputType) {
      case 'email':
        setEmailText(sampleData.email);
        break;
      case 'chat':
        setChatMessage(sampleData.chat);
        break;
      case 'csv':
        setCsvContent(sampleData.csv);
        break;
    }
  };

  const handleFileSelect = useCallback((file: File) => {
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      // 10MB guard to match backend limit
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('File is too large. Please upload a file smaller than 10MB.');
        return;
      }
      setSelectedFile(file);
      setFileName(file.name);

      // Read file content for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setCsvContent(content.slice(0, 1000)); // Show first 1000 chars as preview
      };
      reader.readAsText(file);
    } else {
      alert('Please select a valid CSV or TXT file');
    }
  }, []);

  const handleInputFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  const clearFile = () => {
    setSelectedFile(null);
    setFileName('');
    setCsvContent('');
    // Clear current type processing states when file is removed
    setProcessingResultsByType(prev => ({ ...prev, [inputType]: null }));
    setMappingResultsByType(prev => ({ ...prev, [inputType]: null }));
    setRunIdByType(prev => ({ ...prev, [inputType]: null }));
    setQuoteIdByType(prev => ({ ...prev, [inputType]: null }));
    setProcessingStepByType(prev => ({ ...prev, [inputType]: 'idle' }));
    setQuotesByType(prev => ({ ...prev, [inputType]: null }));
    setUploadProgress(0);
    setQuote(null);
    setLoading(false);
  };

  const resetForm = () => {
    setSelectedFile(null);
    setFileName('');
    setEmailText('');
    setChatMessage('');
    setCsvContent('');
    setProcessingResultsByType({ email: null, chat: null, csv: null });
    setMappingResultsByType({ email: null, chat: null, csv: null });
    setRunIdByType({ email: null, chat: null, csv: null });
    setQuoteIdByType({ email: null, chat: null, csv: null });
    setProcessingStepByType({ email: 'idle', chat: 'idle', csv: 'idle' });
    setQuotesByType({ email: null, chat: null, csv: null });
    setUploadProgress(0);
    setQuote(null);
  };

  // Core generation (no UI confirmations)
  const processRFQCore = async () => {
    if (!getCurrentInput().trim() && !selectedFile) {
      alert('Please provide RFQ content or upload a file');
      return;
    }

    setLoading(true);
    setQuote(null);
    setRunIdByType(prev => ({ ...prev, [inputType]: null }));
    setQuoteIdByType(prev => ({ ...prev, [inputType]: null }));
    setUploadProgress(0);

    try {
      // Step 1: Parse RFQ
      setProcessingStepByType(prev => ({ ...prev, [inputType]: 'parsing' }));
      setUploadProgress(25);
      const parseResponse = await parseRFQ();
      const runId = parseResponse.data.run_id;
      setRunIdByType(prev => ({ ...prev, [inputType]: runId }));
      setProcessingResultsByType(prev => ({ ...prev, [inputType]: parseResponse.data }));

      // Step 2: Map SKUs
      setProcessingStepByType(prev => ({ ...prev, [inputType]: 'mapping' }));
      setUploadProgress(50);
      const mappingResponse = await mapSKUs(runId);
      setMappingResultsByType(prev => ({ ...prev, [inputType]: mappingResponse.data }));

      // Step 3: Create Quote
      setProcessingStepByType(prev => ({ ...prev, [inputType]: 'quote' }));
      setUploadProgress(75);
      const quoteResponse = await createQuote(runId);
      setQuoteIdByType(prev => ({ ...prev, [inputType]: quoteResponse.data.quote_id }));
      setQuotesByType(prev => ({ ...prev, [inputType]: quoteResponse.data }));
      setQuote(quoteResponse.data);
      // Update local history
      setHistoryByType(prev => {
        const updated = { ...prev };
        const list = [{ quote_id: quoteResponse.data.quote_id, timestamp: new Date().toISOString() }, ...updated[inputType]]
          .slice(0, 5);
        updated[inputType] = list;
        try { localStorage.setItem('rfqHistory', JSON.stringify(updated)); } catch {}
        return updated;
      });
      // Refresh credits after a successful generation (deduction happens server-side)
      onCreditsChanged?.();
      // Defensive: trigger a delayed refresh to avoid any race with backend write timing
      setTimeout(() => {
        try { onCreditsChanged?.(); } catch {}
      }, 300);

      setProcessingStepByType(prev => ({ ...prev, [inputType]: 'complete' }));
      setUploadProgress(100);
    } catch (error: any) {
      console.error('Error processing RFQ:', error);
      if (error?.__insufficientCredits) {
        setInsufficientCredits(true);
        onInsufficientCredits?.();
      } else {
        alert(`Error: ${error.response?.data?.error || error.message}`);
      }
      setProcessingStepByType(prev => ({ ...prev, [inputType]: 'idle' }));
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const parseRFQ = async () => {
    const formData = new FormData();

    if (inputType === 'csv' && selectedFile) {
      // Use actual uploaded file
      formData.append('file', selectedFile);
    } else {
      // Create text file from input content
      const content = getCurrentInput().trim();
      if (!content) {
        throw new Error('Please provide content for the RFQ');
      }

      const blob = new Blob([content], { type: 'text/plain' });
      const fileName = inputType === 'email' ? 'rfq.eml' :
                     inputType === 'chat' ? 'rfq-chat.txt' : 'rfq.csv';
      formData.append('file', blob, fileName);
    }

    // Add metadata - use authenticated user
    const buyerId = user?.id || 'WEB-USER';
    const buyerName = user?.name || user?.email || 'Web User';
    formData.append('buyer_id', buyerId);
    formData.append('buyer_name', buyerName);
    formData.append('type', inputType);

    // Add schema if specified
    if (selectedSchema) {
      formData.append('schema', selectedSchema);
    }

    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Retry once for transient timeouts/gateway errors
    const doRequest = async (): Promise<Response> => {
      const resp = await fetch(getApiUrl(apiConfig.endpoints.rfq.parse), {
        method: 'POST',
        headers,
        body: formData
      });
      return resp;
    };

    let response = await doRequest();
    if (!response.ok && [408, 504, 502].includes(response.status)) {
      // small backoff and retry once
      await new Promise(r => setTimeout(r, 500));
      response = await doRequest();
    }

    if (!response.ok) {
      // attempt to parse json; fallback to text
      let errMsg = 'Parse failed';
      try {
        const error = await response.json();
        errMsg = error.error || errMsg;
      } catch {
        try { errMsg = await response.text(); } catch {}
      }
      throw new Error(errMsg);
    }

    return { data: await response.json() };
  };

  const mapSKUs = async (runId: string) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(getApiUrl(apiConfig.endpoints.rfq.map.replace(':runId', runId)), {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Mapping failed');
    }

    return { data: await response.json() };
  };

  const createQuote = async (runId: string) => {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(getApiUrl(apiConfig.endpoints.quotes.create), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        run_id: runId,
        header_discount_pct: headerDiscountPct,
        freight_taxable: freightTaxable,
        buyer: {
          buyer_id: user?.id || 'WEB-USER',
          name: user?.name || user?.email || 'Web User'
        }
      })
    });

    if (!response.ok) {
      if (response.status === 402) {
        const error = new Error('Insufficient credits');
        // mark for upstream handling
        (error as any).__insufficientCredits = true;
        throw error;
      }
      const error = await response.json();
      throw new Error(error.error || 'Quote creation failed');
    }

    return { data: await response.json() };
  };

  const downloadPDF = async () => {
    const currentQuoteId = quoteIdByType[inputType];
    const currentQuote = quotesByType[inputType];
    if (!currentQuoteId) {
      console.error('No quote ID available for PDF download');
      alert('No quote available to download');
      return;
    }

    // Guard: ensure there are line items to export
    if (!currentQuote || !currentQuote.line_items || currentQuote.line_items.length === 0) {
      alert('This quote has no line items to export. Please review your RFQ or mapping settings and generate the quote again.');
      return;
    }

    try {
      console.log('Starting PDF download for quote:', currentQuoteId);
      
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        console.log('Using auth token for PDF download');
      } else {
        console.warn('No auth token available for PDF download');
      }

      const pdfUrl = getApiUrl(apiConfig.endpoints.quotes.pdf.replace(':quoteId', currentQuoteId));
      console.log('PDF URL:', pdfUrl);

      const response = await fetch(pdfUrl, { headers });
      console.log('PDF response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('PDF download failed:', errorText);
        throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      console.log('PDF blob size:', blob.size, 'bytes');
      
      if (blob.size === 0) {
        throw new Error('PDF file is empty');
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `quote-${currentQuoteId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      console.log('PDF download completed successfully');
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      alert(`Failed to download PDF: ${error.message || 'Unknown error'}`);
    }
  };

  const getCurrentInput = () => {
    switch (inputType) {
      case 'email':
        return emailText;
      case 'chat':
        return chatMessage;
      case 'csv':
        return csvContent;
    }
  };

  const setCurrentInput = (value: string) => {
    switch (inputType) {
      case 'email':
        setEmailText(value);
        break;
      case 'chat':
        setChatMessage(value);
        break;
      case 'csv':
        setCsvContent(value);
        break;
    }
  };

  const inputTypeConfig = {
    email: { icon: Mail, label: 'Email', description: 'Process email RFQ content' },
    chat: { icon: MessageSquare, label: 'Chat', description: 'Process chat message' },
    csv: { icon: FileSpreadsheet, label: 'CSV', description: 'Process structured CSV data' }
  };

  // Build modern two-column layout
  const LeftPanel = (
    <div className="space-y-6">
      {/* Input Type Selection */}
      <div>
        <label className="text-sm font-medium mb-3 block">Select Input Type:</label>
        <div className="flex space-x-2">
          {Object.entries(inputTypeConfig).map(([type, config]) => {
            const IconComponent = config.icon;
            return (
              <Button
                key={type}
                variant={inputType === type ? 'default' : 'outline'}
                onClick={() => {
                  const t = type as 'email' | 'chat' | 'csv';
                  setInputType(t);
                  setQuote(quotesByType[t] ?? null);
                }}
                className="flex-1"
              >
                <IconComponent className="mr-2 h-4 w-4" />
                {config.label}
              </Button>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground mt-2">{inputTypeConfig[inputType].description}</p>
      </div>

      {/* Insufficient Credits Banner */}
      {insufficientCredits && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium text-amber-800">You have insufficient credits to generate a quote.</p>
                  <p className="text-xs text-amber-700">Add credits and try again.</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" disabled={topupLoading} onClick={async () => {
                  try { 
                    setTopupLoading(true); 
                    console.log('Starting Stripe checkout for credit purchase...', { user: user?.id });
                    
                    if (!user?.id) {
                      alert('Please sign in first to purchase credits');
                      return;
                    }
                    
                    const buyerId = user.id;
                    console.log('Creating Stripe checkout session for:', buyerId);
                    
                    // Try to create Stripe checkout session first
                    try {
                      const session = await fetch(getApiUrl('/api/credits/purchase/session'), {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                          credits_to_add: 10,
                          amount: 100, // ₹100 for 10 credits
                          currency: 'INR'
                        })
                      });
                      
                      if (!session.ok) {
                        const error = await session.json();
                        throw new Error(error.error || 'Failed to create checkout session');
                      }
                      
                      const sessionData = await session.json();
                      console.log('Payment session created:', sessionData.session_id);
                      
                      // Check if it's a Stripe checkout URL or mock checkout
                      if (sessionData.checkout_url) {
                        if (sessionData.checkout_url.includes('stripe.com') || sessionData.checkout_url.includes('checkout.stripe.com')) {
                          console.log('Redirecting to Stripe checkout...');
                          window.location.href = sessionData.checkout_url;
                        } else {
                          // Mock checkout - directly add credits for development
                          console.log('Using mock payment (development mode)');
                          const result = await apiClient.purchaseCredits(buyerId, 10, 100);
                          console.log('Credits added directly:', result);
                          
                          setInsufficientCredits(false);
                          onCreditsChanged?.();
                          alert('Development mode: 10 credits added successfully!');
                        }
                      } else {
                        throw new Error('No checkout URL received');
                      }
                    } catch (sessionError) {
                      console.log('Session creation failed, trying direct credit purchase:', sessionError);
                      
                      // Fallback: Direct credit purchase
                      const result = await apiClient.purchaseCredits(buyerId, 10, 100);
                      console.log('Direct credit purchase result:', result);
                      
                      setInsufficientCredits(false);
                      onCreditsChanged?.();
                      alert('Credits added successfully! (Direct purchase)');
                    }
                  }
                  catch (error: any) { 
                    console.error('Stripe checkout creation failed:', error);
                    alert(`Failed to start payment: ${error.message || 'Unknown error'}`); 
                  } 
                  finally { setTopupLoading(false); }
                }}>{topupLoading ? 'Creating Payment...' : 'Buy 10 Credits (₹100)'}</Button>
                <Button onClick={() => { setInsufficientCredits(false); processRFQ(); }} disabled={topupLoading}>Retry</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Parse Warnings */}
      {processingResultsByType[inputType]?.warnings?.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Parsing Warnings</span>
            </CardTitle>
            <CardDescription className="text-amber-700">Some issues were detected while reading your RFQ</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm text-amber-800 space-y-1">
              {processingResultsByType[inputType].warnings.map((w: string, idx: number) => (
                <li key={`warn-${idx}`}>{w}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Input Area */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium">
            {inputType === 'email' && 'Email Content'}
            {inputType === 'chat' && 'Chat Message'}
            {inputType === 'csv' && (selectedFile ? 'CSV File' : 'CSV Data')}
          </label>
          <Badge variant="secondary" className="text-xs">{inputType.toUpperCase()}</Badge>
        </div>

        {inputType === 'csv' && (
          <div className="mb-4">
            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <input type="file" accept=".csv,.txt" onChange={handleInputFileChange} className="hidden" id="file-upload" />
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                      dragActive ? 'border-blue-400 bg-muted' : selectedFile ? 'border-green-400 bg-green-50' : 'border-border bg-muted hover:brightness-95'
                    }`}
                    onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
                  >
                    {selectedFile ? (
                      <div className="text-center">
                        <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
                        <div className="text-lg font-medium text-green-800 mb-2">{fileName}</div>
                        <div className="text-sm text-green-600 mb-4">File uploaded successfully • {(selectedFile.size / 1024).toFixed(1)} KB</div>
                        <div className="flex justify-center space-x-2">
                          <Button variant="outline" size="sm" onClick={clearFile} className="text-red-600 border-red-300 hover:bg-red-50"><X className="mr-1 h-4 w-4" />Remove</Button>
                          <label htmlFor="file-upload"><Button variant="outline" size="sm" className="cursor-pointer"><Upload className="mr-1 h-4 w-4" />Change File</Button></label>
                        </div>
                      </div>
                    ) : (
                      <label htmlFor="file-upload" className="cursor-pointer block">
                        <div className="text-center">
                          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                          <div className="text-lg font-medium mb-2">Drop your CSV file here, or click to browse</div>
                          <div className="text-sm text-muted-foreground">Supports .csv and .txt files up to 10MB</div>
                        </div>
                      </label>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-sm"><span className="px-2 bg-card text-muted-foreground">or enter data manually</span></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Textarea
          value={getCurrentInput()}
          onChange={(e) => setCurrentInput(e.target.value)}
          placeholder={inputType === 'email' ? 'Enter email text with RFQ details...' : inputType === 'chat' ? 'Enter informal chat message...' : 'Enter CSV data with headers (description,quantity,unit,notes)...'}
          rows={inputType === 'csv' ? 8 : 6}
          className="font-mono text-sm"
        />
      </div>

      {/* Quote Options */}
      <Card>
        <CardHeader>
          <CardTitle>Quote Options</CardTitle>
          <CardDescription>Configure discount and freight taxation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Header Discount (%)</label>
              <input type="number" min={0} max={100} step={0.5} value={headerDiscountPct} onChange={(e) => setHeaderDiscountPct(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" placeholder="e.g. 2.5" />
            </div>
            <div className="flex items-end">
              <label className="inline-flex items-center space-x-2">
                <input type="checkbox" checked={freightTaxable} onChange={(e) => setFreightTaxable(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-sm">Freight is taxable</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={processRFQ} disabled={(!getCurrentInput().trim() && !selectedFile) || ['parsing','mapping','quote'].includes(processingStepByType[inputType])} className="flex-1 min-w-[180px]">
          <Rocket className="mr-2 h-4 w-4" />
          {processingStepByType[inputType] === 'idle' ? 'Generate Quote' : processingStepByType[inputType] === 'complete' ? 'Generate Again' : 'Processing...'}
        </Button>
        <Button variant="outline" onClick={loadSample} disabled={processingStepByType[inputType] !== 'idle'}>
          <FileText className="mr-2 h-4 w-4" />
          Load Sample
        </Button>
        {quoteIdByType[inputType] && (quotesByType[inputType]?.line_items?.length || 0) > 0 && (
          <Button variant="outline" onClick={downloadPDF}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        )}
        {(processingResultsByType[inputType] || mappingResultsByType[inputType] || quoteIdByType[inputType]) && (
          <Button variant="outline" onClick={resetForm} className="text-muted-foreground">
            <X className="mr-2 h-4 w-4" />
            Reset
          </Button>
        )}
      </div>

      {!token && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">Authentication Required</p>
                <p className="text-xs text-amber-700">Please sign in to process RFQs and generate quotes.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm credit usage dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Use 1 credit to generate quote?</DialogTitle>
            <DialogDescription>
              Generating a quote will deduct 1 credit from your account. Do you want to continue?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={async () => { setConfirmOpen(false); await processRFQCore(); }}>Continue</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  const RightPanel = (
    <div className="space-y-6">
      {/* Processing Status */}
      {processingStepByType[inputType] !== 'idle' && (
        <Card className={`border-2 ${processingStepByType[inputType] === 'complete' ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {processingStepByType[inputType] === 'complete' ? (<CheckCircle className="h-6 w-6 text-green-600" />) : (<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>)}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${processingStepByType[inputType] === 'complete' ? 'text-green-800' : 'text-blue-800'}`}>
                    {processingStepByType[inputType] === 'parsing' && 'Parsing RFQ...'}
                    {processingStepByType[inputType] === 'mapping' && 'Mapping SKUs...'}
                    {processingStepByType[inputType] === 'quote' && 'Generating Quote...'}
                    {processingStepByType[inputType] === 'complete' && 'Quote Generated Successfully!'}
                  </p>
                  <p className={`text-xs ${processingStepByType[inputType] === 'complete' ? 'text-green-600' : 'text-blue-600'}`}>
                    {processingStepByType[inputType] === 'parsing' && 'Analyzing your requirements and extracting line items'}
                    {processingStepByType[inputType] === 'mapping' && 'Finding matching products in our catalog'}
                    {processingStepByType[inputType] === 'quote' && 'Calculating pricing, taxes, and totals'}
                    {processingStepByType[inputType] === 'complete' && 'Your quote is ready for review and download'}
                  </p>
                </div>
                <div className="text-sm font-medium text-muted-foreground">{uploadProgress}%</div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className={`h-2 rounded-full transition-all duration-500 ${processingStepByType[inputType] === 'complete' ? 'bg-green-600' : 'bg-blue-600'}`} style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className={processingStepByType[inputType] === 'parsing' || uploadProgress >= 25 ? 'text-blue-600 font-medium' : ''}>Parse</span>
                <span className={processingStepByType[inputType] === 'mapping' || uploadProgress >= 50 ? 'text-blue-600 font-medium' : ''}>Map</span>
                <span className={processingStepByType[inputType] === 'quote' || uploadProgress >= 75 ? 'text-blue-600 font-medium' : ''}>Quote</span>
                <span className={processingStepByType[inputType] === 'complete' ? 'text-green-600 font-medium' : ''}>Complete</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mapping Results */}
      {mappingResultsByType[inputType] && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800 flex items-center space-x-2"><CheckCircle className="h-5 w-5" /><span>Mapping Results</span></CardTitle>
            <CardDescription className="text-green-600">SKU mapping completed for all line items</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center"><div className="text-2xl font-bold text-green-600">{mappingResultsByType[inputType].mapped_lines?.filter((line: any) => line.mapping_result?.status === 'auto_mapped').length || 0}</div><div className="text-sm text-green-700">Auto Mapped</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-yellow-600">{mappingResultsByType[inputType].mapped_lines?.filter((line: any) => line.mapping_result?.status === 'needs_review').length || 0}</div><div className="text-sm text-muted-foreground">Needs Review</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-red-600">{mappingResultsByType[inputType].mapped_lines?.filter((line: any) => line.mapping_result?.status === 'failed').length || 0}</div><div className="text-sm text-muted-foreground">Failed</div></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Quotes (per channel) */}
      {historyByType[inputType]?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent {inputType.toUpperCase()} Quotes</CardTitle>
            <CardDescription>Quick access to your last few runs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {historyByType[inputType].map((h, idx) => (
                <div key={`hist-${inputType}-${idx}`} className="flex items-center justify-between">
                  <div className="text-muted-foreground">#{h.quote_id} • {new Date(h.timestamp).toLocaleString()}</div>
                  <div className="space-x-2">
                    <Button size="sm" variant="outline" onClick={() => { setQuoteIdByType(prev => ({ ...prev, [inputType]: h.quote_id })); setQuote(quotesByType[inputType] ?? null); }}>View</Button>
                    <Button size="sm" variant="outline" onClick={async () => { const prevId = quoteIdByType[inputType]; setQuoteIdByType(prev => ({ ...prev, [inputType]: h.quote_id })); await downloadPDF(); setQuoteIdByType(prev => ({ ...prev, [inputType]: prevId || null })); }}>PDF</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7">{LeftPanel}</div>
      <div className="lg:col-span-5">{RightPanel}</div>
    </div>
  );
}
;
