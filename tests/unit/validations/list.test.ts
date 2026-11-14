import { describe, it, expect } from "vitest";
import {
  createTodoListSchema,
  renameTodoListSchema,
  deleteTodoListSchema,
} from "@/lib/validations/list";

describe("Validation Schemas: TodoList", () => {
  describe("createTodoListSchema", () => {
    it("should accept valid list names", () => {
      const result = createTodoListSchema.safeParse({ name: "College Work" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("College Work");
      }
    });

    it("should trim surrounding whitespace", () => {
      const result = createTodoListSchema.safeParse({ name: "   Personal Tasks   " });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Personal Tasks");
      }
    });

    it("should reject empty names", () => {
      const result = createTodoListSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/List name cannot be empty/);
      }
    });

    it("should reject whitespace-only names", () => {
      const result = createTodoListSchema.safeParse({ name: "     " });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/List name cannot be empty/);
      }
    });

    it("should reject names exceeding 100 characters", () => {
      const result = createTodoListSchema.safeParse({ name: "a".repeat(101) });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/cannot exceed 100 characters/);
      }
    });
  });

  describe("renameTodoListSchema", () => {
    it("should accept valid UUID and updated name", () => {
      const result = renameTodoListSchema.safeParse({
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Renamed Projects",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = renameTodoListSchema.safeParse({
        id: "invalid-uuid",
        name: "Projects",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("deleteTodoListSchema", () => {
    it("should accept valid UUID with default force=false", () => {
      const result = deleteTodoListSchema.safeParse({
        id: "123e4567-e89b-12d3-a456-426614174000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.force).toBe(false);
      }
    });

    it("should accept explicit force=true flag", () => {
      const result = deleteTodoListSchema.safeParse({
        id: "123e4567-e89b-12d3-a456-426614174000",
        force: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.force).toBe(true);
      }
    });
  });
});

