# Instructions pour exécuter les migrations

## Problème de connexion

Si vous obtenez une erreur `ENOTFOUND`, cela signifie que votre machine locale ne peut pas accéder au serveur Supabase. Voici les solutions :

### Option 1 : Utiliser le pooler de connexion Supabase

Dans Supabase Dashboard → Settings → Database → Connection string, utilisez le **Connection Pooler** au lieu de Direct connection :

```
postgresql://postgres.xxx:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

### Option 2 : Vérifier les paramètres réseau Supabase

1. Aller dans Supabase Dashboard → Settings → Database
2. Vérifier que l'IP de votre machine n'est pas bloquée
3. Activez "Allow connections from any IP" temporairement pour les migrations

### Option 3 : Exécuter depuis un environnement avec accès réseau

Exécutez les migrations depuis :
- Un serveur qui a accès à Supabase
- Un container Docker
- Via Supabase SQL Editor directement

## Commandes disponibles

Une fois la connexion établie :

```bash
# 1. Créer les tables
pnpm db:migrate

# 2. Créer l'utilisateur admin
pnpm create:admin
```

## Alternative : Migration SQL directe

Si vous ne pouvez pas connecter depuis votre machine, vous pouvez copier le SQL depuis `scripts/migrate-db.ts` et l'exécuter directement dans Supabase SQL Editor.

