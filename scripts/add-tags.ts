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
  console.log("🚀 Migration: Ajout de tags...");

  try {
    // Ajouter la colonne tags si elle n'existe pas
    await sql`
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
    `;
    console.log("✅ Colonne tags ajoutée (si elle n'existait pas)");

    // Mettre à jour les valeurs NULL en tableau vide
    const updateResult = await sql`
      UPDATE organizations SET tags = '[]'::jsonb WHERE tags IS NULL;
    `;
    console.log(`✅ Valeurs NULL mises à jour (${updateResult.count} lignes)`);

    // Vérification finale
    const columns = await sql`
      SELECT 
          column_name, 
          data_type, 
          is_nullable,
          column_default
      FROM information_schema.columns 
      WHERE table_name = 'organizations' 
      AND column_name = 'tags';
    `;

    console.log("\n📋 Colonne tags:");
    columns.forEach((col) => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable}, default: ${col.column_default})`);
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

