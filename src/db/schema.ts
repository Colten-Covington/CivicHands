import { boolean, doublePrecision, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const needStatus = pgEnum("need_status", ["open", "claimed", "completed", "referred"]);
export const needKind = pgEnum("need_kind", ["public_cleanup", "city_hazard", "neighbor_help"]);

export const needs = pgTable("needs", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  kind: needKind("kind").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  city: text("city").notNull().default("Texas City"),
  reporterName: text("reporter_name").notNull().default("A neighbor"),
  status: needStatus("status").notNull().default("open"),
  claimedBy: text("claimed_by"),
  detailsPrivate: boolean("details_private").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
