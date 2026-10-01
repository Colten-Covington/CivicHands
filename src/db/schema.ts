import { boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const needStatus = pgEnum("need_status", ["open", "claimed", "completed", "referred", "closed"]);
export const needKind = pgEnum("need_kind", ["public_cleanup", "city_hazard", "neighbor_help"]);
export const userRole = pgEnum("user_role", ["member", "city_official", "admin"]);
export const helperStatus = pgEnum("helper_status", ["none", "pending", "approved", "rejected", "revoked"]);
export const applicationStatus = pgEnum("application_status", ["pending", "approved", "rejected"]);
export const offerStatus = pgEnum("offer_status", ["pending", "accepted", "declined", "withdrawn", "completed"]);

/** Email and password hash are private. Display name, role, and official title may be shown publicly. */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: userRole("role").notNull().default("member"),
  officialTitle: text("official_title"),
  helperStatus: helperStatus("helper_status").notNull().default("none"),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  failedSignIns: integer("failed_sign_ins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  /** Set when the password was issued by someone else (an administrator or ADMIN_TEMP_PASSWORD); cleared when the owner changes it. */
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  /** Most recently applied hash; bootstrap_password_history keeps every applied temporary-password hash. */
  bootstrapPasswordHash: text("bootstrap_password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const bootstrapPasswordHistory = pgTable("bootstrap_password_history", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  passwordHash: text("password_hash").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.passwordHash] })]);

/** Session ids are SHA-256 hashes of the random token stored in the browser cookie. */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

export const needs = pgTable("needs", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  kind: needKind("kind").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  /** Exact address or directions for neighbor support. Only the requester and accepted helper may see it. */
  privateLocation: text("private_location"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  city: text("city").notNull().default("Texas City"),
  reporterName: text("reporter_name").notNull().default("A neighbor"),
  reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
  status: needStatus("status").notNull().default("open"),
  detailsPrivate: boolean("details_private").notNull().default(false),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (t) => [index("needs_reporter_idx").on(t.reporterId)]);

/** Applications are private between the applicant and administrators. */
export const helperApplications = pgTable("helper_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  motivation: text("motivation").notNull(),
  experience: text("experience").notNull(),
  status: applicationStatus("status").notNull().default("pending"),
  reviewerId: uuid("reviewer_id").references(() => users.id, { onDelete: "set null" }),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
}, (t) => [index("helper_applications_user_idx").on(t.userId)]);

/** Offer messages are private between the requester and the helper. */
export const helpOffers = pgTable("help_offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  needId: uuid("need_id").notNull().references(() => needs.id, { onDelete: "cascade" }),
  helperId: uuid("helper_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message"),
  status: offerStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
}, (t) => [uniqueIndex("help_offers_need_helper_idx").on(t.needId, t.helperId), index("help_offers_helper_idx").on(t.helperId)]);

/**
 * Append-only audit trail. `publicSummary`, `publicNote`, `actorRole`, and `actorPublicName` are
 * shown on the public transparency log; `privateDetails` is visible to staff only.
 */
export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorRole: text("actor_role").notNull(),
  actorPublicName: text("actor_public_name"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: uuid("target_id"),
  needId: uuid("need_id").references(() => needs.id, { onDelete: "set null" }),
  publicSummary: text("public_summary").notNull(),
  publicNote: text("public_note"),
  privateDetails: jsonb("private_details").$type<Record<string, unknown>>(),
}, (t) => [
  index("audit_events_need_idx").on(t.needId),
  index("audit_events_created_idx").on(t.createdAt),
  index("audit_events_actor_idx").on(t.actorId),
  index("audit_events_target_idx").on(t.targetId),
]);

export type User = typeof users.$inferSelect;
export type Need = typeof needs.$inferSelect;
