import type { AnalyticsScopeInfo, ExportedTodoItem } from "@/lib/validations/analytics";

export const JSON_EXPORT_SCHEMA_VERSION = 1 as const;

export interface JsonExportEnvelope {
  schemaVersion: typeof JSON_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  scope: {
    type: AnalyticsScopeInfo["type"];
    listId?: string;
    listName?: string;
  };
  totalTasks: number;
  tasks: ExportedTodoItem[];
}

export function buildJsonExportMetadata(
  scope: AnalyticsScopeInfo,
  totalTasks: number,
  exportedAt: Date = new Date()
): Omit<JsonExportEnvelope, "tasks"> {
  return {
    schemaVersion: JSON_EXPORT_SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    scope:
      scope.type === "list" && scope.listId
        ? {
            type: "list",
            listId: scope.listId,
            ...(scope.listName ? { listName: scope.listName } : {}),
          }
        : {
            type: "all-accessible-lists",
          },
    totalTasks,
  };
}
