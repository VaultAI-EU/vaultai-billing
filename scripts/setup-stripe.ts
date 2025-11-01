/**
 * Script de setup Stripe pour VaultAI Billing
 * 
 * Ce script crée le meter Stripe et configure les prices pour usage-based billing
 * À exécuter une seule fois après la création du compte Stripe
 * 
 * Usage: pnpm tsx scripts/setup-stripe.ts
 */

import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in .env");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

async function setupStripe() {
  console.log("🔧 Setting up Stripe for VaultAI Billing...\n");

  try {
    // 1. Créer le Meter pour tracker les users actifs
    console.log("📊 Creating meter for active users...");
    const meter = await stripe.billing.meters.create({
      display_name: "Active Users",
      event_name: "active_users",
      default_aggregation: {
        formula: "sum", // Somme des users actifs par période
      },
    });
    console.log(`✅ Meter created: ${meter.id}`);
    console.log(`   Event name: ${meter.event_name}`);
    console.log(`   Formula: ${meter.default_aggregation.formula}\n`);

    // 2. Créer le Product Managed Cloud
    console.log("💼 Creating Managed Cloud product...");
    const managedCloudProduct = await stripe.products.create({
      name: "VaultAI Managed Cloud",
      description: "Managed hosting and infrastructure with AI inference included",
    });
    console.log(`✅ Product created: ${managedCloudProduct.id}\n`);

    // 3. Créer les Prices Managed Cloud (monthly et yearly)
    console.log("💰 Creating Managed Cloud prices...");
    
    const managedMonthlyPrice = await stripe.prices.create({
      currency: "eur",
      product: managedCloudProduct.id,
      billing_scheme: "per_unit",
      recurring: {
        interval: "month",
        usage_type: "metered",
      },
      unit_amount: 4500, // 45€ en centimes
    });
    console.log(`✅ Managed Cloud Monthly price: ${managedMonthlyPrice.id} (45€/user/month)`);

    const managedYearlyPrice = await stripe.prices.create({
      currency: "eur",
      product: managedCloudProduct.id,
      billing_scheme: "per_unit",
      recurring: {
        interval: "year",
        usage_type: "metered",
      },
      unit_amount: 38250, // 45€ * 12 * 0.85 = 459€/year, arrondi à 38250 centimes (425€/user/year)
    });
    console.log(`✅ Managed Cloud Yearly price: ${managedYearlyPrice.id} (425€/user/year)\n`);

    // 4. Créer le Product Self-Hosted
    console.log("🏠 Creating Self-Hosted product...");
    const selfHostedProduct = await stripe.products.create({
      name: "VaultAI Self-Hosted",
      description: "Deploy VaultAI on your own infrastructure",
    });
    console.log(`✅ Product created: ${selfHostedProduct.id}\n`);

    // 5. Créer les Prices Self-Hosted (monthly et yearly)
    console.log("💰 Creating Self-Hosted prices...");
    
    const selfHostedMonthlyPrice = await stripe.prices.create({
      currency: "eur",
      product: selfHostedProduct.id,
      billing_scheme: "per_unit",
      recurring: {
        interval: "month",
        usage_type: "metered",
      },
      unit_amount: 2000, // 20€ en centimes
    });
    console.log(`✅ Self-Hosted Monthly price: ${selfHostedMonthlyPrice.id} (20€/user/month)`);

    const selfHostedYearlyPrice = await stripe.prices.create({
      currency: "eur",
      product: selfHostedProduct.id,
      billing_scheme: "per_unit",
      recurring: {
        interval: "year",
        usage_type: "metered",
      },
      unit_amount: 17000, // 20€ * 12 * 0.85 = 204€/year, arrondi à 17000 centimes (170€/user/year)
    });
    console.log(`✅ Self-Hosted Yearly price: ${selfHostedYearlyPrice.id} (170€/user/year)\n`);

    // 6. Résumé
    console.log("\n📋 Setup Summary:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Meter ID: ${meter.id}`);
    console.log(`Meter Event Name: ${meter.event_name}`);
    console.log("\nManaged Cloud:");
    console.log(`  Monthly: ${managedMonthlyPrice.id}`);
    console.log(`  Yearly: ${managedYearlyPrice.id}`);
    console.log("\nSelf-Hosted:");
    console.log(`  Monthly: ${selfHostedMonthlyPrice.id}`);
    console.log(`  Yearly: ${selfHostedYearlyPrice.id}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("⚠️  IMPORTANT: Add these IDs to your .env file:");
    console.log(`STRIPE_PRICE_MANAGED_MONTHLY=${managedMonthlyPrice.id}`);
    console.log(`STRIPE_PRICE_MANAGED_YEARLY=${managedYearlyPrice.id}`);
    console.log(`STRIPE_PRICE_SELF_HOSTED_MONTHLY=${selfHostedMonthlyPrice.id}`);
    console.log(`STRIPE_PRICE_SELF_HOSTED_YEARLY=${selfHostedYearlyPrice.id}\n`);

    console.log("✅ Stripe setup completed successfully!");
  } catch (error) {
    console.error("❌ Error setting up Stripe:", error);
    throw error;
  }
}

setupStripe()
  .then(() => {
    console.log("\n🎉 All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Setup failed:", error);
    process.exit(1);
  });

