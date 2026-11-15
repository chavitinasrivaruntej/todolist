"use client";

import { useState, useEffect, useCallback } from "react";

export type ViewMode = "list" | "board" | "activity";

const STORAGE_KEY = "caize_view_preferences_v1";

/**
 * Safely reads and parses the view preferences dictionary from localStorage.
 * Gracefully falls back to an empty record on errors, invalid JSON, or restricted environments.
 */
function readStoredPreferences(): Record<string, ViewMode> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }

    const validated: Record<string, ViewMode> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (val === "list" || val === "board" || val === "activity") {
        validated[key] = val;
      }
    }
    return validated;
  } catch {
    return {};
  }
}

/**
 * Safely writes view preferences dictionary to localStorage.
 */
function persistPreferences(prefs: Record<string, ViewMode>): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore quota or privacy restrictions
  }
}

/**
 * Custom hook to store and retrieve view preferences (List, Board, Activity) independently per Todo list.
 * Guarantees zero SSR hydration mismatches by initializing with default 'list' and syncing on mount.
 */
export function useListViewPreference(listId: string | null) {
  const [preferences, setPreferences] = useState<Record<string, ViewMode>>({});
  const [isHydrated, setIsHydrated] = useState(false);

  // Sync with localStorage on client mount
  useEffect(() => {
    const stored = readStoredPreferences();
    setPreferences(stored);
    setIsHydrated(true);
  }, []);

  const viewMode: ViewMode = listId && preferences[listId] ? preferences[listId] : "list";

  const setViewMode = useCallback(
    (newMode: ViewMode) => {
      if (!listId) return;

      const latest = readStoredPreferences();
      const updated = { ...latest, [listId]: newMode };
      persistPreferences(updated);
      setPreferences(updated);
    },
    [listId]
  );

  return {
    viewMode,
    setViewMode,
    isHydrated,
  };
}
