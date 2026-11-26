-- Migration: 0013_analytics_indexes.sql
-- Description: Add composite indexes on todos(list_id, status) and activity_logs(list_id, action, created_at) for Phase 12 analytics aggregation queries

CREATE INDEX IF NOT EXISTS "todos_list_id_status_idx" ON "todos" USING btree ("list_id", "status");
CREATE INDEX IF NOT EXISTS "activity_logs_list_action_created_idx" ON "activity_logs" USING btree ("list_id", "action", "created_at");
