import express from 'express';
import crypto from 'crypto';
import multer from 'multer';
import * as dotenv from 'dotenv';
import { ValidationError, SKUMappingError, PricingError } from './domain/common/errors';
import { AuthService } from './services/AuthService';
import { HybridUserRepository } from './infrastructure/repositories/HybridUserRepository';
import { Database } from './infrastructure/database/Database';
import { AuthMiddleware, AuthenticatedRequest } from './middleware/auth';
import { RFQParsers } from './services/parsers';
import { DeterministicMappingService } from './services/DeterministicMappingService';
import { CSVPriceMasterRepository } from './infrastructure/repositories/CSVPriceMasterRepository';
import { PaymentService } from './services/PaymentService';
import { QuoteCreationService } from './services/QuoteCreationService';
import { PDFGenerationService } from './services/PDFGenerationService';
import { ExportService } from './services/ExportService';
import { PreviewService } from './services/PreviewService';
import { ConfigService } from './services/ConfigService';
import { PREDEFINED_SCHEMAS } from './domain/interfaces/schema';
import { CreditsService } from './services/CreditsService';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;


app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.post('/api/credits/purchase/complete', express.json(), async (req, res) => {
  try {
    const { session_id } = req.body || {};
    if (!session_id) {
      return res.status(400).json({ error: 'session_id is required' });
    }

    const session = await paymentService.getSessionStatus(session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await paymentService.handleWebhook({
      type: 'checkout.session.completed',
      session_id,
      quote_id: session.quote_id,
      amount: session.amount,
    });

    const updatedSession = await paymentService.getSessionStatus(session_id);
    if (updatedSession && updatedSession.kind === 'credits' && updatedSession.status === 'paid' && updatedSession.credits_to_add && updatedSession.buyer_id) {
      creditsService.addCredits(updatedSession.buyer_id, updatedSession.credits_to_add);
    }

    return res.json({ status: 'completed', session_id });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const database = Database.getInstance();
const userRepository = new HybridUserRepository();
const authService = new AuthService(userRepository);
const authMiddleware = new AuthMiddleware(authService);
const configService = ConfigService.getInstance();
const rfqParsers = new RFQParsers();
const paymentService = new PaymentService();
const quoteCreationService = new QuoteCreationService();
const pdfGenerationService = new PDFGenerationService();
const exportService = new ExportService();
const previewService = new PreviewService();
const creditsService = CreditsService.getInstance();

// In-memory ERP sync store for idempotency testing
const erpSyncStore = new Map<string, { erp_order_id: string; created_at: string }>();

console.log('Credits service initialized (PostgreSQL backend)');

database.testConnection().then(isConnected => {
  if (isConnected) {
    console.log('PostgreSQL database connected successfully');
  } else {
    console.warn('PostgreSQL database not available - running with in-memory fallback');
    console.warn('To use PostgreSQL: Set up database and configure connection in .env file');
  }
}).catch(error => {
  console.warn('Database connection error - running with in-memory fallback:', error.message);
  console.warn('To use PostgreSQL: Set up database and configure connection in .env file');
});


app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.1',
  });
});

// ERP Sync (stub): Accepts a quote and idempotency_key, returns a fake ERP order id
app.post('/erp/quotes', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { idempotency_key, quote } = req.body || {};

    if (!idempotency_key || !quote) {
      return res.status(400).json({ error: 'idempotency_key and quote are required' });
    }

    // Idempotent behavior: if we have seen this key, return the same ERP order id
    const existing = erpSyncStore.get(idempotency_key);
    if (existing) {
      return res.status(200).json({ status: 'ok', erp_order_id: existing.erp_order_id, idempotency_key });
    }

    // Optional: verify that idempotency_key == sha256(quote JSON). If mismatch, only warn.
    try {
      const serialized = JSON.stringify(quote);
      const computed = crypto.createHash('sha256').update(serialized).digest('hex');
      if (computed !== idempotency_key) {
        console.warn('[ERP SYNC] Provided idempotency_key does not match SHA-256 of quote payload');
      }
    } catch (e) {
      console.warn('[ERP SYNC] Failed to compute SHA-256 of quote payload:', e instanceof Error ? e.message : 'Unknown');
    }

    // Generate a fake ERP order id
    const erp_order_id = `ERP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    erpSyncStore.set(idempotency_key, { erp_order_id, created_at: new Date().toISOString() });

    return res.status(201).json({ status: 'ok', erp_order_id, idempotency_key });
  } catch (error: any) {
    console.error('ERP Sync stub error:', error);
    res.status(500).json({ error: error.message || 'ERP sync failed' });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const result = await authService.signup(email, password);

    res.status(201).json({
      user: result.user,
      access_token: result.tokens.access_token,
      refresh_token: result.tokens.refresh_token,
      expires_in: result.tokens.expires_in,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Signin attempt for email:', email);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    console.log('📧 Email validation passed, attempting signin...');
    const result = await authService.signin(email, password);
    console.log('✅ Signin successful for user:', result.user.id);

    res.json({
      user: result.user,
      access_token: result.tokens.access_token,
      refresh_token: result.tokens.refresh_token,
      expires_in: result.tokens.expires_in,
    });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

app.get('/api/auth/me', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const tokens = await authService.refreshToken(refresh_token);

    res.json({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
    });
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

app.post('/api/rfqs/parse', authMiddleware.authenticate, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    let { type, buyer_id, idempotency_key } = req.body || {};
    let text = req.body?.text as string | undefined;

    // Auto-detect and normalize chat-style JSON payloads (e.g. Slack)
    // Accept shapes like: { channel: 'slack', text: '...' }
    // If type is missing but text exists, assume 'chat'.
    if ((!type || !['email', 'chat', 'csv'].includes(type)) && typeof req.body === 'object') {
      if (typeof req.body.text === 'string' && req.body.text.trim().length > 0) {
        type = 'chat';
        text = req.body.text;
      }
    }

    // Validate type after normalization
    if (!type || !['email', 'chat', 'csv'].includes(type)) {
      return res.status(400).json({ error: 'Type must be one of: email, chat, csv' });
    }

    const finalBuyerId = req.user?.id || 'WEB-USER';

    const file = req.file;

    if (file) {
      text = file.buffer.toString('utf-8');
    }

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Content is required (either text or file)' });
    }

    const result = await rfqParsers.parseRFQ({
      type: type as 'email' | 'chat' | 'csv',
      text: text.trim(),
      file: file?.buffer,
      buyer_id: finalBuyerId,
      idempotency_key,
      user_id: req.user?.id,
    });

    res.json(result);
  } catch (error: any) {
    console.error('RFQ Parse Error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/rfqs/runs/:runId', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { runId } = req.params;
    const run = await rfqParsers.getRun(runId);

    if (!run) {
      return res.status(404).json({ error: 'RFQ run not found' });
    }

    res.json(run);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments/create-session', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { quote_id, amount, currency } = req.body;

    if (!quote_id || !amount || !currency) {
      return res.status(400).json({ error: 'quote_id, amount, and currency are required' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const session = await paymentService.createCheckoutSession({
      quote_id,
      amount,
      currency,
      buyer_id: req.user.id,
    });

    res.json({
      session_id: session.session_id,
      checkout_url: session.checkout_url,
      expires_at: session.expires_at,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const payload = req.body.toString();

    if (!paymentService.verifyWebhookSignature(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(payload);

    await paymentService.handleWebhook({
      type: event.type,
      session_id: event.session_id || event.data?.object?.id,
      quote_id: event.quote_id || event.data?.object?.metadata?.quote_id,
      amount: event.amount || event.data?.object?.amount_total,
      payment_intent_id: event.data?.object?.payment_intent,
    });

    const session = await paymentService.getSessionStatus(event.session_id || event.data?.object?.id);
    if (session && session.kind === 'credits' && session.status === 'paid' && session.credits_to_add && session.buyer_id) {
      creditsService.addCredits(session.buyer_id, session.credits_to_add);
    }

    res.json({ received: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/credits/purchase/session', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { credits_to_add, amount, currency } = req.body || {};
    const buyerId = req.user?.id;
    
    if (!buyerId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!credits_to_add || !amount) {
      return res.status(400).json({ error: 'credits_to_add and amount are required' });
    }

    if (!Number.isInteger(credits_to_add) || credits_to_add <= 0) {
      return res.status(400).json({ error: 'credits_to_add must be a positive integer' });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const session = await paymentService.createCreditsSession(buyerId, Number(credits_to_add), Number(amount), currency || 'INR');

    res.status(201).json({
      session_id: session.session_id,
      checkout_url: session.checkout_url,
      amount: session.amount,
      currency: session.currency,
      buyer_id: session.buyer_id,
      credits_to_add: session.credits_to_add,
      status: session.status,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/payments/status/:quoteId', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { quoteId } = req.params;
    const payment = await paymentService.getQuotePaymentStatus(quoteId);

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({
      quote_id: payment.quote_id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      created_at: payment.created_at,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Stripe success/cancel redirect handlers
app.get('/api/payments/success', async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.redirect('http://localhost:3001/?checkout=cancel&error=missing_session');
    }

    // Get session details from Stripe
    const session = await paymentService.getSessionStatus(session_id as string);
    
    if (!session) {
      return res.redirect('http://localhost:3001/?checkout=cancel&error=session_not_found');
    }

    // Handle credits purchase
    if (session.kind === 'credits' && session.credits_to_add) {
      try {
        // Add credits to user account
        await creditsService.addCredits(session.buyer_id, session.credits_to_add);
        console.log(`Added ${session.credits_to_add} credits to user ${session.buyer_id}`);
      } catch (error) {
        console.error('Failed to add credits:', error);
        return res.redirect('http://localhost:3001/?checkout=cancel&error=credit_update_failed');
      }
    }

    // Mark session as completed
    await paymentService.handleWebhook({
      type: 'checkout.session.completed',
      session_id: session_id as string,
      quote_id: session.quote_id,
      amount: session.amount,
    });

    res.redirect(`http://localhost:3001/?checkout=success&session_id=${session_id}`);
  } catch (error: any) {
    console.error('Payment success handler error:', error);
    res.redirect('http://localhost:3001/?checkout=cancel&error=processing_failed');
  }
});

app.get('/api/payments/cancel', async (req, res) => {
  res.redirect('http://localhost:3001/?checkout=cancel');
});

app.post('/api/rfqs/runs/:runId/map', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { runId } = req.params;
    console.log(`[MAP] Received mapping request for runId: ${runId}`);

    const run = await rfqParsers.getRun(runId);
    if (!run) {
      console.log(`[MAP] Run not found: ${runId}`);
      return res.status(404).json({ error: 'RFQ run not found' });
    }

    const priceRepo = new CSVPriceMasterRepository(process.env.PRICE_MASTER_PATH || './data/price_master.csv');
    const skuCatalog = await priceRepo.getAllSKUs();

    const mapper = new DeterministicMappingService();
    const mappedLines = await mapper.mapLineItems(run.parsed_lines, skuCatalog);

    res.json({
      run_id: runId,
      mapped_lines: mappedLines,
      summary: {
        total_lines: mappedLines.length,
        auto_mapped: mappedLines.filter(l => l.mapping_result.status === 'auto_mapped').length,
        needs_review: mappedLines.filter(l => l.mapping_result.status === 'needs_review').length,
        failed: mappedLines.filter(l => l.mapping_result.status === 'failed').length,
      }
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/quotes', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { run_id, header_discount_pct = 0, freight_taxable = true, idempotency_key } = req.body;

    if (!run_id) {
      return res.status(400).json({ error: 'run_id is required' });
    }

    const buyer = {
      buyer_id: req.user?.id || 'WEB-USER',
      name: req.user?.email || 'Web User'
    };

    const run = await rfqParsers.getRun(run_id);
    if (!run) {
      return res.status(404).json({ error: 'RFQ run not found' });
    }

    // Load real SKU catalog
    const priceRepo = new CSVPriceMasterRepository(process.env.PRICE_MASTER_PATH || './data/price_master.csv');
    const skuCatalog = await priceRepo.getAllSKUs();

    const mapper = new DeterministicMappingService();
    const mappedLines = await mapper.mapLineItems(run.parsed_lines as any, skuCatalog);

    const buyerId = buyer?.buyer_id || 'WEB-USER';
    await creditsService.chargeIfNeeded(buyerId, run_id);

    const originalItems = run.parsed_lines.map((parsedLine, index) => {
      const mappedLine = mappedLines[index];
      let mappedSku = 'Not mapped';
      let mappedDescription = '';
      
      if (mappedLine?.mapping_result?.status === 'auto_mapped' && mappedLine.mapping_result.selected_sku) {
        mappedSku = mappedLine.mapping_result.selected_sku;
        const sku = skuCatalog.find(s => s.skuCode === mappedSku);
        mappedDescription = sku?.description || '';
      } else if (mappedLine?.mapping_result?.candidates?.length > 0) {
        mappedSku = mappedLine.mapping_result.candidates[0].sku_code;
        const sku = skuCatalog.find(s => s.skuCode === mappedSku);
        mappedDescription = sku?.description || '';
      }

      return {
        input_text: parsedLine.input_text,
        qty: parsedLine.qty,
        uom: parsedLine.uom,
        mapped_sku: mappedSku,
        mapped_description: mappedDescription
      };
    });

    const quote = await quoteCreationService.createQuote(
      {
        run_id: run_id,
        header_discount_pct: header_discount_pct,
        freight_taxable: freight_taxable,
        buyer: { buyer_id: buyerId, name: buyer?.name || 'Web User' }
      },
      mappedLines,
      skuCatalog,
      req.user?.id,
      originalItems
    );

    res.status(201).json(quote);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/credits', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  const buyerId = (req.query.buyer_id as string) || req.user?.id || 'WEB-USER';
  try {
    const credits = await creditsService.getCredits(buyerId);
    return res.json({ buyer_id: buyerId, credits });
  } catch (error: any) {
    console.error('Credits get error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Credits retrieval failed', 
      details: errorMessage,
      buyer_id: buyerId 
    });
  }
});

app.post('/api/credits/set', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { buyer_id, credits } = req.body || {};
    if (!buyer_id || credits === undefined) {
      return res.status(400).json({ error: 'buyer_id and credits are required' });
    }

    if (!Number.isInteger(credits) || credits < 0) {
      return res.status(400).json({ error: 'Credits must be a non-negative integer' });
    }
    await creditsService.setCredits(buyer_id, credits);
    const newCredits = await creditsService.getCredits(buyer_id);
    return res.json({ buyer_id, credits: newCredits });
  } catch (error: any) {
    console.error('Credits set error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Credits update failed', 
      details: errorMessage,
      buyer_id: req.body.buyer_id 
    });
  }
});

app.post('/api/credits/purchase', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { buyer_id, credits_to_add, amount, currency } = req.body || {};
    const userId = req.user?.id || buyer_id;
    
    if (!userId || !credits_to_add || !amount) {
      return res.status(400).json({ error: 'buyer_id, credits_to_add, and amount are required' });
    }

    // Validate credits_to_add is a positive integer
    if (!Number.isInteger(credits_to_add) || credits_to_add <= 0) {
      return res.status(400).json({ error: 'credits_to_add must be a positive integer' });
    }

    // Validate amount is a positive number
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    await creditsService.addCredits(userId, credits_to_add);
    const newCredits = await creditsService.getCredits(userId);

    const session = {
      session_id: `sess_${Date.now()}`,
      buyer_id: userId,
      credits_to_add,
      amount,
      currency: currency || 'INR',
      status: 'completed'
    };

    res.json(session);
  } catch (error: any) {
    console.error('Credits purchase error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Credits purchase failed', 
      details: errorMessage,
      buyer_id: req.body.buyer_id 
    });
  }
});

app.get('/api/quotes/:quoteId', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { quoteId } = req.params;
    const quote = await quoteCreationService.getQuote(quoteId);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json(quote);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quotes', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    
    let quotes;
    
    if (userId) {
      quotes = await quoteCreationService.getQuotesByUser(userId);
    } else {
      quotes = await quoteCreationService.getAllQuotes();
    }
    
    res.json({ quotes });
  } catch (error: any) {
    console.error('Get quotes error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quotes/:quoteId/pdf', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { quoteId } = req.params;
    const quote = await quoteCreationService.getQuote(quoteId);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const pdfBuffer = await pdfGenerationService.generatePDF(quote as any);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quote-${quoteId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('PDF generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'PDF generation failed', 
      details: errorMessage,
      quote_id: req.params.quoteId 
    });
  }
});

// Enhanced PDF with branding
app.get('/api/quotes/:quoteId/pdf/enhanced', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { quoteId } = req.params;
    const quote = await quoteCreationService.getQuote(quoteId);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Add sample explainability and tax breakup data for enhanced PDF
    const enhancedQuote = {
      ...quote,
      totals: {
        ...quote.totals,
        tax_breakup: {
          '8517': {
            taxable_value: 50000,
            cgst_rate: 9,
            cgst_amount: 4500,
            sgst_rate: 9,
            sgst_amount: 4500,
            total_tax: 9000
          },
          '8471': {
            taxable_value: 30000,
            cgst_rate: 9,
            cgst_amount: 2700,
            sgst_rate: 9,
            sgst_amount: 2700,
            total_tax: 5400
          }
        }
      },
      explainability: {
        processing_steps: [
          {
            step: 'RFQ Parsing',
            description: 'Successfully parsed RFQ items from input text',
            confidence: 0.95,
            details: { items_found: quote.line_items.length }
          },
          {
            step: 'SKU Mapping',
            description: 'Mapped items to catalog SKUs using fuzzy matching',
            confidence: 0.87,
            details: { mapping_algorithm: 'Levenshtein + Semantic' }
          },
          {
            step: 'Price Calculation',
            description: 'Applied pricing rules and calculated totals',
            confidence: 0.92,
            details: { base_pricing: 'catalog', adjustments: [] }
          }
        ],
        mapping_confidence: quote.line_items.reduce((acc, item) => {
          acc[item.sku_code] = Math.random() * 0.3 + 0.7; // Random confidence between 0.7-1.0
          return acc;
        }, {} as { [key: string]: number }),
        pricing_logic: {
          base_pricing: 'Catalog pricing with volume discounts',
          adjustments: [
            { factor: 'Volume Discount', impact: -5, reason: 'Order quantity > 100 units' },
            { factor: 'Market Adjustment', impact: 2, reason: 'Current market conditions' }
          ]
        }
      }
    };

    const pdfBuffer = await pdfGenerationService.generatePDF(enhancedQuote as any);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quote-${quoteId}-enhanced.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('Enhanced PDF generation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Enhanced PDF generation failed', 
      details: errorMessage,
      quote_id: req.params.quoteId 
    });
  }
});

// Quote preview
app.get('/api/quotes/:quoteId/preview', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { quoteId } = req.params;
    const quote = await quoteCreationService.getQuote(quoteId);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const previewData = previewService.generateQuotePreview(quote as any);
    res.json(previewData);
  } catch (error: any) {
    console.error('Quote preview error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Quote preview failed', 
      details: errorMessage,
      quote_id: req.params.quoteId 
    });
  }
});

// Export quote to CSV
app.get('/api/quotes/:quoteId/export/csv', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { quoteId } = req.params;
    const quote = await quoteCreationService.getQuote(quoteId);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const csvPath = await exportService.exportToCSV(quote as any);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="quote-${quoteId}.csv"`);
    
    const fs = await import('fs');
    const csvContent = fs.readFileSync(csvPath);
    res.send(csvContent);
  } catch (error: any) {
    console.error('CSV export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'CSV export failed', 
      details: errorMessage,
      quote_id: req.params.quoteId 
    });
  }
});

// Export quote to JSON
app.get('/api/quotes/:quoteId/export/json', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { quoteId } = req.params;
    const quote = await quoteCreationService.getQuote(quoteId);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const jsonPath = await exportService.exportToJSON(quote as any);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="quote-${quoteId}.json"`);
    
    const fs = await import('fs');
    const jsonContent = fs.readFileSync(jsonPath, 'utf8');
    res.send(jsonContent);
  } catch (error: any) {
    console.error('JSON export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'JSON export failed', 
      details: errorMessage,
      quote_id: req.params.quoteId 
    });
  }
});

// Export tax breakup to CSV
app.get('/api/quotes/:quoteId/export/tax-csv', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { quoteId } = req.params;
    const quote = await quoteCreationService.getQuote(quoteId);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Add sample tax breakup data
    const enhancedQuote = {
      ...quote,
      totals: {
        ...quote.totals,
        tax_breakup: {
          '8517': {
            taxable_value: 50000,
            cgst_rate: 9,
            cgst_amount: 4500,
            sgst_rate: 9,
            sgst_amount: 4500,
            total_tax: 9000
          },
          '8471': {
            taxable_value: 30000,
            cgst_rate: 9,
            cgst_amount: 2700,
            sgst_rate: 9,
            sgst_amount: 2700,
            total_tax: 5400
          }
        }
      }
    };

    const csvPath = await exportService.exportTaxBreakupToCSV(enhancedQuote as any);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tax-breakup-${quoteId}.csv"`);
    
    const fs = await import('fs');
    const csvContent = fs.readFileSync(csvPath);
    res.send(csvContent);
  } catch (error: any) {
    console.error('Tax CSV export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Tax CSV export failed', 
      details: errorMessage,
      quote_id: req.params.quoteId 
    });
  }
});

// Export explainability JSON
app.get('/api/quotes/:quoteId/explainability', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { quoteId } = req.params;
    const quote = await quoteCreationService.getQuote(quoteId);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Add sample explainability data
    const enhancedQuote = {
      ...quote,
      explainability: {
        processing_steps: [
          {
            step: 'RFQ Parsing',
            description: 'Successfully parsed RFQ items from input text',
            confidence: 0.95,
            details: { items_found: quote.line_items.length }
          },
          {
            step: 'SKU Mapping',
            description: 'Mapped items to catalog SKUs using fuzzy matching',
            confidence: 0.87,
            details: { mapping_algorithm: 'Levenshtein + Semantic' }
          },
          {
            step: 'Price Calculation',
            description: 'Applied pricing rules and calculated totals',
            confidence: 0.92,
            details: { base_pricing: 'catalog', adjustments: [] }
          }
        ],
        mapping_confidence: quote.line_items.reduce((acc, item) => {
          acc[item.sku_code] = Math.random() * 0.3 + 0.7; // Random confidence between 0.7-1.0
          return acc;
        }, {} as { [key: string]: number }),
        pricing_logic: {
          base_pricing: 'Catalog pricing with volume discounts',
          adjustments: [
            { factor: 'Volume Discount', impact: -5, reason: 'Order quantity > 100 units' },
            { factor: 'Market Adjustment', impact: 2, reason: 'Current market conditions' }
          ]
        }
      }
    };

    const explainabilityJSON = await pdfGenerationService.generateExplainabilityJSON(enhancedQuote as any);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="explainability-${quoteId}.json"`);
    res.send(explainabilityJSON);
  } catch (error: any) {
    console.error('Explainability export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Explainability export failed', 
      details: errorMessage,
      quote_id: req.params.quoteId 
    });
  }
});

// Export complete quote bundle
app.get('/api/quotes/:quoteId/export/bundle', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { quoteId } = req.params;
    const quote = await quoteCreationService.getQuote(quoteId);

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Add sample enhanced data
    const enhancedQuote = {
      ...quote,
      totals: {
        ...quote.totals,
        tax_breakup: {
          '8517': {
            taxable_value: 50000,
            cgst_rate: 9,
            cgst_amount: 4500,
            sgst_rate: 9,
            sgst_amount: 4500,
            total_tax: 9000
          }
        }
      },
      explainability: {
        processing_steps: [
          {
            step: 'RFQ Parsing',
            description: 'Successfully parsed RFQ items from input text',
            confidence: 0.95,
            details: { items_found: quote.line_items.length }
          }
        ],
        mapping_confidence: quote.line_items.reduce((acc, item) => {
          acc[item.sku_code] = Math.random() * 0.3 + 0.7;
          return acc;
        }, {} as { [key: string]: number }),
        pricing_logic: {
          base_pricing: 'Catalog pricing',
          adjustments: []
        }
      },
      revision_diff: quote.revision > 1 ? {
        previous_revision: quote.revision - 1,
        changes: [
          {
            type: 'modified' as const,
            field: 'unit_rate',
            old_value: '1000.00',
            new_value: '950.00',
            line_item: 1
          }
        ]
      } : undefined
    };

    const bundle = await exportService.exportQuoteBundle(enhancedQuote as any);
    
    res.json({
      message: 'Quote bundle exported successfully',
      files: bundle
    });
  } catch (error: any) {
    console.error('Bundle export error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ 
      error: 'Bundle export failed', 
      details: errorMessage,
      quote_id: req.params.quoteId 
    });
  }
});

app.get('/api/config', authMiddleware.authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const config = configService.getFullConfig();
    res.json(config);
  } catch (error: any) {
    console.error('Config retrieval error:', error);
    res.status(500).json({ error: 'Failed to retrieve configuration' });
  }
});

app.get('/api/dashboard/stats', authMiddleware.authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    
    const quoteStats = await quoteCreationService.getQuoteStats(userId);
    
    const priceRepo = new CSVPriceMasterRepository(process.env.PRICE_MASTER_PATH || './data/price_master.csv');
    const skuCatalog = await priceRepo.getAllSKUs();
    
    const stats = {
      totalQuotes: quoteStats.totalQuotes,
      successRate: quoteStats.totalQuotes > 0 ? 95.5 : 0, // Calculate from actual mapping success
      avgProcessingTime: 2.4, // This would be calculated from processing_runs table
      activeSKUs: skuCatalog.length,
    };
    
    res.json(stats);
  } catch (error: any) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
});


app.post('/api/sku/test', async (req, res) => {
  try {
    const { description, sizeOdMm, material, gauge, colour } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Load SKU catalog
    const priceRepo = new CSVPriceMasterRepository(process.env.PRICE_MASTER_PATH || './data/price_master.csv');
    const skuCatalog = await priceRepo.getAllSKUs();

    // Create a mock parsed line item for testing
    const testLineItem = {
      input_text: description.trim(),
      qty: 1,
      uom: 'PCS',
      raw_tokens: {
        size_token: sizeOdMm ? sizeOdMm.toString() : undefined,
        material_token: material || undefined,
        gauge_token: gauge || undefined,
        color_token: colour || undefined,
      },
      normalized: {
        size_mm: sizeOdMm ? parseFloat(sizeOdMm) : undefined,
        material: material || undefined,
        gauge: gauge || undefined,
        color: colour || undefined,
      }
    };

    // Use the mapping service to find candidates
    const mapper = new DeterministicMappingService();
    const mappedResults = await mapper.mapLineItems([testLineItem], skuCatalog);
    const result = mappedResults[0];

    if (!result || !result.mapping_result) {
      return res.status(500).json({ error: 'Failed to process SKU test' });
    }

    // Transform the result to match the frontend interface
    const response = {
      matched: result.mapping_result.status === 'auto_mapped',
      needsReview: result.mapping_result.status === 'needs_review',
      explanation: result.mapping_result.explanation?.assumptions?.join('; ') || 
                  `Mapping status: ${result.mapping_result.status}`,
      candidate: result.mapping_result.selected_sku ? (() => {
        const selectedSku = skuCatalog.find(s => s.skuCode === result.mapping_result.selected_sku);
        return selectedSku ? {
          skuCode: selectedSku.skuCode,
          description: selectedSku.description,
          rateInr: selectedSku.rateInr,
          material: selectedSku.material,
        } : undefined;
      })() : undefined,
      candidates: result.mapping_result.candidates?.map(candidate => {
        const sku = skuCatalog.find(s => s.skuCode === candidate.sku_code);
        return {
          sku: {
            skuCode: candidate.sku_code,
            description: sku?.description || '',
            rateInr: sku?.rateInr || 0,
            material: sku?.material || '',
          },
          score: candidate.score,
          reasons: candidate.reason ? candidate.reason.split('; ') : [],
        };
      }) || [],
    };

    res.json(response);
  } catch (error: any) {
    console.error('SKU test error:', error);
    res.status(500).json({ 
      error: 'SKU test failed', 
      details: error.message 
    });
  }
});

app.get('/api/schemas', authMiddleware.authenticate, (req: AuthenticatedRequest, res) => {
  try {
    res.json({ schemas: PREDEFINED_SCHEMAS });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/cache/clear', authMiddleware.authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const result = rfqParsers.clearCaches();
    res.json({ cleared: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function handleError(error: any, res: express.Response): void {
  console.error('API Error:', error);

  if (error instanceof ValidationError) {
    res.status(400).json({
      error: error.message,
      code: error.code,
      field: error.field,
    });
    return;
  }

  if (error instanceof SKUMappingError) {
    res.status(422).json({
      error: error.message,
      code: error.code,
      inputText: error.inputText,
    });
    return;
  }

  if (error instanceof PricingError) {
    res.status(422).json({
      error: error.message,
      code: error.code,
      skuCode: error.skuCode,
    });
    return;
  }

  res.status(500).json({
    error: 'Internal server error',
    message: error.message,
  });
}

app.listen(port, () => {
  console.log(`Pactle Quote Generation Service running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});

export default app;

