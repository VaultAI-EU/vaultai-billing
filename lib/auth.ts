import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";

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
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "https://billing.vaultai.eu",
    "http://localhost:3000",
  ],
  baseURL: process.env.BETTER_AUTH_URL || "https://billing.vaultai.eu",
  basePath: "/api/auth",
});
