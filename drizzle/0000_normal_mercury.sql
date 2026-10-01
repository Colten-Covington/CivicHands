CREATE TYPE "public"."need_kind" AS ENUM('public_cleanup', 'city_hazard', 'neighbor_help');--> statement-breakpoint
CREATE TYPE "public"."need_status" AS ENUM('open', 'claimed', 'completed', 'referred');--> statement-breakpoint
CREATE TABLE "needs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"kind" "need_kind" NOT NULL,
	"category" text NOT NULL,
	"location" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"city" text DEFAULT 'Texas City' NOT NULL,
	"reporter_name" text DEFAULT 'A neighbor' NOT NULL,
	"status" "need_status" DEFAULT 'open' NOT NULL,
	"claimed_by" text,
	"details_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
