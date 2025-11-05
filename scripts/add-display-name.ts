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
  console.log("🚀 Migration: Ajout de display_name...");

  try {
    // Ajouter la colonne display_name si elle n'existe pas
    await sql`
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
    `;
    console.log("✅ Colonne display_name ajoutée (si elle n'existait pas)");

    // Vérification finale
    const columns = await sql`
      SELECT 
          column_name, 
          data_type, 
          is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'organizations' 
      AND column_name IN ('name', 'display_name')
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

