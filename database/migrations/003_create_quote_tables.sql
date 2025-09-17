-- Migration: Create quote-related tables

-- Table: quotes
CREATE TABLE quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id TEXT UNIQUE NOT NULL,
    rfq_id TEXT,
    user_id TEXT,
    revision INTEGER DEFAULT 1,
    status TEXT DEFAULT 'draft',
    buyer_id TEXT NOT NULL,
    buyer_name TEXT,
    buyer_email TEXT,
    buyer_address JSONB,
    header_discount_pct DOUBLE PRECISION DEFAULT 0,
    freight_taxable BOOLEAN DEFAULT true,
    region TEXT DEFAULT 'US',
    currency TEXT DEFAULT 'USD',
    subtotal DOUBLE PRECISION DEFAULT 0,
    discount DOUBLE PRECISION DEFAULT 0,
    freight DOUBLE PRECISION DEFAULT 0,
    tax DOUBLE PRECISION DEFAULT 0,
    total DOUBLE PRECISION DEFAULT 0,
    needs_review_count INTEGER DEFAULT 0,
    pdf_url TEXT,
    json_url TEXT,
    csv_url TEXT,
    expires_at TIMESTAMP(3),
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Table: quote_lines
CREATE TABLE quote_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    input_description TEXT,
    mapped_sku TEXT,
    sku_description TEXT,
    quantity DOUBLE PRECISION NOT NULL,
    unit_price DOUBLE PRECISION,
    total_price DOUBLE PRECISION,
    status TEXT,
    explanation_data JSONB,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Table: payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quoteid TEXT NOT NULL,
    stripe_session_id TEXT,
    status TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    currency TEXT NOT NULL,
    payment_intent_id TEXT,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);