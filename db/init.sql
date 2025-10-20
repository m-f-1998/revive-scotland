-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================
-- Events
-- ==========================
CREATE TABLE IF NOT EXISTS events (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  "title" VARCHAR(50) NOT NULL,
  "description" TEXT NULL,
  "start" TIMESTAMP NULL,
  "end" TIMESTAMP NULL,
  "longitude" DECIMAL(9, 6) NULL,
  "latitude" DECIMAL(8, 6) NULL,
  "location_name" VARCHAR(100) NULL,
  "showcase_image" VARCHAR(255) NULL,
  "donation_requested" SMALLINT DEFAULT 0,
  "donation_amount" REAL NULL,
  "payment_required" SMALLINT DEFAULT 0,
  "payment_amount" REAL NULL,
  "goto_event_link" VARCHAR(255) NULL
);

-- ==========================
-- Users
-- ==========================
CREATE TABLE IF NOT EXISTS users (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  "username" VARCHAR(50) UNIQUE NOT NULL,
  "email" VARCHAR(100) UNIQUE NOT NULL,
  "password_hash" VARCHAR(256) NOT NULL,
  "password_salt" VARCHAR(256) NOT NULL,
  "role" VARCHAR(20) DEFAULT 'user',
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================
-- Page Headers
-- ==========================
CREATE TABLE IF NOT EXISTS headers (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  "filename" VARCHAR(255) NOT NULL,
  "title" VARCHAR(100) NULL,
  "description" TEXT NULL,
  "location" VARCHAR(100) NULL
);

-- ==========================
-- Files
-- ==========================
CREATE TABLE IF NOT EXISTS files (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(10) NOT NULL,
  -- NULL for root
  r2_path VARCHAR(512),
  -- path/key in R2
  size INT,
  mime_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  owned_by UUID NOT NULL
);

ALTER TABLE
  files
ADD
  CONSTRAINT fk_owned_by FOREIGN KEY (owned_by) REFERENCES users (id) ON DELETE CASCADE;

-- ==========================
-- File Shares
-- ==========================
CREATE TABLE IF NOT EXISTS file_shares (
  id SERIAL PRIMARY KEY,
  file_id SERIAL NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  -- random token for sharing
  max_downloads INT,
  -- optional (NULL = unlimited)
  downloads_used INT DEFAULT 0 NOT NULL,
  -- increment per access
  expires_at TIMESTAMP WITH TIME ZONE,
  -- optional (NULL = no expiry)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add an index for quick token lookups
CREATE UNIQUE INDEX idx_file_shares_token ON file_shares(token);

ALTER TABLE
  file_shares
ADD
  CONSTRAINT fk_file_id FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE;

-- ==========================
-- Share Links
-- ==========================
CREATE TABLE IF NOT EXISTS shareLinks (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  "file_id" SERIAL NOT NULL,
  "shared_with" UUID NULL,
  "expires_at" TIMESTAMP NULL,
  "max_uses" SMALLINT NULL,
  "uses" SMALLINT DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE
  shareLinks
ADD
  CONSTRAINT fk_file_id FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE;

-- ==========================
-- Blacklisted Tokens
-- ==========================
CREATE TABLE IF NOT EXISTS blacklistedTokens (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  "jti" VARCHAR(100) NOT NULL,
  "blacklisted_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP NOT NULL
);

-- ==========================
-- Sessions for users
-- ==========================
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid (),
  "username" VARCHAR(50) UNIQUE NOT NULL,
  "session_token" TEXT NOT NULL,
  "last_active" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE
  "sessions"
ADD
  CONSTRAINT fk_username FOREIGN KEY (username) REFERENCES users (username) ON DELETE CASCADE;