# Configuration Vercel pour billing.vaultai.eu

## Variables d'environnement à configurer

Allez sur [Vercel Dashboard](https://vercel.com) > Projet `billing` > Settings > Environment Variables

### 1. DATABASE_URL
```
postgresql://postgres.xxx:xxx@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```
(Même valeur que dans `.env.local`)

### 2. BETTER_AUTH_SECRET
```
Générer avec: openssl rand -base64 32
```

### 3. BETTER_AUTH_URL
```
https://billing.vaultai.eu
```

### 4. NEXT_PUBLIC_BETTER_AUTH_URL
```
https://billing.vaultai.eu
```

### 5. STRIPE_SECRET_KEY
```
sk_test_xxx (mode test) ou sk_live_xxx (mode production)
```
Récupérer depuis [Stripe Dashboard](https://dashboard.stripe.com/apikeys)

### 6. Prix Stripe (optionnel si valeurs par défaut dans code)
```
STRIPE_PRICE_MANAGED_MONTHLY=price_1SOKmMBuLPvVxFwjVSr3v3ni
STRIPE_PRICE_MANAGED_YEARLY=price_1SOKogBuLPvVxFwjYbNoYI8N
STRIPE_PRICE_SELF_HOSTED_MONTHLY=price_1SOKniBuLPvVxFwjRUrUouaO
STRIPE_PRICE_SELF_HOSTED_YEARLY=price_1SOKniBuLPvVxFwj9rqOv0Or
```

### 7. CRON_SECRET (optionnel)
```
Même valeur que dans vaultai_v2 pour authentifier les cron jobs
```

## Après configuration

1. Redéployer le projet ou attendre le prochain déploiement automatique
2. Tester avec: `curl https://billing.vaultai.eu/api/health`
3. Vérifier les logs dans Vercel Dashboard

## Commandes utiles

```bash
# Tester l'endpoint de santé
curl https://billing.vaultai.eu/api/health

# Tester l'enregistrement d'une organisation
curl -X POST https://billing.vaultai.eu/api/organizations/register \
  -H "Content-Type: application/json" \
  -d '{
    "organization_id": "123e4567-e89b-12d3-a456-426614174000",
    "organization_name": "Test Org",
    "email": "test@vaultai.eu",
    "deployment_type": "on-premise",
    "plan_type": "managed-cloud"
  }'
```
