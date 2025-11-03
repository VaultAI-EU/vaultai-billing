# Setup Local pour Billing

## Variables d'environnement locales

Créer un fichier `.env.local` avec :

```bash
# Database
DATABASE_URL=postgresql://postgres:ggKe8jMcZSkRletu@db.bjslvpmkihjjfzmotitz.supabase.co:5432/postgres

# Better Auth
BETTER_AUTH_SECRET=6K3dvUX7rM4QP1R6y5bp7pqlflSVxCZAE8SDX0uqvok=
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000

# Stripe (optionnel pour dev local)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Commandes disponibles

```bash
# Installer les dépendances
pnpm install

# Exécuter les migrations
pnpm db:migrate

# Démarrer le serveur de développement
pnpm dev
```

## Créer le premier utilisateur admin

L'utilisateur admin doit être créé via la page de login sur http://localhost:3000/login ou directement en base de données avec Better Auth.

