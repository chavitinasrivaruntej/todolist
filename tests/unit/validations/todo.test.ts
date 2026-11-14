import { describe, it, expect } from "vitest";
import { createTodoSchema, deleteTodoSchema } from "@/lib/validations/todo";

describe("Validation Schemas: Todo", () => {
  describe("createTodoSchema", () => {
    it("should accept valid title and description", () => {
      const input = {
        title: "Finish take-home architecture",
        description: "Configure Drizzle, tRPC, and tests",
      };

      const result = createTodoSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Finish take-home architecture");
        expect(result.data.description).toBe("Configure Drizzle, tRPC, and tests");
      }
    });

    it("should accept valid title without description", () => {
      const input = {
        title: "Buy groceries",
      };

      const result = createTodoSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Buy groceries");
        expect(result.data.description).toBeUndefined();
      }
    });

    it("should trim title whitespace and convert empty description to undefined", () => {
      const input = {
        title: "   Trimmed Title   ",
        description: "   ",
      };

      const result = createTodoSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Trimmed Title");
        expect(result.data.description).toBeUndefined();
      }
    });

    it("should reject empty title", () => {
      const input = {
        title: "",
      };

      const result = createTodoSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/Title cannot be empty/);
      }
    });

    it("should reject whitespace-only title", () => {
      const input = {
        title: "     ",
      };

      const result = createTodoSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/Title cannot be empty/);
      }
    });

    it("should reject title exceeding 255 characters", () => {
      const input = {
        title: "a".repeat(256),
      };

      const result = createTodoSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/cannot exceed 255 characters/);
      }
    });

    it("should reject description exceeding 1000 characters", () => {
      const input = {
        title: "Valid Title",
        description: "d".repeat(1001),
      };

      const result = createTodoSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/cannot exceed 1000 characters/);
      }
    });
  });

  describe("deleteTodoSchema", () => {
    it("should accept valid UUID", () => {
      const input = {
        id: "123e4567-e89b-12d3-a456-426614174000",
      };

      const result = deleteTodoSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("123e4567-e89b-12d3-a456-426614174000");
      }
    });

    it("should reject non-UUID string", () => {
      const input = {
        id: "not-a-valid-uuid-123",
      };

      const result = deleteTodoSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toMatch(/Invalid todo ID format/);
      }
    });
  });
});
