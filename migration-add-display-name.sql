-- Migration pour ajouter le champ display_name aux organisations
-- À exécuter dans Supabase SQL Editor ou via psql

-- Ajouter la colonne display_name si elle n'existe pas
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'display_name'
    ) THEN
        ALTER TABLE organizations ADD COLUMN display_name TEXT;
        RAISE NOTICE 'Colonne display_name ajoutée';
    END IF;
END $$;

-- Vérification finale
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name IN ('name', 'display_name')
ORDER BY ordinal_position;

