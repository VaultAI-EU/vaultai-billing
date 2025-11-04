import { config } from "dotenv";
import { existsSync } from "fs";
import postgres from "postgres";

// Détection intelligente du fichier .env
const getEnvFile = () => {
  if (process.env.NODE_ENV === "production") {
    return ".env.production";
  }
  if (existsSync(".env.local")) {
    return ".env.local";
  }
  if (existsSync(".env.production")) {
    return ".env.production";
  }
  return ".env";
};

const envFile = getEnvFile();
console.log(`🔧 Utilisation du fichier: ${envFile}`);

config({ path: envFile });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL n'est pas défini dans", envFile);
  process.exit(1);
}

const sql = postgres(databaseUrl);

async function migrate() {
  console.log("🚀 Migration: Ajout de billing_period...");

  try {
    // 1. Ajouter la colonne billing_period si elle n'existe pas
    await sql`
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
    `;
    console.log("✅ Colonne billing_period ajoutée (si elle n'existait pas)");

    // 2. Migrer les données existantes de plan_type vers billing_period si nécessaire
    const result = await sql`
      UPDATE organizations 
      SET billing_period = 'monthly' 
      WHERE billing_period IS NULL AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organizations' AND column_name = 'plan_type'
      );
    `;
    console.log(`✅ Données migrées (${result.count} lignes)`);

    // 3. Supprimer la colonne plan_type si elle existe
    await sql`
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
    `;
    console.log("✅ Colonne plan_type supprimée (si elle existait)");

    // Vérification finale
    const columns = await sql`
      SELECT 
          column_name, 
          data_type, 
          is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'organizations' 
      AND column_name IN ('deployment_type', 'billing_period', 'plan_type')
      ORDER BY ordinal_position;
    `;

    console.log("\n📋 Colonnes de la table organizations:");
    columns.forEach((col) => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    console.log("\n🎉 Migration terminée avec succès !");
  } catch (error) {
    console.error("❌ Erreur lors de la migration:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();

