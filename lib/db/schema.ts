import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Tables Better Auth pour l'authentification des administrateurs
// Note: Les noms de colonnes en DB sont en snake_case
export const user = pgTable("user", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name"),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(), // snake_case en DB
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(), // snake_case en DB
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // snake_case en DB
  role: varchar("role", { length: 20 }).default("admin").notNull(), // "admin" | "viewer"
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(), // snake_case en DB
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"), // snake_case en DB
  userAgent: text("user_agent"), // snake_case en DB
  userId: uuid("user_id") // snake_case en DB
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(), // snake_case en DB
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // snake_case en DB
});

export const account = pgTable("account", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: text("account_id").notNull(), // snake_case en DB
  providerId: text("provider_id").notNull(), // snake_case en DB
  userId: uuid("user_id") // snake_case en DB
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"), // snake_case en DB
  refreshToken: text("refresh_token"), // snake_case en DB
  idToken: text("id_token"), // snake_case en DB
  accessTokenExpiresAt: timestamp("access_token_expires_at"), // snake_case en DB
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"), // snake_case en DB
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(), // snake_case en DB
  updatedAt: timestamp("updated_at").defaultNow().notNull(), // snake_case en DB
});

export const verification = pgTable("verification", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(), // snake_case en DB
  createdAt: timestamp("created_at").defaultNow(), // snake_case en DB
  updatedAt: timestamp("updated_at").defaultNow(), // snake_case en DB
});

// Table pour stocker les organisations et leurs informations Stripe
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().notNull(),
  name: text("name").notNull(),
  billing_token: text("billing_token").notNull().unique(), // Token unique pour authentification
  stripe_customer_id: text("stripe_customer_id").unique(),
  stripe_subscription_id: text("stripe_subscription_id").unique(),
  deployment_type: varchar("deployment_type", { length: 20 })
    .notNull()
    .default("on-premise"), // "on-premise" | "managed-cloud"
  plan_type: varchar("plan_type", { length: 20 }), // "managed-cloud" | "self-hosted"
  subscription_status: varchar("subscription_status", { length: 20 }).default(
    "trial"
  ), // "trial" | "active" | "past_due" | "canceled"
  trial_end: timestamp("trial_end"),
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
