import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AttachmentCountBadge } from "@/components/todos/attachments/attachment-count-badge";
import { AttachmentItem, formatFileSize } from "@/components/todos/attachments/attachment-item";
import { AttachmentPreviewModal } from "@/components/todos/attachments/attachment-preview-modal";
import { type TodoAttachment } from "@/db/schema/attachments";

// Mock TRPC
vi.mock("@/lib/trpc/client", () => ({
  trpc: {
    useUtils: () => ({
      attachment: {
        getByTodo: { invalidate: vi.fn() },
      },
      todo: {
        list: { invalidate: vi.fn() },
      },
    }),
    attachment: {
      createDownloadUrl: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
      delete: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
      getByTodo: {
        useQuery: () => ({
          data: [],
          isLoading: false,
        }),
      },
      createUploadUrl: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
      confirmUpload: {
        useMutation: () => ({
          mutateAsync: vi.fn(),
          isPending: false,
        }),
      },
    },
  },
}));

describe("Attachment Frontend Components", () => {
  describe("AttachmentCountBadge", () => {
    it("should return null when count is 0 or negative", () => {
      const { container } = render(<AttachmentCountBadge count={0} />);
      expect(container.firstChild).toBeNull();

      const { container: negContainer } = render(<AttachmentCountBadge count={-1} />);
      expect(negContainer.firstChild).toBeNull();
    });

    it("should render badge with paperclip icon and count when count > 0", () => {
      render(<AttachmentCountBadge count={3} />);
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByTitle("3 attachments")).toBeInTheDocument();
    });
  });

  describe("formatFileSize", () => {
    it("should format bytes, KB, and MB accurately", () => {
      expect(formatFileSize(500)).toBe("500 B");
      expect(formatFileSize(2048)).toBe("2.0 KB");
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
    });
  });

  describe("AttachmentItem", () => {
    const sampleAttachment: TodoAttachment = {
      id: "attach-123",
      todoId: "todo-123",
      listId: "list-123",
      storagePath: "lists/list-123/todos/todo-123/uuid-file.pdf",
      originalFilename: "quarterly-report.pdf",
      sanitizedFilename: "quarterly-report.pdf",
      mimeType: "application/pdf",
      fileSize: 1024 * 150, // 150 KB
      status: "ACTIVE",
      expiresAt: null,
      deletedAt: null,
      uploadedBy: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should render filename and formatted size", () => {
      render(
        <AttachmentItem
          attachment={sampleAttachment}
          listId="list-123"
          isReadOnly={false}
        />
      );

      expect(screen.getByText("quarterly-report.pdf")).toBeInTheDocument();
      expect(screen.getByText(/150\.0 KB/)).toBeInTheDocument();
      expect(screen.getByTitle("Download file")).toBeInTheDocument();
      expect(screen.getByTitle("Delete attachment")).toBeInTheDocument();
    });

    it("should hide delete button when isReadOnly is true", () => {
      render(
        <AttachmentItem
          attachment={sampleAttachment}
          listId="list-123"
          isReadOnly={true}
        />
      );

      expect(screen.getByText("quarterly-report.pdf")).toBeInTheDocument();
      expect(screen.getByTitle("Download file")).toBeInTheDocument();
      expect(screen.queryByTitle("Delete attachment")).not.toBeInTheDocument();
    });

    it("should show preview button when attachment is an image", () => {
      const imageAttachment: TodoAttachment = {
        ...sampleAttachment,
        originalFilename: "screenshot.png",
        mimeType: "image/png",
      };

      render(
        <AttachmentItem
          attachment={imageAttachment}
          listId="list-123"
          isReadOnly={false}
        />
      );

      expect(screen.getByTitle("Preview image")).toBeInTheDocument();
    });
  });

  describe("AttachmentPreviewModal", () => {
    it("should render image preview for image MIME types", () => {
      render(
        <AttachmentPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          filename="diagram.png"
          mimeType="image/png"
          downloadUrl="https://storage.supabase.co/diagram.png"
        />
      );

      expect(screen.getByText("diagram.png")).toBeInTheDocument();
      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", "https://storage.supabase.co/diagram.png");
    });

    it("should render download prompt when preview is unavailable for document format", () => {
      render(
        <AttachmentPreviewModal
          isOpen={true}
          onClose={vi.fn()}
          filename="spreadsheet.xlsx"
          mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          downloadUrl="https://storage.supabase.co/spreadsheet.xlsx"
        />
      );

      expect(screen.getByText(/Preview is not available for this file format/)).toBeInTheDocument();
    });

    it("should call onClose when close button clicked", () => {
      const onClose = vi.fn();
      render(
        <AttachmentPreviewModal
          isOpen={true}
          onClose={onClose}
          filename="diagram.png"
          mimeType="image/png"
          downloadUrl="https://storage.supabase.co/diagram.png"
        />
      );

      const closeButtons = screen.getAllByRole("button");
      fireEvent.click(closeButtons[0]);
      expect(onClose).toHaveBeenCalled();
    });
  });
});
