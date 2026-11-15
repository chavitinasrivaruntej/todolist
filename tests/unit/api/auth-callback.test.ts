import { describe, it, expect, vi, beforeEach } from "vitest";
import { sanitizeRedirectPath } from "@/lib/validations/auth";
import { GET } from "@/app/api/auth/callback/route";
import { type NextRequest } from "next/server";

// Mock Supabase SSR client
const mockExchangeCodeForSession = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

// Mock Next.js cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: vi.fn(),
  })),
}));

describe("OAuth Callback & Open Redirect Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock-proj.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";
  });

  describe("sanitizeRedirectPath unit tests", () => {
    it("should preserve valid internal relative paths", () => {
      expect(sanitizeRedirectPath("/invite/30816cea951ba2ade423890970244e80")).toBe(
        "/invite/30816cea951ba2ade423890970244e80"
      );
      expect(sanitizeRedirectPath("/?listId=00000000-0000-4000-8000-000000000001")).toBe(
        "/?listId=00000000-0000-4000-8000-000000000001"
      );
      expect(sanitizeRedirectPath("/dashboard#section")).toBe("/dashboard#section");
    });

    it("should reject external absolute URLs and fall back to /", () => {
      expect(sanitizeRedirectPath("https://evil.com")).toBe("/");
      expect(sanitizeRedirectPath("http://attacker.com/steal")).toBe("/");
      expect(sanitizeRedirectPath("https://google.com")).toBe("/");
    });

    it("should reject protocol-relative URLs starting with // or /\\", () => {
      expect(sanitizeRedirectPath("//evil.com")).toBe("/");
      expect(sanitizeRedirectPath("//evil.com/path")).toBe("/");
      expect(sanitizeRedirectPath("/\\evil.com")).toBe("/");
      expect(sanitizeRedirectPath("/\\attacker.com/evil")).toBe("/");
    });

    it("should reject protocol-based URLs like javascript: and data:", () => {
      expect(sanitizeRedirectPath("javascript:alert(document.cookie)")).toBe("/");
      expect(sanitizeRedirectPath("data:text/html,<script>evil()</script>")).toBe("/");
      expect(sanitizeRedirectPath("vbscript:msgbox")).toBe("/");
    });

    it("should reject paths containing backslashes", () => {
      expect(sanitizeRedirectPath("/safe\\..\\evil")).toBe("/");
      expect(sanitizeRedirectPath("/path\\to\\nowhere")).toBe("/");
    });

    it("should fall back to / for empty, null, or undefined values", () => {
      expect(sanitizeRedirectPath(null)).toBe("/");
      expect(sanitizeRedirectPath(undefined)).toBe("/");
      expect(sanitizeRedirectPath("")).toBe("/");
      expect(sanitizeRedirectPath("   ")).toBe("/");
    });
  });

  describe("GET /api/auth/callback route handler", () => {
    const createMockRequest = (url: string) => {
      return {
        url,
      } as unknown as NextRequest;
    };

    it("should preserve valid invitation redirect when code exchange succeeds", async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const req = createMockRequest(
        "http://localhost:3000/api/auth/callback?code=valid-auth-code&next=/invite/valid-token-123"
      );

      const response = await GET(req);

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith("valid-auth-code");
      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:3000/invite/valid-token-123"
      );
    });

    it("should sanitize and reject external open redirect target in next param", async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const req = createMockRequest(
        "http://localhost:3000/api/auth/callback?code=valid-auth-code&next=https://malicious.com/steal"
      );

      const response = await GET(req);

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith("valid-auth-code");
      expect(response.status).toBe(307);
      // Malicious target was rejected; redirects safely to root /
      expect(response.headers.get("Location")).toBe("http://localhost:3000/");
    });

    it("should sanitize protocol-relative redirect in next param", async () => {
      mockExchangeCodeForSession.mockResolvedValue({ error: null });

      const req = createMockRequest(
        "http://localhost:3000/api/auth/callback?code=valid-auth-code&next=//evil.com"
      );

      const response = await GET(req);

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith("valid-auth-code");
      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe("http://localhost:3000/");
    });

    it("should redirect to /login?error=auth-callback-failed when exchange fails", async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        error: new Error("Invalid grant"),
      });

      const req = createMockRequest(
        "http://localhost:3000/api/auth/callback?code=invalid-code&next=/invite/123"
      );

      const response = await GET(req);

      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toBe(
        "http://localhost:3000/login?error=auth-callback-failed"
      );
    });
  });
});

