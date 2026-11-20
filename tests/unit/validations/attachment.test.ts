import { describe, it, expect } from "vitest";
import {
  sanitizeFilename,
  validateExtensionForMime,
  verifyMagicBytes,
  createUploadUrlSchema,
  confirmUploadSchema,
  deleteAttachmentSchema,
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_TODO,
} from "@/lib/validations/attachment";

describe("Attachment Validations and Utilities", () => {
  describe("sanitizeFilename", () => {
    it("should strip path traversal components and normalize slashes", () => {
      expect(sanitizeFilename("../../../etc/passwd.png")).toBe("passwd.png");
      expect(sanitizeFilename("..\\..\\windows\\system32\\calc.pdf")).toBe("calc.pdf");
      expect(sanitizeFilename("folder/subfolder/document.docx")).toBe("document.docx");
    });

    it("should replace spaces and special symbols with underscores", () => {
      expect(sanitizeFilename("my holiday photo (1).jpg")).toBe("my_holiday_photo__1_.jpg");
      expect(sanitizeFilename("financial report #2026.xlsx")).toBe("financial_report__2026.xlsx");
    });

    it("should handle filenames without extensions or leading dots safely", () => {
      expect(sanitizeFilename(".env")).toBe("_env");
      expect(sanitizeFilename("README")).toBe("README");
      expect(sanitizeFilename("")).toBe("attachment");
    });
  });

  describe("validateExtensionForMime", () => {
    it("should accept valid extensions for images", () => {
      expect(validateExtensionForMime("image.png", "image/png")).toBe(true);
      expect(validateExtensionForMime("photo.jpg", "image/jpeg")).toBe(true);
      expect(validateExtensionForMime("photo.jpeg", "image/jpeg")).toBe(true);
      expect(validateExtensionForMime("graphic.webp", "image/webp")).toBe(true);
    });

    it("should accept valid extensions for documents and spreadsheets", () => {
      expect(validateExtensionForMime("doc.pdf", "application/pdf")).toBe(true);
      expect(
        validateExtensionForMime(
          "doc.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).toBe(true);
      expect(
        validateExtensionForMime(
          "sheet.xlsx",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      ).toBe(true);
      expect(validateExtensionForMime("data.csv", "text/csv")).toBe(true);
      expect(validateExtensionForMime("notes.txt", "text/plain")).toBe(true);
      expect(validateExtensionForMime("docs.md", "text/markdown")).toBe(true);
    });

    it("should reject mismatched or dangerous extensions", () => {
      expect(validateExtensionForMime("malware.exe", "application/pdf")).toBe(false);
      expect(validateExtensionForMime("script.js", "text/plain")).toBe(false);
      expect(validateExtensionForMime("image.svg", "image/png")).toBe(false);
      expect(validateExtensionForMime("document.pdf", "image/png")).toBe(false);
    });
  });

  describe("verifyMagicBytes", () => {
    it("should verify valid PNG magic bytes", () => {
      const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      expect(verifyMagicBytes(pngHeader, "image/png")).toBe(true);
    });

    it("should verify valid JPEG magic bytes", () => {
      const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      expect(verifyMagicBytes(jpegHeader, "image/jpeg")).toBe(true);
    });

    it("should verify valid PDF magic bytes", () => {
      const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
      expect(verifyMagicBytes(pdfHeader, "application/pdf")).toBe(true);
    });

    it("should verify valid ZIP-based OpenXML (DOCX/XLSX) magic bytes", () => {
      const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      expect(
        verifyMagicBytes(
          zipHeader,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).toBe(true);
      expect(
        verifyMagicBytes(
          zipHeader,
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
      ).toBe(true);
    });

    it("should reject corrupted or mismatched binary signatures", () => {
      const fakePdf = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF header
      expect(verifyMagicBytes(fakePdf, "application/pdf")).toBe(false);
      expect(verifyMagicBytes(fakePdf, "image/png")).toBe(false);
    });

    it("should reject text files with binary null bytes", () => {
      const binaryDisguisedAsText = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57]);
      expect(verifyMagicBytes(binaryDisguisedAsText, "text/plain")).toBe(false);
      expect(verifyMagicBytes(binaryDisguisedAsText, "text/csv")).toBe(false);
    });

    it("should accept valid UTF-8 text without null bytes", () => {
      const validText = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x57, 0x6f, 0x72, 0x6c, 0x64]);
      expect(verifyMagicBytes(validText, "text/plain")).toBe(true);
      expect(verifyMagicBytes(validText, "text/markdown")).toBe(true);
    });
  });

  describe("Zod Validation Schemas", () => {
    it("should validate valid createUploadUrl input", () => {
      const valid = {
        todoId: "123e4567-e89b-12d3-a456-426614174000",
        filename: "report.pdf",
        mimeType: "application/pdf",
        fileSize: 1024 * 500, // 500 KB
      };
      const result = createUploadUrlSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject invalid MIME types (e.g. SVG or executable)", () => {
      const invalid = {
        todoId: "123e4567-e89b-12d3-a456-426614174000",
        filename: "vector.svg",
        mimeType: "image/svg+xml",
        fileSize: 1024,
      };
      const result = createUploadUrlSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject files exceeding 10MB limit", () => {
      const oversized = {
        todoId: "123e4567-e89b-12d3-a456-426614174000",
        filename: "video.mp4",
        mimeType: "application/pdf",
        fileSize: MAX_ATTACHMENT_SIZE_BYTES + 1,
      };
      const result = createUploadUrlSchema.safeParse(oversized);
      expect(result.success).toBe(false);
    });

    it("should reject empty files (0 bytes)", () => {
      const empty = {
        todoId: "123e4567-e89b-12d3-a456-426614174000",
        filename: "empty.txt",
        mimeType: "text/plain",
        fileSize: 0,
      };
      const result = createUploadUrlSchema.safeParse(empty);
      expect(result.success).toBe(false);
    });

    it("should validate confirmUploadSchema and deleteAttachmentSchema", () => {
      expect(confirmUploadSchema.safeParse({ attachmentId: "not-a-uuid" }).success).toBe(false);
      expect(
        confirmUploadSchema.safeParse({ attachmentId: "123e4567-e89b-12d3-a456-426614174000" }).success
      ).toBe(true);
      expect(
        deleteAttachmentSchema.safeParse({ attachmentId: "123e4567-e89b-12d3-a456-426614174000" }).success
      ).toBe(true);
    });
  });
});
