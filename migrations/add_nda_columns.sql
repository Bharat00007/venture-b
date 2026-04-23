-- Migration: Add NDA signature columns to users table
-- This script adds columns to store NDA signature information

ALTER TABLE users
ADD COLUMN IF NOT EXISTS nda_signed_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS nda_signature_image BYTEA,
ADD COLUMN IF NOT EXISTS nda_signed_at TIMESTAMP DEFAULT NULL,
ADD COLUMN IF NOT EXISTS nda_document_url TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS contact_no VARCHAR(20);

-- Create a table to store NDA signatures separately (optional, for audit trail)
CREATE TABLE IF NOT EXISTS nda_signatures (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signed_name VARCHAR(255) NOT NULL,
  signature_image BYTEA NOT NULL,
  signed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT,
  nda_document_url TEXT,
  address TEXT,
  contact_no VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_nda_signatures_user_id ON nda_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_nda_signatures_signed_at ON nda_signatures(signed_at);
