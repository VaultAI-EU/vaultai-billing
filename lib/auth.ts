import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  // Better Auth génère les IDs automatiquement pour session et account
  // Pas besoin de generateId: false
  user: {
    fields: {
      createdAt: "created_at",
      updatedAt: "updated_at",
      emailVerified: "email_verified",
      image: "image",
    },
  },
  // Note: Better Auth utilise directement les noms de propriétés du schéma Drizzle
  // pour session, account et verification. Pas besoin de mapping explicite.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Pour simplifier l'accès admin
  },
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "https://billing.vaultai.eu",
    "http://localhost:3000",
    "http://localhost:3001", // Port alternatif si 3000 est occupé
  ],
  baseURL: process.env.BETTER_AUTH_URL || "https://billing.vaultai.eu",
  basePath: "/api/auth",
});

// Fonction pour authentifier les organisations (utilisée par les API routes métier)
export async function authenticateOrganization(
  billingToken: string
): Promise<typeof schema.organizations.$inferSelect | null> {
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.billing_token, billingToken))
    .limit(1);

  return org || null;
}

// Fonction pour générer un token unique pour une organisation
export function generateBillingToken(): string {
  return `vaultai_${crypto
    .randomUUID()
    .replace(/-/g, "")}_${Date.now().toString(36)}`;
}
