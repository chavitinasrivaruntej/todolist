import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

describe("Auth Validation Schemas", () => {
  describe("loginSchema", () => {
    it("should accept valid email and password", () => {
      const valid = { email: "user@example.com", password: "password123" };
      const result = loginSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject invalid email format", () => {
      const invalid = { email: "not-an-email", password: "password123" };
      const result = loginSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("valid email address");
      }
    });

    it("should reject password shorter than 8 characters", () => {
      const invalid = { email: "user@example.com", password: "123" };
      const result = loginSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("at least 8 characters");
      }
    });

    it("should reject empty email", () => {
      const invalid = { email: "   ", password: "password123" };
      const result = loginSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("registerSchema", () => {
    it("should accept valid email and matching passwords", () => {
      const valid = {
        email: "newuser@example.com",
        password: "securePassword123",
        confirmPassword: "securePassword123",
      };
      const result = registerSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject mismatching passwords", () => {
      const mismatch = {
        email: "newuser@example.com",
        password: "securePassword123",
        confirmPassword: "differentPassword123",
      };
      const result = registerSchema.safeParse(mismatch);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("Passwords do not match.");
      }
    });

    it("should reject password shorter than 8 characters", () => {
      const short = {
        email: "newuser@example.com",
        password: "short",
        confirmPassword: "short",
      };
      const result = registerSchema.safeParse(short);
      expect(result.success).toBe(false);
    });
  });
});

