export interface CreateSessionRequest {
  quote_id: string;
  amount: number;
  currency: string;
  buyer_id: string;
}

export interface PaymentSession {
  session_id: string;
  checkout_url: string;
  status: 'pending' | 'paid' | 'expired';
  amount: number;
  currency: string;
  quote_id: string;
  buyer_id: string;
  created_at: Date;
  expires_at: Date;
  kind?: 'quote' | 'credits';
  credits_to_add?: number;
}

export interface PaymentWebhookEvent {
  type: 'checkout.session.completed' | 'checkout.session.expired';
  session_id: string;
  quote_id: string;
  amount: number;
  payment_intent_id?: string;
}

export class PaymentService {
  private sessions: Map<string, PaymentSession> = new Map();
  private quotePayments: Map<string, PaymentSession> = new Map();
  private stripe: any;

  constructor() {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    try {
      const StripeLib = (require('stripe')?.default || require('stripe')) as any;
      this.stripe = new StripeLib(secret, { apiVersion: '2022-11-15' });
    } catch (e) {
      throw new Error('Failed to initialize Stripe SDK. Please ensure stripe package is installed.');
    }
  }


  async createCheckoutSession(request: CreateSessionRequest): Promise<PaymentSession> {
    if (!request.quote_id || !request.amount || request.amount <= 0) {
      throw new Error('Invalid quote_id or amount');
    }

    if (!request.currency || request.currency !== 'INR') {
      throw new Error('Only INR currency is supported');
    }

    const existingPayment = this.quotePayments.get(request.quote_id);
    if (existingPayment && existingPayment.status === 'paid') {
      throw new Error('Quote has already been paid');
    }

    const successUrl = process.env.CHECKOUT_SUCCESS_URL || 'http://localhost:3000/api/payments/success?session_id={CHECKOUT_SESSION_ID}';
    const cancelUrl = process.env.CHECKOUT_CANCEL_URL || 'http://localhost:3000/api/payments/cancel';
    
    const stripeSession = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      currency: request.currency,
      line_items: [
        {
          price_data: {
            currency: request.currency,
            product_data: { name: `Payment for Quote ${request.quote_id}` },
            unit_amount: Math.round(request.amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        quote_id: request.quote_id,
        buyer_id: request.buyer_id,
        kind: 'quote',
      },
    });

    const session: PaymentSession = {
      session_id: stripeSession.id,
      checkout_url: stripeSession.url,
      status: 'pending',
      amount: request.amount,
      currency: request.currency,
      quote_id: request.quote_id,
      buyer_id: request.buyer_id,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      kind: 'quote',
    };
    
    this.sessions.set(session.session_id, session);
    return session;
  }

  async createCreditsSession(
    buyer_id: string,
    credits_to_add: number,
    amount: number,
    currency: string = 'INR'
  ): Promise<PaymentSession> {
    if (!buyer_id) {
      throw new Error('buyer_id is required');
    }
    if (!Number.isFinite(credits_to_add) || credits_to_add <= 0) {
      throw new Error('credits_to_add must be a positive number');
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('amount must be a positive number');
    }
    if (!currency || currency !== 'INR') {
      throw new Error('Only INR currency is supported');
    }

    const successUrl = process.env.CHECKOUT_SUCCESS_URL || 'http://localhost:3000/api/payments/success?session_id={CHECKOUT_SESSION_ID}';
    const cancelUrl = process.env.CHECKOUT_CANCEL_URL || 'http://localhost:3000/api/payments/cancel';
    
    const stripeSession = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      currency,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `Purchase ${Math.floor(credits_to_add)} Credits` },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        buyer_id,
        kind: 'credits',
        credits_to_add: String(Math.floor(credits_to_add)),
        quote_id: `CREDITS-${buyer_id}`,
      },
    });

    const session: PaymentSession = {
      session_id: stripeSession.id,
      checkout_url: stripeSession.url,
      status: 'pending',
      amount,
      currency,
      quote_id: `CREDITS-${buyer_id}`,
      buyer_id,
      created_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      kind: 'credits',
      credits_to_add: Math.floor(credits_to_add),
    };
    
    this.sessions.set(session.session_id, session);
    return session;
  }

  async handleWebhook(event: PaymentWebhookEvent): Promise<void> {
    const session = this.sessions.get(event.session_id);
    if (!session) {
      throw new Error('Session not found');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        session.status = 'paid';
        this.quotePayments.set(session.quote_id, session);
        break;
      case 'checkout.session.expired':
        session.status = 'expired';
        break;
      default:
        throw new Error(`Unsupported webhook event type: ${event.type}`);
    }

    this.sessions.set(event.session_id, session);
  }

  async getSessionStatus(sessionId: string): Promise<PaymentSession | null> {
    const cached = this.sessions.get(sessionId);
    if (cached) return cached;

    const stripeSession = await this.stripe.checkout.sessions.retrieve(sessionId);
    if (!stripeSession) return null;
    
    const status: PaymentSession['status'] = stripeSession.payment_status === 'paid' ? 'paid' : 'pending';
    const amount = (stripeSession.amount_total ?? 0) / 100;
    const currency = (stripeSession.currency ?? 'inr').toUpperCase();
    const quote_id = stripeSession.metadata?.quote_id || 'UNKNOWN';
    const buyer_id = stripeSession.metadata?.buyer_id || 'UNKNOWN';
    const kind = (stripeSession.metadata?.kind as 'quote' | 'credits' | undefined) || 'quote';
    const credits_to_add = stripeSession.metadata?.credits_to_add ? Number(stripeSession.metadata.credits_to_add) : undefined;

    const mapped: PaymentSession = {
      session_id: stripeSession.id,
      checkout_url: stripeSession.url || '',
      status,
      amount,
      currency,
      quote_id,
      buyer_id,
      created_at: new Date(),
      expires_at: new Date(),
      kind,
      credits_to_add,
    };
    return mapped;
  }

  async getQuotePaymentStatus(quoteId: string): Promise<PaymentSession | null> {
    return this.quotePayments.get(quoteId) || null;
  }

  async isQuotePaid(quoteId: string): Promise<boolean> {
    const payment = this.quotePayments.get(quoteId);
    return payment?.status === 'paid' || false;
  }

  // Stripe webhook verification
  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required for webhook verification');
    }
    
    try {
      // Using Stripe's verification to ensure signature is valid.
      // We only validate and return a boolean; event parsing happens in the route.
      this.stripe.webhooks.constructEvent(_payload, _signature, secret);
      return true;
    } catch (_e) {
      return false;
    }
  }
}