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

# Créer l'utilisateur admin (via API après démarrage du serveur)
# Note: L'utilisateur admin doit être créé via la page de login ou directement en base de données
# Body: {"email":"hello@vaultai.eu","password":"hugoDO1967!","name":"Admin"}

# Démarrer le serveur de développement
pnpm dev
```

## Créer le premier utilisateur admin

1. Démarrer le serveur : `pnpm dev`
2. Appeler l'endpoint API :
```bash
# Pour créer un utilisateur admin, utilisez la page de login ou créez-le directement en base de données
  -H "Content-Type: application/json" \
  -d '{"email":"hello@vaultai.eu","password":"hugoDO1967!","name":"Admin VaultAI"}'
```

Ou utiliser la page de sign-up sur http://localhost:3000/login après avoir démarré le serveur.

