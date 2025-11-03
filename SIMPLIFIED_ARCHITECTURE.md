# Architecture Simplifiée du Système de Billing

## 🎯 Principe

**1 Instance VaultAI = 1 Organisation = 1 Client à facturer**

Chaque instance VaultAI a une seule organisation qui regroupe tous ses utilisateurs.
Le système de billing reçoit automatiquement les rapports d'usage et tu lies manuellement chaque organisation à un customer Stripe.

## 🔒 Sécurité

### Token API Universel (Hard-codé)

Toutes les instances VaultAI utilisent le **même token API** pour s'authentifier auprès du service billing.
Ce token est **hard-codé dans le code source** pour éviter toute manipulation par les clients.

```typescript
// vaultai_v2/lib/billing/config.ts
export const BILLING_API_TOKEN = "vaultai_universal_billing_api_2024_production_key_XyZ9mP2nQ7wK";

// billing/lib/config.ts
export const BILLING_API_TOKEN = "vaultai_universal_billing_api_2024_production_key_XyZ9mP2nQ7wK";
// ⚠️ Les deux doivent être identiques !
```

**Pourquoi ce token ?**
- Empêche n'importe qui d'envoyer des fausses données à ton API billing
- Authentifie que la requête vient bien d'une instance VaultAI légitime
- Simple : même token pour toutes les instances, pas besoin de configuration par client

## 📊 Flow Complet

### 1. Instance VaultAI envoie automatiquement les stats (Cron quotidien)

```bash
# Chaque jour à 3h du matin (configuré sur chaque instance)
curl -X POST https://billing.vaultai.eu/api/usage-report \
  -H "Authorization: Bearer vaultai_universal_billing_api_2024_production_key_XyZ9mP2nQ7wK" \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "abc-123-def-456",
    "organization_name": "Acme Corp",
    "instance_url": "acme.vaultai.eu",
    "user_count": 45,
    "timestamp": "2024-11-03T03:00:00Z"
  }'
```

**Réponse si organisation pas encore liée :**
```json
{
  "success": true,
  "message": "Usage report received",
  "report_id": "report-xyz-789",
  "organization_status": "pending"
}
```

### 2. Tu vois les nouvelles organisations dans ton dashboard admin

```bash
# Lister toutes les organisations
curl -X GET https://billing.vaultai.eu/api/admin/organizations \
  -H "Cookie: your-admin-session"
```

**Réponse :**
```json
{
  "summary": {
    "total": 5,
    "linked": 3,
    "pending": 2
  },
  "organizations": {
    "pending": [
      {
        "id": "abc-123-def-456",
        "name": "Acme Corp",
        "instance_url": "acme.vaultai.eu",
        "subscription_status": "pending",
        "created_at": "2024-11-01T10:00:00Z"
      },
      {
        "id": "xyz-789-uvw-012",
        "name": "Beta SARL",
        "instance_url": "beta.vaultai.eu",
        "subscription_status": "pending",
        "created_at": "2024-11-02T14:30:00Z"
      }
    ],
    "linked": [
      {
        "id": "old-org-123",
        "name": "Production Inc",
        "instance_url": "prod.vaultai.eu",
        "stripe_customer_id": "cus_ABC123",
        "stripe_subscription_id": "sub_XYZ789",
        "deployment_type": "on-premise",
        "plan_type": "self-hosted",
        "subscription_status": "active",
        "admin_email": "billing@production.com",
        "created_at": "2024-10-15T08:00:00Z"
      }
    ]
  }
}
```

### 3. Tu lies manuellement une organisation à Stripe

```bash
# Lier Acme Corp à Stripe
curl -X POST https://billing.vaultai.eu/api/admin/organizations/abc-123-def-456/link \
  -H "Cookie: your-admin-session" \
  -H "Content-Type: application/json" \
  -d '{
    "admin_email": "billing@acme.com",
    "deployment_type": "on-premise",
    "plan_type": "managed-cloud",
    "trial_days": 4
  }'
```

**Ce qui se passe :**
1. ✅ Création d'un customer Stripe avec l'email fourni
2. ✅ Création d'une subscription Stripe avec période d'essai
3. ✅ Liaison de l'organization_id avec le customer Stripe
4. ✅ Définition du deployment_type et plan_type (que toi seul connais)
5. ✅ Les prochains rapports d'usage déclencheront la facturation automatique

**Réponse :**
```json
{
  "success": true,
  "message": "Organization linked to Stripe successfully",
  "organization": {
    "id": "abc-123-def-456",
    "name": "Acme Corp",
    "stripe_customer_id": "cus_NEW123",
    "stripe_subscription_id": "sub_NEW789",
    "subscription_status": "trial",
    "trial_end": "2024-11-07T03:00:00Z"
  }
}
```

### 4. Les futurs rapports d'usage déclenchent la facturation

Une fois lié, chaque rapport d'usage :
- ✅ Est automatiquement enregistré dans la DB
- ✅ Envoie un meter event à Stripe (si configuré)
- ✅ Stripe facture automatiquement selon le nombre d'users

## 🗂️ Structure des Tables

### Table `organizations` (billing)

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY,                    -- organization_id depuis VaultAI
  name TEXT NOT NULL,                     -- Nom de l'organisation
  instance_url TEXT,                      -- URL de l'instance (ex: acme.vaultai.eu)
  
  -- Stripe (NULL si pas encore lié)
  stripe_customer_id TEXT UNIQUE,         -- Customer Stripe
  stripe_subscription_id TEXT UNIQUE,     -- Subscription Stripe
  
  -- Configuration (définie manuellement par admin)
  deployment_type VARCHAR(20),            -- "on-premise" | "managed-cloud"
  plan_type VARCHAR(20),                  -- "managed-cloud" | "self-hosted"
  subscription_status VARCHAR(20) DEFAULT 'pending', -- "pending" | "trial" | "active" | ...
  trial_end TIMESTAMP,
  
  -- Contact
  admin_email TEXT,                       -- Email pour facturation
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Table `usage_reports` (billing)

```sql
CREATE TABLE usage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_count INTEGER NOT NULL,
  deployment_type VARCHAR(20) NOT NULL,   -- Snapshot du type au moment du report
  reported_at TIMESTAMP DEFAULT NOW(),
  stripe_meter_event_id TEXT              -- ID de l'event Stripe envoyé
);
```

### Table `organization` (vaultai_v2) - Simplifiée

```sql
CREATE TABLE "Organization" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  allowed_domains TEXT[],
  auth_methods TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  -- Supprimé: billing_token
  -- Supprimé: deployment_type
);
```

## 🚀 Déploiement

### Côté VaultAI (instances)

1. Les fichiers sont déjà à jour avec le token universel
2. Le cron quotidien envoie automatiquement les rapports
3. **Aucune configuration requise côté client** ✅

### Côté Billing

1. Appliquer les migrations de base de données
2. Déployer le nouveau code sur Vercel
3. Configurer les variables d'environnement Vercel (inchangées)

## 📝 Variables d'Environnement

### vaultai_v2 (aucune nouvelle variable)
```bash
CRON_SECRET=xxx                          # Déjà existant
NEXT_PUBLIC_APP_URL=https://acme.vaultai.eu  # Déjà existant
```

### billing (inchangées)
```bash
DATABASE_URL=postgresql://...
STRIPE_SECRET_KEY=sk_xxx
BETTER_AUTH_SECRET=xxx
BETTER_AUTH_URL=https://billing.vaultai.eu
NEXT_PUBLIC_BETTER_AUTH_URL=https://billing.vaultai.eu
```

## 🔄 Migration des Organisations Existantes

Les organisations créées **avant** cette mise à jour :
- ✅ Enverront automatiquement leurs rapports d'usage dès le prochain cron
- ✅ Apparaîtront dans la liste "pending" du dashboard admin
- ✅ Tu les lieras manuellement à Stripe quand tu le souhaites

**Aucune action manuelle requise côté instances** ✅

## 🎨 Interface Admin (À développer)

Dashboard simple pour gérer les organisations :

```
📊 Billing Dashboard

🔴 Organisations en attente de liaison (2)
┌──────────────┬──────────────────┬────────┬─────────────┬──────────┐
│ Nom          │ Instance         │ Users  │ Depuis      │ Action   │
├──────────────┼──────────────────┼────────┼─────────────┼──────────┤
│ Acme Corp    │ acme.vaultai.eu  │ 45     │ 01/11/2024  │ [Lier]   │
│ Beta SARL    │ beta.vaultai.eu  │ 120    │ 02/11/2024  │ [Lier]   │
└──────────────┴──────────────────┴────────┴─────────────┴──────────┘

✅ Organisations facturées (3)
┌──────────────┬──────────────────┬────────┬─────────────┬───────────┐
│ Nom          │ Instance         │ Users  │ Plan        │ Status    │
├──────────────┼──────────────────┼────────┼─────────────┼───────────┤
│ Production   │ prod.vaultai.eu  │ 230    │ Managed     │ Active    │
│ Startup Co   │ start.vaultai.eu │ 15     │ Self-hosted │ Trial     │
│ Enterprise   │ ent.vaultai.eu   │ 500    │ Managed     │ Active    │
└──────────────┴──────────────────┴────────┴─────────────┴───────────┘
```

## ✅ Avantages de cette Architecture

1. **Simple** : Un seul token API universel, pas de configuration par instance
2. **Sécurisé** : Token hard-codé, pas modifiable par les clients
3. **Flexible** : Tu gères manuellement quel client a quel forfait
4. **Automatique** : Une fois lié, la facturation est automatique
5. **Zero config client** : Les clients n'ont rien à configurer
6. **Transparent** : Tu vois clairement qui envoie des rapports et qui doit être lié

## 🆚 Comparaison Ancien vs Nouveau

| Aspect | Ancien (Complexe) | Nouveau (Simple) |
|--------|-------------------|------------------|
| Authentification | billing_token par org | Token universel |
| Configuration client | Enregistrement initial requis | Aucune |
| Gestion des plans | Envoyé par l'instance | Défini par admin |
| Liaison Stripe | Automatique | Manuelle |
| Flexibilité | Rigide | Maximale |

