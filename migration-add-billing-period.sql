-- Migration pour remplacer plan_type par billing_period
-- À exécuter dans Supabase SQL Editor ou via psql

-- 1. Ajouter la colonne billing_period si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'billing_period'
    ) THEN
        ALTER TABLE organizations ADD COLUMN billing_period VARCHAR(20);
        RAISE NOTICE 'Colonne billing_period ajoutée';
    END IF;
END $$;

-- 2. Migrer les données existantes de plan_type vers billing_period si nécessaire
-- (conversion logique : on assume monthly par défaut pour les anciennes données)
UPDATE organizations 
SET billing_period = 'monthly' 
WHERE billing_period IS NULL AND plan_type IS NOT NULL;

-- 3. Supprimer la colonne plan_type si elle existe
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'plan_type'
    ) THEN
        ALTER TABLE organizations DROP COLUMN plan_type;
        RAISE NOTICE 'Colonne plan_type supprimée';
    END IF;
END $$;

-- Vérification finale
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name IN ('deployment_type', 'billing_period', 'plan_type')
ORDER BY ordinal_position;

