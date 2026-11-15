import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getEmailService,
  ConsoleEmailService,
  ResendEmailService,
} from "@/server/services/email/email.service";

describe("EmailService Factory & Implementations", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getEmailService factory", () => {
    it("should return ConsoleEmailService by default when no provider is configured", () => {
      delete process.env.EMAIL_PROVIDER;
      delete process.env.RESEND_API_KEY;

      const service = getEmailService();
      expect(service).toBeInstanceOf(ConsoleEmailService);
    });

    it("should return ConsoleEmailService when EMAIL_PROVIDER=console", () => {
      process.env.EMAIL_PROVIDER = "console";
      delete process.env.RESEND_API_KEY;

      const service = getEmailService();
      expect(service).toBeInstanceOf(ConsoleEmailService);
    });

    it("should return ResendEmailService when EMAIL_PROVIDER=resend and RESEND_API_KEY is provided", () => {
      process.env.EMAIL_PROVIDER = "resend";
      process.env.RESEND_API_KEY = "re_test_key_123";
      process.env.EMAIL_FROM = "invites@mycompany.com";

      const service = getEmailService();
      expect(service).toBeInstanceOf(ResendEmailService);
    });

    it("should fall back to ConsoleEmailService when EMAIL_PROVIDER=resend but RESEND_API_KEY is missing", () => {
      process.env.EMAIL_PROVIDER = "resend";
      delete process.env.RESEND_API_KEY;

      const service = getEmailService();
      expect(service).toBeInstanceOf(ConsoleEmailService);
    });
  });

  describe("ConsoleEmailService", () => {
    it("should output invitation details and URL to console", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const service = new ConsoleEmailService();

      await service.sendInvitationEmail({
        to: "collaborator@example.com",
        inviterEmail: "owner@example.com",
        listName: "Architecture Roadmap",
        role: "EDITOR",
        invitationUrl: "http://localhost:3000/invite/token-xyz",
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("collaborator@example.com")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Architecture Roadmap")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("http://localhost:3000/invite/token-xyz")
      );
    });
  });

  describe("ResendEmailService", () => {
    it("should dispatch POST request to api.resend.com with auth headers", async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "msg_123" }),
      });
      globalThis.fetch = fetchSpy;

      const service = new ResendEmailService("re_sample_api_key", "noreply@caizetodo.com");

      await service.sendInvitationEmail({
        to: "colleague@example.com",
        inviterEmail: "owner@example.com",
        listName: "Sprint Backlog",
        role: "VIEWER",
        invitationUrl: "http://localhost:3000/invite/token-456",
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://api.resend.com/emails",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer re_sample_api_key",
            "Content-Type": "application/json",
          },
        })
      );

      const requestBody = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(requestBody.to).toEqual(["colleague@example.com"]);
      expect(requestBody.from).toBe("noreply@caizetodo.com");
      expect(requestBody.subject).toContain("Sprint Backlog");
      expect(requestBody.html).toContain("http://localhost:3000/invite/token-456");
    });
  });
});

