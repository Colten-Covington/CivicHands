CREATE TABLE "bootstrap_password_history" (
	"user_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	CONSTRAINT "bootstrap_password_history_user_id_password_hash_pk" PRIMARY KEY("user_id","password_hash")
);
--> statement-breakpoint
ALTER TABLE "bootstrap_password_history" ADD CONSTRAINT "bootstrap_password_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "bootstrap_password_history" ("user_id", "password_hash")
SELECT "id", "bootstrap_password_hash" FROM "users" WHERE "bootstrap_password_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_events_target_idx" ON "audit_events" USING btree ("target_id");