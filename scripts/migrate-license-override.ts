/**
 * Script to add license_override columns to organizations table
 * Run with: pnpm tsx scripts/migrate-license-override.ts
 */

import { config } from "dotenv";
import postgres from "postgres";

// Load environment variables
config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not set");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function migrate() {
  console.log("🚀 Running migration: add license_override columns...");

  try {
    // Add license_override column
    await sql`
      ALTER TABLE organizations 
      ADD COLUMN IF NOT EXISTS license_override VARCHAR(20)
    `;
    console.log("✅ Added license_override column");

    // Add license_override_reason column
    await sql`
      ALTER TABLE organizations 
      ADD COLUMN IF NOT EXISTS license_override_reason TEXT
    `;
    console.log("✅ Added license_override_reason column");

    console.log("🎉 Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
