CREATE TYPE "public"."need_review_status" AS ENUM('pending', 'approved', 'changes_requested', 'rejected');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'moderator' BEFORE 'city_official';--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN "review_status" "need_review_status" DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN "moderation_feedback" text;