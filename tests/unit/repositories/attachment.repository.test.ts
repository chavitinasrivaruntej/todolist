import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttachmentRepository } from "@/server/repositories/attachment.repository";
import { type Database } from "@/db";
import { type TodoAttachment } from "@/db/schema/attachments";

describe("AttachmentRepository Unit Tests", () => {
  let repository: AttachmentRepository;
  let mockDb: any;

  const sampleAttachment: TodoAttachment = {
    id: "attach-111",
    todoId: "todo-222",
    listId: "list-333",
    storagePath: "lists/list-333/todos/todo-222/uuid-sample.pdf",
    originalFilename: "sample.pdf",
    sanitizedFilename: "sample.pdf",
    mimeType: "application/pdf",
    fileSize: 1024 * 50,
    status: "ACTIVE",
    expiresAt: null,
    deletedAt: null,
    uploadedBy: "user-444",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    repository = new AttachmentRepository(mockDb);
  });

  describe("reserveUploadSlot", () => {
    it("should acquire row lock on parent task, check count, and insert reservation", async () => {
      const mockTx: any = {
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              for: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockResolvedValue([{ id: "todo-222" }]),
              }),
            }),
          }),
        }).mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockResolvedValue([{ count: 2 }]),
          }),
        }),
        insert: vi.fn().mockReturnValueOnce({
          values: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValue([{ ...sampleAttachment, status: "PENDING_UPLOAD" }]),
          }),
        }),
      };

      const result = await repository.reserveUploadSlot(
        {
          todoId: "todo-222",
          listId: "list-333",
          storagePath: "lists/list-333/todos/todo-222/uuid-sample.pdf",
          originalFilename: "sample.pdf",
          sanitizedFilename: "sample.pdf",
          mimeType: "application/pdf",
          fileSize: 50000,
          uploadedBy: "user-444",
          expiresAt: new Date(Date.now() + 600000),
        },
        10,
        mockTx
      );

      expect(result.status).toBe("PENDING_UPLOAD");
      expect(mockTx.select).toHaveBeenCalledTimes(2);
      expect(mockTx.insert).toHaveBeenCalledTimes(1);
    });

    it("should throw error if current count reaches or exceeds maxLimit", async () => {
      const mockTx: any = {
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockReturnValueOnce({
              for: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockResolvedValue([{ id: "todo-222" }]),
              }),
            }),
          }),
        }).mockReturnValueOnce({
          from: vi.fn().mockReturnValueOnce({
            where: vi.fn().mockResolvedValue([{ count: 10 }]),
          }),
        }),
      };

      await expect(
        repository.reserveUploadSlot(
          {
            todoId: "todo-222",
            listId: "list-333",
            storagePath: "lists/list-333/todos/todo-222/uuid-sample.pdf",
            originalFilename: "sample.pdf",
            sanitizedFilename: "sample.pdf",
            mimeType: "application/pdf",
            fileSize: 50000,
            uploadedBy: "user-444",
            expiresAt: new Date(Date.now() + 600000),
          },
          10,
          mockTx
        )
      ).rejects.toThrow("TASK_ATTACHMENT_LIMIT_EXCEEDED");
    });
  });

  describe("findById and findByStoragePath", () => {
    it("should find attachment by id", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([sampleAttachment]),
          }),
        }),
      });

      const res = await repository.findById("attach-111");
      expect(res).toEqual(sampleAttachment);
    });

    it("should find attachment by storagePath", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            limit: vi.fn().mockResolvedValue([sampleAttachment]),
          }),
        }),
      });

      const res = await repository.findByStoragePath(sampleAttachment.storagePath);
      expect(res).toEqual(sampleAttachment);
    });
  });

  describe("status transitions", () => {
    it("should mark attachment ACTIVE", async () => {
      const activeRecord = { ...sampleAttachment, status: "ACTIVE" as const, expiresAt: null };
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValue([activeRecord]),
          }),
        }),
      });

      const res = await repository.markActive("attach-111");
      expect(res?.status).toBe("ACTIVE");
      expect(res?.expiresAt).toBeNull();
    });

    it("should mark attachment PENDING_DELETION", async () => {
      const deletedRecord = { ...sampleAttachment, status: "PENDING_DELETION" as const, deletedAt: new Date() };
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            returning: vi.fn().mockResolvedValue([deletedRecord]),
          }),
        }),
      });

      const res = await repository.markPendingDeletion("attach-111");
      expect(res?.status).toBe("PENDING_DELETION");
      expect(res?.deletedAt).toBeDefined();
    });

    it("should hard delete attachment", async () => {
      mockDb.delete.mockReturnValueOnce({
        where: vi.fn().mockReturnValueOnce({
          returning: vi.fn().mockResolvedValue([{ id: "attach-111" }]),
        }),
      });

      const res = await repository.hardDelete("attach-111");
      expect(res).toBe(true);
    });
  });

  describe("batch counting", () => {
    it("should return empty map if todoIds list is empty", async () => {
      const res = await repository.getAttachmentCountsForTodos([]);
      expect(res.size).toBe(0);
    });

    it("should return counts map for multiple todos", async () => {
      mockDb.select.mockReturnValueOnce({
        from: vi.fn().mockReturnValueOnce({
          where: vi.fn().mockReturnValueOnce({
            groupBy: vi.fn().mockResolvedValue([
              { todoId: "todo-1", count: 3 },
              { todoId: "todo-2", count: 1 },
            ]),
          }),
        }),
      });

      const res = await repository.getAttachmentCountsForTodos(["todo-1", "todo-2"]);
      expect(res.get("todo-1")).toBe(3);
      expect(res.get("todo-2")).toBe(1);
      expect(res.get("todo-3")).toBeUndefined();
    });
  });
});
