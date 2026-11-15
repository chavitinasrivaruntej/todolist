import { z } from "zod";

/**
 * Validation schema for user authentication / sign in.
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Please provide a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters."),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Validation schema for new user registration.
 */
export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Please provide a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters."),
  confirmPassword: z
    .string()
    .min(8, "Please confirm your password."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Validates and sanitizes a redirect path to prevent open redirect vulnerabilities.
 * Allows only internal relative paths starting with a single '/' and rejects
 * external URLs, protocol-relative paths ('//'), backslashes, and schemes.
 */
export function sanitizeRedirectPath(nextPath: string | null | undefined): string {
  if (!nextPath || typeof nextPath !== "string") {
    return "/";
  }

  const trimmed = nextPath.trim();

  // Must begin with a single '/' and not with '//' or '/\'
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return "/";
  }

  // Reject backslashes anywhere in the string to prevent path confusion or scheme escapes
  if (trimmed.includes("\\")) {
    return "/";
  }

  // Reject scheme patterns (e.g. javascript:, http:, https:, data:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return "/";
  }

  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return "/";
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/";
  }
}

