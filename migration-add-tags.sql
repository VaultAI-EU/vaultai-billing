-- Migration pour ajouter le champ tags aux organisations
-- À exécuter dans Supabase SQL Editor ou via psql

-- Ajouter la colonne tags si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'tags'
    ) THEN
        ALTER TABLE organizations ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Colonne tags ajoutée';
    END IF;
END $$;

-- Mettre à jour les valeurs NULL en tableau vide
UPDATE organizations SET tags = '[]'::jsonb WHERE tags IS NULL;

-- Vérification finale
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name = 'tags';

