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
  advanced: {
    database: {
      generateId: false,
    },
  },
  user: {
    fields: {
      createdAt: "created_at",
      updatedAt: "updated_at",
      emailVerified: "email_verified",
      image: "image",
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Pour simplifier l'accès admin
  },
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "https://billing.vaultai.eu",
    "http://localhost:3000",
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
  return `vaultai_${crypto.randomUUID().replace(/-/g, "")}_${Date.now().toString(36)}`;
}
