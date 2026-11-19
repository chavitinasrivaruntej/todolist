import { describe, it, expect } from "vitest";
import {
  createTagSchema,
  updateTagSchema,
  deleteTagSchema,
  tagFilterSchema,
} from "@/lib/validations/tag";

describe("Tag Validation Schemas", () => {
  const validUuid = "123e4567-e89b-42d3-a456-426614174000";

  describe("createTagSchema", () => {
    it("should accept valid tag payload", () => {
      const valid = {
        listId: validUuid,
        name: "Bug Fix",
        color: "red",
      };
      const result = createTagSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Bug Fix");
        expect(result.data.color).toBe("red");
      }
    });

    it("should default color to slate if omitted", () => {
      const payload = {
        listId: validUuid,
        name: "Feature",
      };
      const result = createTagSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe("slate");
      }
    });

    it("should reject empty or whitespace-only name", () => {
      const payload = {
        listId: validUuid,
        name: "   ",
        color: "blue",
      };
      const result = createTagSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject name longer than 50 characters", () => {
      const payload = {
        listId: validUuid,
        name: "a".repeat(51),
      };
      const result = createTagSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject invalid color name", () => {
      const payload = {
        listId: validUuid,
        name: "Backend",
        color: "neon-cyan",
      };
      const result = createTagSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("should reject invalid listId uuid", () => {
      const payload = {
        listId: "not-a-uuid",
        name: "Design",
      };
      const result = createTagSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("updateTagSchema", () => {
    it("should accept valid update with new name and color", () => {
      const payload = {
        id: validUuid,
        name: "Critical Bug",
        color: "red",
      };
      const result = updateTagSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should accept updating only color", () => {
      const payload = {
        id: validUuid,
        color: "purple",
      };
      const result = updateTagSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("should reject updating with empty name", () => {
      const payload = {
        id: validUuid,
        name: "",
      };
      const result = updateTagSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("deleteTagSchema", () => {
    it("should accept valid tag id uuid", () => {
      const result = deleteTagSchema.safeParse({ id: validUuid });
      expect(result.success).toBe(true);
    });

    it("should reject invalid tag id", () => {
      const result = deleteTagSchema.safeParse({ id: "invalid-id" });
      expect(result.success).toBe(false);
    });
  });

  describe("tagFilterSchema", () => {
    it("should accept tagIds array with default AND operator", () => {
      const result = tagFilterSchema.safeParse({
        tagIds: [validUuid],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tagOperator).toBe("AND");
      }
    });

    it("should accept OR operator", () => {
      const result = tagFilterSchema.safeParse({
        tagIds: [validUuid],
        tagOperator: "OR",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tagOperator).toBe("OR");
      }
    });
  });
});
