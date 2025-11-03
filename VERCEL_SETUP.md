# Configuration Vercel pour VaultAI Billing

## Variables d'environnement requises

### 1. Base de données PostgreSQL

**`DATABASE_URL`** (requis)
- Connection string PostgreSQL
- Format : `postgresql://user:password@host:port/database`
- Exemple Supabase : `postgresql://postgres:password@db.xxx.supabase.co:5432/postgres`
- Exemple Vercel Postgres : Généré automatiquement si vous utilisez Vercel Postgres

### 2. Stripe

**`STRIPE_SECRET_KEY`** (requis)
- Clé secrète Stripe (commence par `sk_`)
- Disponible dans Stripe Dashboard → Developers → API keys

**`STRIPE_WEBHOOK_SECRET`** (requis)
- Secret du webhook Stripe (commence par `whsec_`)
- À configurer après avoir créé le webhook dans Stripe Dashboard

**`STRIPE_PRICE_MANAGED_MONTHLY`** (optionnel)
- Price ID pour Managed Cloud mensuel
- Par défaut : `price_1SOKmMBuLPvVxFwjVSr3v3ni`

**`STRIPE_PRICE_MANAGED_YEARLY`** (optionnel)
- Price ID pour Managed Cloud annuel
- Par défaut : `price_1SOKogBuLPvVxFwjYbNoYI8N`

**`STRIPE_PRICE_SELF_HOSTED_MONTHLY`** (optionnel)
- Price ID pour Self-Hosted mensuel
- Par défaut : `price_1SOKniBuLPvVxFwjRUrUouaO`

**`STRIPE_PRICE_SELF_HOSTED_YEARLY`** (optionnel)
- Price ID pour Self-Hosted annuel
- Par défaut : `price_1SOKniBuLPvVxFwj9rqOv0Or`

## Étapes de configuration

### 1. Créer la base de données

#### Option A : Vercel Postgres (recommandé pour simplicité)
1. Vercel Dashboard → Votre projet → Storage → Create Database
2. Sélectionner "Postgres"
3. Vercel génère automatiquement `POSTGRES_URL` → Copier dans `DATABASE_URL`

#### Option B : Supabase
1. Créer un projet sur https://supabase.com
2. Settings → Database → Connection string
3. Copier la connection string (mode "URI")

#### Option C : Autre PostgreSQL
- AWS RDS, Railway, Neon, etc.
- Récupérer la connection string

### 2. Exécuter les migrations

**Localement (avec variables d'env locales) :**
```bash
cd billing
vercel env pull .env.local  # Télécharger les variables depuis Vercel
pnpm db:migrate:manual       # Exécuter la migration manuelle
```

**Ou via SQL direct :**
Copier le contenu de `scripts/migrate-db.ts` et l'exécuter dans votre client SQL.

### 3. Configurer Stripe

1. **Créer le Meter et les Prices :**
```bash
pnpm setup:stripe
```

2. **Configurer le webhook dans Stripe Dashboard :**
   - URL : `https://billing.vaultai.eu/api/stripe/webhook`
   - Événements à écouter :
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
     - `invoice.payment_succeeded`
   - Copier le "Signing secret" dans `STRIPE_WEBHOOK_SECRET` sur Vercel

### 4. Ajouter les variables dans Vercel

1. Aller sur https://vercel.com/vault-ai/billing/settings/environment-variables
2. Ajouter toutes les variables listées ci-dessus
3. Sélectionner les environnements (Production, Preview, Development)
4. Redéployer le projet

### 5. Vérifier le déploiement

1. Visiter https://billing.vaultai.eu
2. Vous devriez voir la page d'accueil du service billing
3. Tester l'endpoint : `GET https://billing.vaultai.eu/api/organizations/[id]/status` (avec auth)

## Checklist de déploiement

- [ ] Base de données PostgreSQL créée
- [ ] `DATABASE_URL` configuré dans Vercel
- [ ] Migrations exécutées (tables créées)
- [ ] `STRIPE_SECRET_KEY` configuré dans Vercel
- [ ] Stripe Meter et Prices créés (`pnpm setup:stripe`)
- [ ] Webhook Stripe configuré
- [ ] `STRIPE_WEBHOOK_SECRET` configuré dans Vercel
- [ ] Application redéployée sur Vercel
- [ ] Page d'accueil accessible sur billing.vaultai.eu
- [ ] Test de l'API réussi
