# VaultAI Billing Service

Service de gestion de facturation pour VaultAI on-premise et managed-cloud utilisant Stripe Usage-Based Billing.

## Architecture

```
┌─────────────────┐
│ VaultAI Instance│ (on-premise ou managed-cloud)
│                 │
│ - Cron quotidien│
│ - POST /api/    │
│   meter-events  │
└────────┬────────┘
         │
         │ HTTPS (sortant)
         ▼
┌─────────────────┐
│billing.vaultai.eu│
│                 │
│ - API Routes    │
│ - Stripe API    │
│ - DB PostgreSQL │
└────────┬────────┘
         │
         │ Stripe API
         ▼
┌─────────────────┐
│   Stripe        │
│   - Meter Events│
│   - Subscriptions│
│   - Invoices    │
└─────────────────┘
```

## Installation

1. **Installer les dépendances**
   ```bash
   pnpm install
   ```

2. **Configurer les variables d'environnement**
   ```bash
   cp .env.example .env
   # Remplir les variables dans .env
   ```

3. **Configurer la base de données**
   ```bash
   # Créer la base de données PostgreSQL
   createdb billing

   # Appliquer les migrations
   pnpm db:migrate
   ```

4. **Setup Stripe (une seule fois)**
   ```bash
   pnpm setup:stripe
   ```
   Ce script crée :
   - Le meter Stripe pour tracker les users actifs
   - Les products et prices (Managed Cloud et Self-Hosted, monthly et yearly)
   
   Copier les Price IDs dans votre `.env` après l'exécution.

5. **Configurer le webhook Stripe**
   - Aller dans Stripe Dashboard → Webhooks
   - Ajouter endpoint : `https://billing.vaultai.eu/api/stripe/webhook`
   - Sélectionner les événements :
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_failed`
     - `invoice.payment_succeeded`
   - Copier le webhook secret dans `.env` → `STRIPE_WEBHOOK_SECRET`

## Routes API

### POST `/api/meter-events`
Reçoit les rapports d'usage quotidiens depuis les instances VaultAI.

**Headers:**
- `Authorization: Bearer <billing_token>`

**Body:**
```json
{
  "organization_id": "uuid",
  "user_count": 15,
  "deployment_type": "on-premise",
  "timestamp": "2025-01-15T10:00:00Z"
}
```

### POST `/api/organizations/register`
Enregistre une nouvelle organisation et crée un customer Stripe avec subscription en période d'essai (4 jours).

**Body:**
```json
{
  "organization_id": "uuid",
  "organization_name": "ACME Corp",
  "email": "admin@acme.com",
  "deployment_type": "on-premise",
  "plan_type": "managed-cloud"
}
```

**Response:**
```json
{
  "success": true,
  "organization_id": "uuid",
  "billing_token": "vaultai_xxx",
  "stripe_customer_id": "cus_xxx",
  "stripe_subscription_id": "sub_xxx",
  "trial_end": "2025-01-19T10:00:00Z"
}
```

### GET `/api/organizations/:id/status`
Retourne le statut de la subscription pour une organisation.

**Headers:**
- `Authorization: Bearer <billing_token>`

**Response:**
```json
{
  "organization_id": "uuid",
  "organization_name": "ACME Corp",
  "subscription_status": "active",
  "trial_active": false,
  "trial_end": null,
  "plan_type": "managed-cloud",
  "deployment_type": "on-premise",
  "stripe_subscription": {
    "status": "active",
    "current_period_start": "2025-01-15T00:00:00Z",
    "current_period_end": "2025-02-15T00:00:00Z"
  }
}
```

### POST `/api/stripe/webhook`
Webhook Stripe pour synchroniser les changements de subscription (géré automatiquement par Stripe).

## Déploiement

### Variables d'environnement requises

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (générés par setup:stripe)
STRIPE_PRICE_MANAGED_MONTHLY=price_xxx
STRIPE_PRICE_MANAGED_YEARLY=price_xxx
STRIPE_PRICE_SELF_HOSTED_MONTHLY=price_xxx
STRIPE_PRICE_SELF_HOSTED_YEARLY=price_xxx

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/billing

# Next.js
NEXT_PUBLIC_APP_URL=https://billing.vaultai.eu
```

### Build et déploiement

```bash
pnpm build
pnpm start
```

## Côté VaultAI (Instance Client)

### Configuration

Ajouter dans `.env.production` :
```bash
BILLING_API_URL=https://billing.vaultai.eu
CRON_SECRET=votre_secret_securise
```

### Migration de base de données

Ajouter les champs suivants à la table `Organization` :
- `billing_token` (text, nullable)
- `deployment_type` (varchar(20), default: "on-premise")

### Cron Job

Ajouter un cron job quotidien pour reporter l'usage :

```bash
# Tous les jours à 2h00
0 2 * * * curl -X POST https://votre-domaine/api/cron/report-usage \
  -H "Authorization: Bearer $CRON_SECRET"
```

Ou utiliser le service cron existant dans docker-compose.

## Fonctionnement

1. **Premier admin se connecte** → Création automatique de l'organisation
2. **Enregistrement billing** → Appel automatique à `/api/organizations/register`
3. **Subscription Stripe** → Créée avec période d'essai de 4 jours
4. **Rapport quotidien** → Cron job envoie `user_count` chaque jour
5. **Facturation automatique** → Stripe agrège et facture mensuellement
6. **Webhooks Stripe** → Synchronisent les changements de statut

## Notes

- Pas de hard limits : les clients peuvent ajouter/retirer des users librement
- Facturation basée sur l'usage réel : Stripe facture automatiquement
- Période d'essai : 4 jours gratuits, puis facturation normale
- Compatible firewall/VPN : toutes les communications sont sortantes depuis les instances
