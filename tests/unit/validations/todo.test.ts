import { describe, it, expect } from "vitest";
import {
  createTodoSchema,
  deleteTodoSchema,
  getTodosByListSchema,
  updateTodoStatusSchema,
} from "@/lib/validations/todo";

describe("Validation Schemas: Todo", () => {
  const sampleListId = "123e4567-e89b-12d3-a456-426614174000";

  describe("createTodoSchema", () => {
    it("should accept valid title and normal description with default status TODO", () => {
      const input = {
        listId: sampleListId,
        title: "Finish take-home architecture",
        description: "Configure Drizzle, tRPC, and tests",
      };

      const result = createTodoSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Finish take-home architecture");
        expect(result.data.description).toBe("Configure Drizzle, tRPC, and tests");
        expect(result.data.status).toBe("TODO");
        expect(result.data.listId).toBe(sampleListId);
      }
    });

    it("should accept explicit status IN_PROGRESS and DONE", () => {
      const inProgress = createTodoSchema.safeParse({
        listId: sampleListId,
        title: "In Progress Task",
        status: "IN_PROGRESS",
      });
      expect(inProgress.success).toBe(true);
      if (inProgress.success) {
        expect(inProgress.data.status).toBe("IN_PROGRESS");
      }

      const done = createTodoSchema.safeParse({
        listId: sampleListId,
        title: "Done Task",
        status: "DONE",
      });
      expect(done.success).toBe(true);
      if (done.success) {
        expect(done.data.status).toBe("DONE");
      }
    });

    it("should reject invalid status value", () => {
      const result = createTodoSchema.safeParse({
        listId: sampleListId,
        title: "Task with invalid status",
        status: "INVALID_STATUS",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing listId", () => {
      const result = createTodoSchema.safeParse({
        title: "Orphaned Task",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid listId UUID format", () => {
      const result = createTodoSchema.safeParse({
        listId: "not-a-uuid",
        title: "Task with bad listId",
      });
      expect(result.success).toBe(false);
    });

    it("should accept null description and normalize it to undefined", () => {
      const input = {
        listId: sampleListId,
        title: "Submit code review",
        description: null,
      };

      const result = createTodoSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBeUndefined();
      }
    });

    it("should reject empty title", () => {
      const input = {
        listId: sampleListId,
        title: "",
      };

      const result = createTodoSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("updateTodoStatusSchema", () => {
    it("should accept valid UUID and valid status", () => {
      const result = updateTodoStatusSchema.safeParse({
        id: "123e4567-e89b-12d3-a456-426614174000",
        status: "DONE",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
      const result = updateTodoStatusSchema.safeParse({
        id: "123e4567-e89b-12d3-a456-426614174000",
        status: "COMPLETED",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getTodosByListSchema", () => {
    it("should accept valid listId UUID", () => {
      const result = getTodosByListSchema.safeParse({
        listId: sampleListId,
      });
      expect(result.success).toBe(true);
    });

    it("should reject malformed listId", () => {
      const result = getTodosByListSchema.safeParse({
        listId: "bad-id",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("deleteTodoSchema", () => {
    it("should accept valid UUID format", () => {
      const result = deleteTodoSchema.safeParse({
        id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
    });

    it("should reject malformed UUID", () => {
      const result = deleteTodoSchema.safeParse({
        id: "invalid-id",
      });
      expect(result.success).toBe(false);
    });
  });
});
