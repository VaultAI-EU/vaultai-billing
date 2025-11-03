# Setup Base de Données pour Billing

## Option 1 : Utiliser Supabase (recommandé)

1. Créer un nouveau projet Supabase : https://supabase.com
2. Récupérer la connection string PostgreSQL depuis Settings → Database → Connection string
3. Format : `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

## Option 2 : Utiliser Vercel Postgres

1. Dans Vercel Dashboard → Storage → Create Database
2. Sélectionner "Postgres"
3. Vercel génère automatiquement `POSTGRES_URL` dans les variables d'environnement

## Option 3 : Base de données externe

Utiliser n'importe quelle base PostgreSQL (AWS RDS, Railway, Neon, etc.)

## Configuration dans Vercel

1. Aller sur https://vercel.com/vault-ai/billing/settings/environment-variables
2. Ajouter `DATABASE_URL` avec votre connection string PostgreSQL
3. Redéployer le projet

## Migration de la base de données

Une fois la base de données configurée, exécuter les migrations :

### Via Vercel CLI (localement)
```bash
cd billing
vercel env pull .env.local  # Télécharger les variables d'env
pnpm db:migrate
```

### Via script direct (si accès SSH à Vercel)
```bash
# Dans Vercel Dashboard → Functions → Runtime Logs
# Ou utiliser Vercel CLI avec accès SSH
```

### Alternative : Migration manuelle SQL

Exécuter ce SQL dans votre base de données :

```sql
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

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_organizations_billing_token ON organizations(billing_token);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id ON organizations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_usage_reports_organization_id ON usage_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_reports_reported_at ON usage_reports(reported_at);
```

