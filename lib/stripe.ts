import Stripe from "stripe";

// Lazy initialization pour éviter l'erreur au build time
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeInstance = new Stripe(secretKey, {
      apiVersion: "2024-10-28.acacia",
    });
  }
  return stripeInstance;
}

// Export pour compatibilité
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
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

