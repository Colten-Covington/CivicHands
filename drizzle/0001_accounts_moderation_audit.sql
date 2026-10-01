CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."helper_status" AS ENUM('none', 'pending', 'approved', 'rejected', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."offer_status" AS ENUM('pending', 'accepted', 'declined', 'withdrawn', 'completed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('member', 'city_official', 'admin');--> statement-breakpoint
ALTER TYPE "public"."need_status" ADD VALUE 'closed';--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
	"actor_role" text NOT NULL,
	"actor_public_name" text,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"need_id" uuid,
	"public_summary" text NOT NULL,
	"public_note" text,
	"private_details" jsonb
);
--> statement-breakpoint
CREATE TABLE "help_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"need_id" uuid NOT NULL,
	"helper_id" uuid NOT NULL,
	"message" text,
	"status" "offer_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "helper_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"motivation" text NOT NULL,
	"experience" text NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" uuid,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"official_title" text,
	"helper_status" "helper_status" DEFAULT 'none' NOT NULL,
	"suspended_at" timestamp with time zone,
	"failed_sign_ins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN "private_location" text;--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN "reporter_id" uuid;--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_offers" ADD CONSTRAINT "help_offers_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_offers" ADD CONSTRAINT "help_offers_helper_id_users_id_fk" FOREIGN KEY ("helper_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_applications" ADD CONSTRAINT "helper_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "helper_applications" ADD CONSTRAINT "helper_applications_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_need_idx" ON "audit_events" USING btree ("need_id");--> statement-breakpoint
CREATE INDEX "audit_events_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "help_offers_need_helper_idx" ON "help_offers" USING btree ("need_id","helper_id");--> statement-breakpoint
CREATE INDEX "help_offers_helper_idx" ON "help_offers" USING btree ("helper_id");--> statement-breakpoint
CREATE INDEX "helper_applications_user_idx" ON "helper_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "needs" ADD CONSTRAINT "needs_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "needs_reporter_idx" ON "needs" USING btree ("reporter_id");--> statement-breakpoint
ALTER TABLE "needs" DROP COLUMN "claimed_by";