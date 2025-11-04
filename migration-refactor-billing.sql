-- Migration pour refactoriser le système de billing
-- Supprime billing_token et ajoute les nouvelles colonnes
-- À exécuter dans Supabase SQL Editor ou via psql

-- 1. Ajouter les nouvelles colonnes si elles n'existent pas
DO $$ 
BEGIN
    -- Ajouter instance_url si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'instance_url'
    ) THEN
        ALTER TABLE organizations ADD COLUMN instance_url TEXT;
        RAISE NOTICE 'Colonne instance_url ajoutée';
    END IF;

    -- Ajouter admin_email si elle n'existe pas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'admin_email'
    ) THEN
        ALTER TABLE organizations ADD COLUMN admin_email TEXT;
        RAISE NOTICE 'Colonne admin_email ajoutée';
    END IF;
END $$;

-- 2. Modifier deployment_type pour qu'il soit nullable
ALTER TABLE organizations 
    ALTER COLUMN deployment_type DROP NOT NULL,
    ALTER COLUMN deployment_type DROP DEFAULT;

-- 3. Modifier subscription_status pour avoir DEFAULT 'pending'
ALTER TABLE organizations 
    ALTER COLUMN subscription_status SET DEFAULT 'pending';

-- Mettre à jour les valeurs existantes de 'trial' à 'pending' si nécessaire
UPDATE organizations 
SET subscription_status = 'pending' 
WHERE subscription_status = 'trial' AND stripe_customer_id IS NULL;

-- 4. Supprimer l'index sur billing_token s'il existe
DROP INDEX IF EXISTS idx_organizations_billing_token;

-- 5. Supprimer la colonne billing_token si elle existe
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'billing_token'
    ) THEN
        -- Supprimer la contrainte UNIQUE d'abord
        ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_billing_token_key;
        -- Supprimer la colonne
        ALTER TABLE organizations DROP COLUMN billing_token;
        RAISE NOTICE 'Colonne billing_token supprimée';
    END IF;
END $$;

-- Vérification finale
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'organizations' 
ORDER BY ordinal_position;

