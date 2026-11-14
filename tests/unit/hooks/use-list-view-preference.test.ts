import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useListViewPreference } from "@/hooks/use-list-view-preference";

describe("useListViewPreference Hook", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should default to 'list' view when no preference is stored", () => {
    const { result } = renderHook(() => useListViewPreference("list-1"));
    expect(result.current.viewMode).toBe("list");
  });

  it("should update view mode and persist to localStorage", () => {
    const { result } = renderHook(() => useListViewPreference("list-1"));

    act(() => {
      result.current.setViewMode("board");
    });

    expect(result.current.viewMode).toBe("board");
    expect(JSON.parse(window.localStorage.getItem("caize_view_preferences_v1") || "{}")).toEqual({
      "list-1": "board",
    });
  });

  it("should maintain independent view preferences across different lists", () => {
    const { result: hookList1 } = renderHook(() => useListViewPreference("list-1"));
    const { result: hookList2 } = renderHook(() => useListViewPreference("list-2"));

    act(() => {
      hookList1.current.setViewMode("board");
      hookList2.current.setViewMode("list");
    });

    expect(hookList1.current.viewMode).toBe("board");
    expect(hookList2.current.viewMode).toBe("list");

    const saved = JSON.parse(window.localStorage.getItem("caize_view_preferences_v1") || "{}");
    expect(saved).toEqual({
      "list-1": "board",
      "list-2": "list",
    });
  });

  it("should gracefully handle malformed or corrupted localStorage data", () => {
    window.localStorage.setItem("caize_view_preferences_v1", "INVALID_JSON_CONTENT{{{");

    const { result } = renderHook(() => useListViewPreference("list-1"));

    expect(result.current.viewMode).toBe("list");

    // Setting a new preference should overwrite the corrupted state cleanly
    act(() => {
      result.current.setViewMode("board");
    });

    expect(result.current.viewMode).toBe("board");
  });

  it("should ignore invalid view mode strings in localStorage", () => {
    window.localStorage.setItem(
      "caize_view_preferences_v1",
      JSON.stringify({ "list-1": "invalid_mode", "list-2": "board" })
    );

    const { result: hookList1 } = renderHook(() => useListViewPreference("list-1"));
    const { result: hookList2 } = renderHook(() => useListViewPreference("list-2"));

    // list-1 should fallback to 'list'
    expect(hookList1.current.viewMode).toBe("list");
    // list-2 should read 'board'
    expect(hookList2.current.viewMode).toBe("board");
  });
});

