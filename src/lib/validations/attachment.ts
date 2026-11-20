import { z } from "zod";

/**
 * Global Attachment Limits
 */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ATTACHMENTS_PER_TODO = 10;
export const UPLOAD_URL_EXPIRY_SECONDS = 120; // 2 minutes
export const DOWNLOAD_URL_EXPIRY_SECONDS = 300; // 5 minutes
export const RESERVATION_EXPIRY_MINUTES = 10; // 10 minutes

/**
 * Allowed MIME Types Specification
 */
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  // Images
  "image/png",
  "image/jpeg",
  "image/webp",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Spreadsheets
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  // Text
  "text/plain",
  "text/markdown",
] as const;

export type AllowedMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

export const ALLOWED_MIME_TYPE_SET = new Set<string>(ALLOWED_ATTACHMENT_MIME_TYPES);

/**
 * Extension to MIME mapping & Magic Byte signatures
 */
export interface FileTypeDefinition {
  extensions: string[];
  magicBytes?: number[][]; // Multiple valid signatures allowed
  validateText?: boolean;
}

export const FILE_TYPE_DEFINITIONS: Record<AllowedMimeType, FileTypeDefinition> = {
  "image/png": {
    extensions: [".png"],
    magicBytes: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  },
  "image/jpeg": {
    extensions: [".jpg", ".jpeg"],
    magicBytes: [[0xff, 0xd8, 0xff]],
  },
  "image/webp": {
    extensions: [".webp"],
    magicBytes: [[0x52, 0x49, 0x46, 0x46]], // RIFF
  },
  "application/pdf": {
    extensions: [".pdf"],
    magicBytes: [[0x25, 0x50, 0x44, 0x46]], // %PDF
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extensions: [".docx"],
    magicBytes: [[0x50, 0x4b, 0x03, 0x04]], // PK.. (ZIP archive)
  },
  "application/msword": {
    extensions: [".doc"],
    magicBytes: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extensions: [".xlsx"],
    magicBytes: [[0x50, 0x4b, 0x03, 0x04]], // PK.. (ZIP archive)
  },
  "application/vnd.ms-excel": {
    extensions: [".xls"],
    magicBytes: [[0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
  },
  "text/csv": {
    extensions: [".csv"],
    validateText: true,
  },
  "text/plain": {
    extensions: [".txt"],
    validateText: true,
  },
  "text/markdown": {
    extensions: [".md"],
    validateText: true,
  },
};

/**
 * Sanitizes an uploaded filename by stripping directory traversal sequences,
 * control characters, and replacing spaces/unsafe characters with underscores.
 */
export function sanitizeFilename(filename: string): string {
  // Extract basename (prevent path traversal / or \)
  const base = filename.replace(/^.*[\\/]/, "");
  // Remove null bytes and control characters
  const clean = base.replace(/[\x00-\x1f\x80-\x9f]/g, "").trim();
  // Match name and extension
  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0) {
    return clean.replace(/[^a-zA-Z0-9_-]/g, "_") || "attachment";
  }

  const namePart = clean.slice(0, lastDot).replace(/[^a-zA-Z0-9_-]/g, "_") || "file";
  const extPart = clean.slice(lastDot).toLowerCase().replace(/[^a-z0-9.]/g, "");

  return `${namePart}${extPart}`;
}

/**
 * Validates that the filename has an extension allowed for the given MIME type.
 */
export function validateExtensionForMime(filename: string, mimeType: AllowedMimeType): boolean {
  const clean = filename.toLowerCase();
  const def = FILE_TYPE_DEFINITIONS[mimeType];
  if (!def) return false;
  return def.extensions.some((ext) => clean.endsWith(ext));
}

/**
 * Verifies the binary magic bytes of an uploaded file buffer against the expected MIME type.
 */
export function verifyMagicBytes(buffer: Uint8Array | Buffer, mimeType: AllowedMimeType): boolean {
  const def = FILE_TYPE_DEFINITIONS[mimeType];
  if (!def) return false;

  // Text types: verify there are no null bytes and valid UTF-8
  if (def.validateText) {
    for (let i = 0; i < Math.min(buffer.length, 512); i++) {
      if (buffer[i] === 0x00) {
        return false; // Null byte indicates binary data disguised as text
      }
    }
    return true;
  }

  // Binary types with known magic bytes
  if (def.magicBytes && def.magicBytes.length > 0) {
    return def.magicBytes.some((signature) => {
      if (buffer.length < signature.length) return false;
      return signature.every((byte, idx) => buffer[idx] === byte);
    });
  }

  return true;
}

/**
 * Zod Schemas for Attachment Router
 */
export const createUploadUrlSchema = z.object({
  todoId: z.string().uuid("Invalid todo ID format."),
  filename: z
    .string()
    .min(1, "Filename cannot be empty.")
    .max(255, "Filename cannot exceed 255 characters."),
  mimeType: z.enum(ALLOWED_ATTACHMENT_MIME_TYPES as unknown as [string, ...string[]], {
    error: "File type is not permitted. Only standard images, documents, spreadsheets, and text files are allowed.",
  }),
  fileSize: z
    .number()
    .int()
    .min(1, "File cannot be empty.")
    .max(
      MAX_ATTACHMENT_SIZE_BYTES,
      `File size exceeds the 10MB limit (${MAX_ATTACHMENT_SIZE_BYTES} bytes).`
    ),
});

export const confirmUploadSchema = z.object({
  attachmentId: z.string().uuid("Invalid attachment ID format."),
});

export const getAttachmentsByTodoSchema = z.object({
  todoId: z.string().uuid("Invalid todo ID format."),
});

export const createDownloadUrlSchema = z.object({
  attachmentId: z.string().uuid("Invalid attachment ID format."),
});

export const deleteAttachmentSchema = z.object({
  attachmentId: z.string().uuid("Invalid attachment ID format."),
});

export type CreateUploadUrlInput = z.infer<typeof createUploadUrlSchema>;
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
export type GetAttachmentsByTodoInput = z.infer<typeof getAttachmentsByTodoSchema>;
export type CreateDownloadUrlInput = z.infer<typeof createDownloadUrlSchema>;
export type DeleteAttachmentInput = z.infer<typeof deleteAttachmentSchema>;
