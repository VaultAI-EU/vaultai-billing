import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

// Charger les variables d'environnement
config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(process.env.DATABASE_URL);
const db = drizzle(client);

async function migrate() {
  console.log("🚀 Starting database migration...");

  try {
    // Créer les tables Better Auth avec snake_case en DB
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "user" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        name TEXT,
        email VARCHAR(255) NOT NULL UNIQUE,
        email_verified BOOLEAN DEFAULT false NOT NULL,
        image TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        role VARCHAR(20) DEFAULT 'admin' NOT NULL
      );
    `);
    console.log("✅ Table 'user' created");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        expires_at TIMESTAMP NOT NULL,
        token TEXT NOT NULL UNIQUE,
        ip_address TEXT,
        user_agent TEXT,
        user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("✅ Table 'session' created");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS account (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        access_token TEXT,
        refresh_token TEXT,
        id_token TEXT,
        access_token_expires_at TIMESTAMP,
        refresh_token_expires_at TIMESTAMP,
        scope TEXT,
        password TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("✅ Table 'account' created");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS verification (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Table 'verification' created");

    // Créer la table organizations
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        billing_token TEXT NOT NULL UNIQUE,
        stripe_customer_id TEXT UNIQUE,
        stripe_subscription_id TEXT UNIQUE,
        deployment_type VARCHAR(20) NOT NULL DEFAULT 'on-premise',
        plan_type VARCHAR(20),
        subscription_status VARCHAR(20) DEFAULT 'trial',
        trial_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("✅ Table 'organizations' created");

    // Créer la table usage_reports
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS usage_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_count INTEGER NOT NULL,
        deployment_type VARCHAR(20) NOT NULL,
        reported_at TIMESTAMP DEFAULT NOW() NOT NULL,
        stripe_meter_event_id TEXT
      );
    `);
    console.log("✅ Table 'usage_reports' created");

    // Créer les index
    // Créer les index pour Better Auth
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);
    `);
    console.log("✅ Index 'idx_session_user_id' created");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id);
    `);
    console.log("✅ Index 'idx_account_user_id' created");

    // Créer les index pour organizations
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_organizations_billing_token 
      ON organizations(billing_token);
    `);
    console.log("✅ Index 'idx_organizations_billing_token' created");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id 
      ON organizations(stripe_customer_id);
    `);
    console.log("✅ Index 'idx_organizations_stripe_customer_id' created");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_usage_reports_organization_id 
      ON usage_reports(organization_id);
    `);
    console.log("✅ Index 'idx_usage_reports_organization_id' created");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_usage_reports_reported_at 
      ON usage_reports(reported_at);
    `);
    console.log("✅ Index 'idx_usage_reports_reported_at' created");

    console.log("\n🎉 Migration completed successfully!");
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    await client.end();
    process.exit(1);
  }
}

migrate();
