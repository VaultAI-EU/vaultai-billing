import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-10-29.clover",
});

// Price IDs depuis config/defaults.ts de vaultai_v2
export const STRIPE_PRICES = {
  MANAGED_CLOUD_MONTHLY: process.env.STRIPE_PRICE_MANAGED_MONTHLY || "price_1SOKmMBuLPvVxFwjVSr3v3ni",
  MANAGED_CLOUD_YEARLY: process.env.STRIPE_PRICE_MANAGED_YEARLY || "price_1SOKogBuLPvVxFwjYbNoYI8N",
  SELF_HOSTED_MONTHLY: process.env.STRIPE_PRICE_SELF_HOSTED_MONTHLY || "price_1SOKniBuLPvVxFwjRUrUouaO",
  SELF_HOSTED_YEARLY: process.env.STRIPE_PRICE_SELF_HOSTED_YEARLY || "price_1SOKniBuLPvVxFwj9rqOv0Or",
} as const;

// Nom du meter Stripe pour tracker les users actifs
export const METER_EVENT_NAME = "active_users";

