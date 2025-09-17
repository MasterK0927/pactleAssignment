-- Migration: Create foreign key constraints

-- First, add unique constraint to rfqs.run_id if it doesn't exist
-- Check if constraint already exists before adding
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_rfqs_run_id'
    ) THEN
        ALTER TABLE rfqs ADD CONSTRAINT unique_rfqs_run_id UNIQUE (run_id);
    END IF;
END $$;

-- quote_lines references quotes
ALTER TABLE quote_lines
ADD CONSTRAINT fk_quote_lines_quote_id
FOREIGN KEY (quote_id) REFERENCES quotes(quote_id) ON DELETE CASCADE;

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