-- Migration: Create processing and RFQ tables

-- Table: processing_runs
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

-- Table: rfqs
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

-- Table: rfq_lines
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
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);