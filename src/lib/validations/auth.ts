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

