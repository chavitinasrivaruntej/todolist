CREATE TYPE "public"."recurrence_frequency" AS ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM');
--> statement-breakpoint
CREATE TYPE "public"."recurrence_status" AS ENUM('ACTIVE', 'PAUSED', 'COMPLETED');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "recurrence_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"frequency" "public"."recurrence_frequency" NOT NULL,
	"interval" integer DEFAULT 1 NOT NULL,
	"days_of_week" jsonb,
	"anchor_day_of_month" integer,
	"anchor_month_of_year" integer,
	"start_date" date NOT NULL,
	"end_date" date,
	"max_occurrences" integer,
	"occurrences_generated" integer DEFAULT 0 NOT NULL,
	"last_generated_occurrence_number" integer DEFAULT 0 NOT NULL,
	"status" "public"."recurrence_status" DEFAULT 'ACTIVE' NOT NULL,
	"next_due_date" date,
	"base_title" varchar(255) NOT NULL,
	"base_description" text,
	"base_priority" "public"."todo_priority" DEFAULT 'MEDIUM' NOT NULL,
	"base_tag_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "recurrence_rule_id" uuid;
--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN IF NOT EXISTS "occurrence_number" integer;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_list_id_todo_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "todos" ADD CONSTRAINT "todos_recurrence_rule_id_recurrence_rules_id_fk" FOREIGN KEY ("recurrence_rule_id") REFERENCES "public"."recurrence_rules"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurrence_rules_list_id_idx" ON "recurrence_rules" USING btree ("list_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurrence_rules_status_next_due_idx" ON "recurrence_rules" USING btree ("status","next_due_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "todos_recurrence_rule_id_idx" ON "todos" USING btree ("recurrence_rule_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "todos_recurrence_rule_occurrence_unique" ON "todos" ("recurrence_rule_id", "occurrence_number");
