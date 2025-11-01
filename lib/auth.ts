import { eq } from "drizzle-orm";
import { db, organizations } from "./db";

/**
 * Valide le token d'authentification et retourne l'organisation associée
 */
export async function authenticateOrganization(
  billingToken: string
): Promise<typeof organizations.$inferSelect | null> {
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.billing_token, billingToken))
    .limit(1);

  return org || null;
}

/**
 * Génère un token unique pour une organisation
 */
export function generateBillingToken(): string {
  return `vaultai_${crypto.randomUUID().replace(/-/g, "")}_${Date.now().toString(36)}`;
}

