-- PostgreSQL Database Schema for Pactle Assignment

-- Create database
-- CREATE DATABASE pactle_db;

-- Set timezone
SET timezone = 'UTC';

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table 1: payments
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

-- Table 2: price_master
CREATE TABLE price_master (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT NOT NULL,
    family TEXT,
    description TEXT,
    size_mm DOUBLE PRECISION,
    size_inches DOUBLE PRECISION,
    material TEXT,
    color TEXT,
    unit_price DOUBLE PRECISION NOT NULL,
    uom TEXT,
    tolerance_mm DOUBLE PRECISION,
    coil_length_mm DOUBLE PRECISION,
    category TEXT,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Table 3: processing_runs
CREATE TABLE processing_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id TEXT UNIQUE NOT NULL,
    idempotency_key TEXT,
    buyer_id TEXT NOT NULL,
    content_hash TEXT,
    status TEXT DEFAULT 'processing',
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP(3),
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Table 4: quote_lines
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

-- Table 5: quotes
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

-- Table 6: rfq_lines
CREATE TABLE rfq_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rfq_id TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    input_text TEXT,
    description TEXT,
    quantity DOUBLE PRECISION,
    unit TEXT,
    extracted_size TEXT,
    extracted_family TEXT,
    extracted_color TEXT,
    extracted_family TEXT,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Table 7: rfqs
CREATE TABLE rfqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id TEXT NOT NULL,
    user_id TEXT,
    buyer_id TEXT,
    type TEXT NOT NULL,
    original_content TEXT,
    idempotency_key TEXT,
    status TEXT DEFAULT 'parsing',
    processing_time_ms INTEGER,
    warnings TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Table 8: sku_aliases
CREATE TABLE sku_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alias TEXT NOT NULL,
    sku TEXT NOT NULL,
    score_bonus DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Table 9: tax_rates
CREATE TABLE tax_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region TEXT NOT NULL,
    category TEXT NOT NULL,
    tax_rate DOUBLE PRECISION NOT NULL,
    tax_name TEXT NOT NULL,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Table 10: users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance

-- Primary key indexes are created automatically

-- payments indexes
CREATE UNIQUE INDEX idx_payments_quoteid ON payments(quoteid);
CREATE INDEX idx_payments_stripe_session_id ON payments(stripe_session_id);
CREATE INDEX idx_payments_status ON payments(status);

-- price_master indexes
CREATE UNIQUE INDEX idx_price_master_sku ON price_master(sku);
CREATE INDEX idx_price_master_family ON price_master(family);
CREATE INDEX idx_price_master_material ON price_master(material);

-- processing_runs indexes
CREATE UNIQUE INDEX idx_processing_runs_run_id ON processing_runs(run_id);
CREATE UNIQUE INDEX idx_processing_runs_idempotency_key ON processing_runs(idempotency_key);
CREATE INDEX idx_processing_runs_buyer_id ON processing_runs(buyer_id);
CREATE INDEX idx_processing_runs_status ON processing_runs(status);

-- quote_lines indexes
CREATE INDEX idx_quote_lines_quote_id ON quote_lines(quote_id);
CREATE INDEX idx_quote_lines_mapped_sku ON quote_lines(mapped_sku);

-- quotes indexes
CREATE UNIQUE INDEX idx_quotes_quote_id ON quotes(quote_id);
CREATE INDEX idx_quotes_rfq_id ON quotes(rfq_id);
CREATE INDEX idx_quotes_user_id ON quotes(user_id);
CREATE INDEX idx_quotes_buyer_id ON quotes(buyer_id);
CREATE INDEX idx_quotes_status ON quotes(status);

-- rfq_lines indexes
CREATE INDEX idx_rfq_lines_rfq_id ON rfq_lines(rfq_id);

-- rfqs indexes
CREATE INDEX idx_rfqs_run_id ON rfqs(run_id);
CREATE INDEX idx_rfqs_user_id ON rfqs(user_id);
CREATE INDEX idx_rfqs_buyer_id ON rfqs(buyer_id);
CREATE INDEX idx_rfqs_type ON rfqs(type);
CREATE INDEX idx_rfqs_status ON rfqs(status);

-- sku_aliases indexes
CREATE INDEX idx_sku_aliases_alias ON sku_aliases(alias);
CREATE INDEX idx_sku_aliases_sku ON sku_aliases(sku);

-- tax_rates indexes
CREATE UNIQUE INDEX idx_tax_rates_region_category ON tax_rates(region, category);

-- users indexes
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Add foreign key constraints (based on apparent relationships)

-- quote_lines references quotes
ALTER TABLE quote_lines
ADD CONSTRAINT fk_quote_lines_quote_id
FOREIGN KEY (quote_id) REFERENCES quotes(quote_id) ON DELETE CASCADE;

-- quotes references rfqs
-- Note: This assumes rfq_id in quotes references the run_id in rfqs
-- ALTER TABLE quotes
-- ADD CONSTRAINT fk_quotes_rfq_id
-- FOREIGN KEY (rfq_id) REFERENCES rfqs(run_id) ON DELETE SET NULL;

-- rfq_lines references rfqs
ALTER TABLE rfq_lines
ADD CONSTRAINT fk_rfq_lines_rfq_id
FOREIGN KEY (rfq_id) REFERENCES rfqs(run_id) ON DELETE CASCADE;

-- payments references quotes
ALTER TABLE payments
ADD CONSTRAINT fk_payments_quoteid
FOREIGN KEY (quoteid) REFERENCES quotes(quote_id) ON DELETE CASCADE;

-- sku_aliases references price_master
ALTER TABLE sku_aliases
ADD CONSTRAINT fk_sku_aliases_sku
FOREIGN KEY (sku) REFERENCES price_master(sku) ON DELETE CASCADE;

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_price_master_updated_at BEFORE UPDATE ON price_master FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_processing_runs_updated_at BEFORE UPDATE ON processing_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quote_lines_updated_at BEFORE UPDATE ON quote_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rfq_lines_updated_at BEFORE UPDATE ON rfq_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rfqs_updated_at BEFORE UPDATE ON rfqs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tax_rates_updated_at BEFORE UPDATE ON tax_rates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for tax_rates
INSERT INTO tax_rates (region, category, tax_rate, tax_name) VALUES
('US', 'default', 0.08, 'Sales Tax'),
('CA', 'default', 0.13, 'HST'),
('UK', 'default', 0.20, 'VAT'),
('EU', 'default', 0.19, 'VAT');

-- Comments for documentation
COMMENT ON TABLE payments IS 'Payment transactions for quotes';
COMMENT ON TABLE price_master IS 'Master price list for SKUs';
COMMENT ON TABLE processing_runs IS 'Processing runs for RFQ parsing';
COMMENT ON TABLE quote_lines IS 'Individual line items in quotes';
COMMENT ON TABLE quotes IS 'Generated quotes for customers';
COMMENT ON TABLE rfq_lines IS 'Parsed lines from RFQ documents';
COMMENT ON TABLE rfqs IS 'Request for Quote documents';
COMMENT ON TABLE sku_aliases IS 'Alternative names/aliases for SKUs';
COMMENT ON TABLE tax_rates IS 'Tax rates by region and category';
COMMENT ON TABLE users IS 'Application users';