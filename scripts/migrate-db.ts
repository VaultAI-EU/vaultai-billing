import { db } from "@/lib/db";
import { organizations, usageReports } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("🚀 Starting database migration...");

  try {
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
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
