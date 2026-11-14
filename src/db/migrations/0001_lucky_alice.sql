CREATE TYPE "public"."todo_status" AS ENUM('TODO', 'IN_PROGRESS', 'DONE');--> statement-breakpoint
CREATE TABLE "todo_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "todo_lists" ("id", "name") 
VALUES ('00000000-0000-4000-8000-000000000001', 'Personal') 
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "list_id" uuid;--> statement-breakpoint
UPDATE "todos" SET "list_id" = '00000000-0000-4000-8000-000000000001' WHERE "list_id" IS NULL;--> statement-breakpoint
ALTER TABLE "todos" ALTER COLUMN "list_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "todos" ADD COLUMN "status" "todo_status" DEFAULT 'TODO' NOT NULL;--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_list_id_todo_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."todo_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "todos_list_id_idx" ON "todos" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "todos_list_id_created_at_idx" ON "todos" USING btree ("list_id","created_at");
