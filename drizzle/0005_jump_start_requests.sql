CREATE TYPE "public"."need_request_type" AS ENUM('general', 'jump_start');--> statement-breakpoint
CREATE TYPE "public"."jump_vehicle_type" AS ENUM('passenger_car', 'light_truck');--> statement-breakpoint
ALTER TABLE "needs" ADD COLUMN "request_type" "need_request_type" DEFAULT 'general' NOT NULL;--> statement-breakpoint
CREATE TABLE "helper_capabilities" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "jumper_cables" boolean DEFAULT false NOT NULL,
  "jump_pack" boolean DEFAULT false,
  "confirmed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "helper_capabilities" ADD CONSTRAINT "helper_capabilities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "jump_start_requests" (
  "need_id" uuid PRIMARY KEY NOT NULL,
  "needs_cables" boolean DEFAULT false NOT NULL,
  "needs_jump_pack" boolean DEFAULT false NOT NULL,
  "vehicle_type" "jump_vehicle_type" NOT NULL,
  "safe_location_confirmed" boolean DEFAULT false NOT NULL,
  "standard_12v_confirmed" boolean DEFAULT false NOT NULL,
  "hazard_free_confirmed" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
ALTER TABLE "jump_start_requests" ADD CONSTRAINT "jump_start_requests_need_id_needs_id_fk" FOREIGN KEY ("need_id") REFERENCES "public"."needs"("id") ON DELETE cascade ON UPDATE no action;
