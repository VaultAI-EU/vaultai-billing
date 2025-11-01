import { pgTable, uuid, text, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Table pour stocker les organisations et leurs informations Stripe
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().notNull(),
  name: text("name").notNull(),
  billing_token: text("billing_token").notNull().unique(), // Token unique pour authentification
  stripe_customer_id: text("stripe_customer_id").unique(),
  stripe_subscription_id: text("stripe_subscription_id").unique(),
  deployment_type: varchar("deployment_type", { length: 20 }).notNull().default("on-premise"), // "on-premise" | "managed-cloud"
  plan_type: varchar("plan_type", { length: 20 }), // "managed-cloud" | "self-hosted"
  subscription_status: varchar("subscription_status", { length: 20 }).default("trial"), // "trial" | "active" | "past_due" | "canceled"
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

