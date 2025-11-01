# Variables d'environnement à configurer dans Vercel

## Variables requises pour le déploiement

Configurez ces variables dans Vercel Dashboard → Settings → Environment Variables :

### Stripe (Production)
- `STRIPE_SECRET_KEY` : Votre clé secrète Stripe (sk_live_...)
- `STRIPE_WEBHOOK_SECRET` : Secret du webhook Stripe (whsec_...)

### Stripe Price IDs (optionnel, valeurs par défaut dans lib/stripe.ts)
- `STRIPE_PRICE_MANAGED_MONTHLY` : Price ID pour Managed Cloud mensuel
- `STRIPE_PRICE_MANAGED_YEARLY` : Price ID pour Managed Cloud annuel
- `STRIPE_PRICE_SELF_HOSTED_MONTHLY` : Price ID pour Self-Hosted mensuel
- `STRIPE_PRICE_SELF_HOSTED_YEARLY` : Price ID pour Self-Hosted annuel

### Base de données
- `DATABASE_URL` : URL de connexion PostgreSQL (format: postgresql://user:password@host:port/database)

### Next.js
- `NEXT_PUBLIC_APP_URL` : URL publique de l'application (https://billing.vaultai.eu)

## Configuration dans Vercel

1. Allez sur https://vercel.com/vault-ai/billing/settings/environment-variables
2. Ajoutez chaque variable pour l'environnement "Production"
3. Après ajout, redéployez le projet

## Après le premier déploiement

1. Obtenez l'URL de votre déploiement (ex: https://billing-vaultai-eu.vercel.app)
2. Configurez le webhook Stripe :
   - Aller dans Stripe Dashboard → Webhooks
   - Endpoint URL : `https://votre-domaine.com/api/stripe/webhook`
   - Événements à sélectionner :
     - customer.subscription.created
     - customer.subscription.updated
     - customer.subscription.deleted
     - invoice.payment_failed
     - invoice.payment_succeeded
   - Copier le webhook secret dans `STRIPE_WEBHOOK_SECRET`

3. Configurez le domaine personnalisé :
   - Vercel Dashboard → Settings → Domains
   - Ajouter `billing.vaultai.eu`
   - Configurer le DNS selon les instructions Vercel

