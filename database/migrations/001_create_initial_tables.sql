-- Migration: Create initial tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: users
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

-- Table: tax_rates
CREATE TABLE tax_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    region TEXT NOT NULL,
    category TEXT NOT NULL,
    tax_rate DOUBLE PRECISION NOT NULL,
    tax_name TEXT NOT NULL,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Table: price_master
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

-- Table: sku_aliases
CREATE TABLE sku_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alias TEXT NOT NULL,
    sku TEXT NOT NULL,
    score_bonus DOUBLE PRECISION DEFAULT 0,
    created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial tax rates
INSERT INTO tax_rates (region, category, tax_rate, tax_name) VALUES
('US', 'default', 0.08, 'Sales Tax'),
('CA', 'default', 0.13, 'HST'),
('UK', 'default', 0.20, 'VAT'),
('EU', 'default', 0.19, 'VAT');