import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  varchar,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Tables Better Auth générées par @better-auth/cli
// Note: Better Auth utilise camelCase pour les propriétés du schéma Drizzle
// mais snake_case pour les colonnes DB (via le deuxième paramètre)
export const user = pgTable("user", {
  id: uuid("id").primaryKey().notNull().defaultRandom(), // UUID au lieu de text pour correspondre à notre DB
  name: text("name").notNull(), // Better Auth requiert name.notNull()
  email: text("email").notNull().unique(),
  email_verified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  role: varchar("role", { length: 20 }).default("admin").notNull(), // Champ supplémentaire pour le rôle admin
});

export const session = pgTable("session", {
  id: uuid("id").primaryKey().defaultRandom(), // UUID au lieu de text
  expiresAt: timestamp("expires_at").notNull(), // camelCase pour Better Auth
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(), // camelCase pour Better Auth
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(), // camelCase pour Better Auth
  ipAddress: text("ip_address"), // camelCase pour Better Auth
  userAgent: text("user_agent"), // camelCase pour Better Auth
  userId: uuid("user_id") // camelCase pour Better Auth, UUID pour correspondre à notre DB
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: uuid("id").primaryKey().defaultRandom(), // UUID au lieu de text
  accountId: text("account_id").notNull(), // camelCase pour Better Auth
  providerId: text("provider_id").notNull(), // camelCase pour Better Auth
  userId: uuid("user_id") // camelCase pour Better Auth, UUID pour correspondre à notre DB
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), // camelCase pour Better Auth
  refreshToken: text("refresh_token"), // camelCase pour Better Auth
  idToken: text("id_token"), // camelCase pour Better Auth
  accessTokenExpiresAt: timestamp("access_token_expires_at"), // camelCase pour Better Auth
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"), // camelCase pour Better Auth
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(), // camelCase pour Better Auth
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => new Date())
    .notNull(), // camelCase pour Better Auth
});

export const verification = pgTable("verification", {
  id: uuid("id").primaryKey().defaultRandom(), // UUID au lieu de text
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(), // camelCase pour Better Auth
  createdAt: timestamp("created_at").defaultNow().notNull(), // camelCase pour Better Auth
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(), // camelCase pour Better Auth
});

// Table pour stocker les organisations et leurs informations Stripe
// Architecture simplifiée: pas de billing_token, le deployment_type est géré uniquement ici
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().notNull(), // organization_id depuis VaultAI
  name: text("name").notNull(),
  display_name: text("display_name"), // Nom d'affichage personnalisé (admin billing)
  instance_url: text("instance_url"), // URL de l'instance VaultAI (ex: dev.vaultai.eu)
  
  // Informations Stripe (NULL si pas encore lié manuellement)
  stripe_customer_id: text("stripe_customer_id").unique(),
  stripe_subscription_id: text("stripe_subscription_id").unique(),
  
  // Configuration du plan (définie manuellement par l'admin billing)
  deployment_type: varchar("deployment_type", { length: 20 }), // "on-premise" | "managed-cloud" (NULL si pas encore défini)
  billing_period: varchar("billing_period", { length: 20 }), // "monthly" | "yearly" (NULL si pas encore défini)
  subscription_status: varchar("subscription_status", { length: 20 }).default(
    "pending"
  ), // "pending" | "trial" | "active" | "past_due" | "canceled"
  trial_end: timestamp("trial_end"),
  
  // Contact
  admin_email: text("admin_email"), // Email admin pour facturation
  
  // Tags pour organisation et filtrage
  tags: jsonb("tags").$type<string[]>().default([]), // Tags pour exclure des stats (ex: ["exclude_from_stats", "investor", "dev", "prod"])
  
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

// Table pour stocker les rapports d'usage quotidiens
export const usageReports = pgTable("usage_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  organization_id: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  user_count: integer("user_count").notNull(),
  deployment_type: varchar("deployment_type", { length: 20 }).notNull(),
  reported_at: timestamp("reported_at").defaultNow().notNull(),
  stripe_meter_event_id: text("stripe_meter_event_id"), // ID de l'event Stripe si envoyé avec succès
});

export type UsageReport = typeof usageReports.$inferSelect;
export type NewUsageReport = typeof usageReports.$inferInsert;

// Relations Better Auth
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  usageReports: many(usageReports),
}));

export const usageReportsRelations = relations(usageReports, ({ one }) => ({
  organization: one(organizations, {
    fields: [usageReports.organization_id],
    references: [organizations.id],
  }),
}));
