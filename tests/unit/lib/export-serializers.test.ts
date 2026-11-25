import { describe, it, expect } from "vitest";
import {
  CSV_EXPORT_HEADERS,
  sanitizeCsvFormulaCell,
  serializeCsvField,
  serializeCsvHeaderRow,
  serializeTodoCsvRow,
} from "@/lib/export/csv-serializer";
import {
  buildJsonExportMetadata,
  JSON_EXPORT_SCHEMA_VERSION,
} from "@/lib/export/json-serializer";
import type { ExportedTodoItem } from "@/lib/validations/analytics";

describe("CSV & JSON Export Serializers", () => {
  describe("CSV Formula Injection Mitigation", () => {
    it("prefixes dangerous leading characters (=, +, -, @, |, tab, CR) with single quote", () => {
      expect(sanitizeCsvFormulaCell("=SUM(A1:A2)")).toBe("'=SUM(A1:A2)");
      expect(sanitizeCsvFormulaCell("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
      expect(sanitizeCsvFormulaCell("-1+1")).toBe("'-1+1");
      expect(sanitizeCsvFormulaCell("@SUM(1+1)")).toBe("'@SUM(1+1)");
      expect(sanitizeCsvFormulaCell("|calc")).toBe("'|calc");
      expect(sanitizeCsvFormulaCell("\t=1+1")).toBe("'\t=1+1");
      expect(sanitizeCsvFormulaCell("\r=1+1")).toBe("'\r=1+1");
    });

    it("mitigates formula payloads hidden behind leading spaces or control characters", () => {
      expect(sanitizeCsvFormulaCell("   =HYPERLINK(\"http://evil.com\")")).toBe(
        "'   =HYPERLINK(\"http://evil.com\")"
      );
      expect(sanitizeCsvFormulaCell("\u0000+1+1")).toBe("'\u0000+1+1");
      expect(sanitizeCsvFormulaCell("\n-2+3")).toBe("'\n-2+3");
    });

    it("leaves normal text, numbers, and empty strings unmodified", () => {
      expect(sanitizeCsvFormulaCell("")).toBe("");
      expect(sanitizeCsvFormulaCell("Buy groceries")).toBe("Buy groceries");
      expect(sanitizeCsvFormulaCell("12345")).toBe("12345");
      expect(sanitizeCsvFormulaCell("Task with = sign in middle")).toBe(
        "Task with = sign in middle"
      );
    });
  });

  describe("CSV Field & Row Serialization (RFC 4180)", () => {
    it("handles commas, embedded quotes, newlines, Unicode, and null/empty values", () => {
      expect(serializeCsvField(null)).toBe('""');
      expect(serializeCsvField(undefined)).toBe('""');
      expect(serializeCsvField('Hello, "World"')).toBe('"Hello, ""World"""');
      expect(serializeCsvField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
      expect(serializeCsvField("Café 🚀 日本語")).toBe('"Café 🚀 日本語"');
      expect(serializeCsvField('=cmd("calc")')).toBe('"\'=cmd(""calc"")"');
    });

    it("produces expected CSV header row", () => {
      const header = serializeCsvHeaderRow();
      expect(header).toBe(CSV_EXPORT_HEADERS.map((h) => `"${h}"`).join(","));
    });

    it("serializes a full ExportedTodoItem safely without mutating the source object", () => {
      const item: ExportedTodoItem = {
        id: "todo-1",
        title: '=WEBSERVICE("https://attacker.example")',
        description: 'Details with "quotes"\nand newline',
        status: "DONE",
        priority: "HIGH",
        dueDate: "2026-11-30",
        completedAt: "2026-11-25T10:00:00.000Z",
        createdAt: "2026-11-20T09:00:00.000Z",
        updatedAt: "2026-11-25T10:00:00.000Z",
        listId: "list-1",
        listName: "+My List",
        tags: [
          { id: "tag-1", name: "Urgent", color: "red" },
          { id: "tag-2", name: "@Home", color: "blue" },
        ],
        recurrence: {
          ruleId: "rule-1",
          occurrenceNumber: 3,
          frequency: "WEEKLY",
          interval: 1,
        },
      };

      const row = serializeTodoCsvRow(item);

      // Source object remains untouched
      expect(item.title).toBe('=WEBSERVICE("https://attacker.example")');
      expect(item.listName).toBe("+My List");

      // Serialized row has formula mitigations
      expect(row).toContain('"\'=WEBSERVICE(""https://attacker.example"")"');
      expect(row).toContain('"\'+My List"');
      expect(row).toContain('"Details with ""quotes""\nand newline"');
      expect(row).toContain('"Urgent; @Home"');
      expect(row).toContain('"WEEKLY (every 1, #3)"');
    });
  });

  describe("JSON Export Envelope", () => {
    it("produces versioned JSON metadata for single-list and all-accessible-lists scopes", () => {
      const fixedDate = new Date("2026-11-25T12:00:00.000Z");

      const singleListMeta = buildJsonExportMetadata(
        {
          type: "list",
          listId: "11111111-1111-4111-8111-111111111111",
          listName: "Work",
          accessibleListCount: 1,
        },
        42,
        fixedDate
      );

      expect(singleListMeta).toEqual({
        schemaVersion: JSON_EXPORT_SCHEMA_VERSION,
        exportedAt: "2026-11-25T12:00:00.000Z",
        scope: {
          type: "list",
          listId: "11111111-1111-4111-8111-111111111111",
          listName: "Work",
        },
        totalTasks: 42,
      });

      const allListsMeta = buildJsonExportMetadata(
        {
          type: "all-accessible-lists",
          listId: null,
          listName: null,
          accessibleListCount: 3,
        },
        0,
        fixedDate
      );

      expect(allListsMeta).toEqual({
        schemaVersion: 1,
        exportedAt: "2026-11-25T12:00:00.000Z",
        scope: {
          type: "all-accessible-lists",
        },
        totalTasks: 0,
      });
    });
  });
});
