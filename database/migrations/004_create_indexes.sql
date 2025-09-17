-- Migration: Create indexes for better performance

-- users indexes
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- tax_rates indexes
CREATE UNIQUE INDEX idx_tax_rates_region_category ON tax_rates(region, category);

-- price_master indexes
CREATE UNIQUE INDEX idx_price_master_sku ON price_master(sku);
CREATE INDEX idx_price_master_family ON price_master(family);
CREATE INDEX idx_price_master_material ON price_master(material);

-- sku_aliases indexes
CREATE INDEX idx_sku_aliases_alias ON sku_aliases(alias);
CREATE INDEX idx_sku_aliases_sku ON sku_aliases(sku);

-- processing_runs indexes
CREATE UNIQUE INDEX idx_processing_runs_run_id ON processing_runs(run_id);
CREATE UNIQUE INDEX idx_processing_runs_idempotency_key ON processing_runs(idempotency_key);
CREATE INDEX idx_processing_runs_buyer_id ON processing_runs(buyer_id);
CREATE INDEX idx_processing_runs_status ON processing_runs(status);

-- rfqs indexes
CREATE INDEX idx_rfqs_run_id ON rfqs(run_id);
CREATE INDEX idx_rfqs_user_id ON rfqs(user_id);
CREATE INDEX idx_rfqs_buyer_id ON rfqs(buyer_id);
CREATE INDEX idx_rfqs_type ON rfqs(type);
CREATE INDEX idx_rfqs_status ON rfqs(status);

-- rfq_lines indexes
CREATE INDEX idx_rfq_lines_rfq_id ON rfq_lines(rfq_id);

-- quotes indexes
CREATE UNIQUE INDEX idx_quotes_quote_id ON quotes(quote_id);
CREATE INDEX idx_quotes_rfq_id ON quotes(rfq_id);
CREATE INDEX idx_quotes_user_id ON quotes(user_id);
CREATE INDEX idx_quotes_buyer_id ON quotes(buyer_id);
CREATE INDEX idx_quotes_status ON quotes(status);

-- quote_lines indexes
CREATE INDEX idx_quote_lines_quote_id ON quote_lines(quote_id);
CREATE INDEX idx_quote_lines_mapped_sku ON quote_lines(mapped_sku);

-- payments indexes
CREATE UNIQUE INDEX idx_payments_quoteid ON payments(quoteid);
CREATE INDEX idx_payments_stripe_session_id ON payments(stripe_session_id);
CREATE INDEX idx_payments_status ON payments(status);