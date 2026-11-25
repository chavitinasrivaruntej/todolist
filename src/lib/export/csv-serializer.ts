import type { ExportedTodoItem } from "@/lib/validations/analytics";

export const CSV_EXPORT_HEADERS = [
  "id",
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
  "completedAt",
  "createdAt",
  "updatedAt",
  "listId",
  "listName",
  "tags",
  "recurrence",
] as const;

const DANGEROUS_FORMULA_PREFIXES = new Set(["=", "+", "-", "@", "\t", "\r", "|"]);

/**
 * Mitigates spreadsheet formula injection (CSV injection) in Excel and LibreOffice Calc.
 * If a non-empty string begins with a dangerous formula character—even after leading
 * whitespace or control characters—it is prefixed with a single quote (`'`), forcing
 * spreadsheet applications to treat the cell strictly as literal text.
 *
 * Trade-off: Exported CSV cells beginning with `=`, `+`, `-`, `@`, `|`, tab, or CR
 * will contain a leading `'` when opened as raw text, preserving safety over raw display.
 * Stored database values are never modified.
 */
export function sanitizeCsvFormulaCell(value: string): string {
  if (value.length === 0) return value;

  const firstChar = value.charAt(0);
  if (DANGEROUS_FORMULA_PREFIXES.has(firstChar)) {
    return `'${value}`;
  }

  // Also check after stripping leading whitespace/control characters (e.g., " =cmd()", "\u0000=1+1")
  const trimmedLeading = value.replace(/^[\s\u0000-\u001F\u007F]+/, "");
  if (trimmedLeading.length > 0 && DANGEROUS_FORMULA_PREFIXES.has(trimmedLeading.charAt(0))) {
    return `'${value}`;
  }

  return value;
}

/**
 * Serializes a single cell into an RFC 4180 quoted CSV field with formula injection mitigation.
 */
export function serializeCsvField(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) {
    return '""';
  }

  const safeText = sanitizeCsvFormulaCell(String(raw));
  const escapedQuotes = safeText.replace(/"/g, '""');
  return `"${escapedQuotes}"`;
}

export function serializeCsvHeaderRow(): string {
  return CSV_EXPORT_HEADERS.map((h) => serializeCsvField(h)).join(",");
}

export function serializeTodoCsvRow(item: ExportedTodoItem): string {
  const tagsSummary = item.tags.map((t) => t.name).join("; ");
  const recurrenceSummary = item.recurrence
    ? `${item.recurrence.frequency} (every ${item.recurrence.interval}, #${item.recurrence.occurrenceNumber ?? "?"})`
    : "";

  const fields = [
    item.id,
    item.title,
    item.description ?? "",
    item.status,
    item.priority,
    item.dueDate ?? "",
    item.completedAt ?? "",
    item.createdAt,
    item.updatedAt,
    item.listId,
    item.listName,
    tagsSummary,
    recurrenceSummary,
  ];

  return fields.map((f) => serializeCsvField(f)).join(",");
}
