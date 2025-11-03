-- Migration SQL pour Supabase
-- Copier-coller ce SQL dans Supabase SQL Editor

-- Tables Better Auth
CREATE TABLE IF NOT EXISTS "user" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name TEXT,
  email VARCHAR(255) NOT NULL UNIQUE,
  email_verified BOOLEAN DEFAULT false NOT NULL,
  image TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  role VARCHAR(20) DEFAULT 'admin' NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMP NOT NULL,
  token TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS account (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMP,
  refresh_token_expires_at TIMESTAMP,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS verification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  billing_token TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  deployment_type VARCHAR(20) NOT NULL DEFAULT 'on-premise',
  plan_type VARCHAR(20),
  subscription_status VARCHAR(20) DEFAULT 'trial',
  trial_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Table usage_reports
CREATE TABLE IF NOT EXISTS usage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_count INTEGER NOT NULL,
  deployment_type VARCHAR(20) NOT NULL,
  reported_at TIMESTAMP DEFAULT NOW() NOT NULL,
  stripe_meter_event_id TEXT
);

-- Index
CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_billing_token ON organizations(billing_token);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id ON organizations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_usage_reports_organization_id ON usage_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_reports_reported_at ON usage_reports(reported_at);

-- Créer l'utilisateur admin
-- Note: Le mot de passe doit être hashé avec bcrypt. Utilisez Better Auth API (page de login) pour créer l'utilisateur.

