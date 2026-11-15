"use client";

import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { ActivityItem, type ActivityItemData } from "./activity-item";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  History,
  RefreshCw,
  Loader2,
  ChevronDown,
  Clock,
} from "lucide-react";

interface ActivityTimelineProps {
  listId: string;
}

export function ActivityTimeline({ listId }: ActivityTimelineProps) {
  const [accumulatedItems, setAccumulatedItems] = useState<ActivityItemData[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    error,
  } = trpc.activity.listByList.useQuery(
    { listId, cursor: currentCursor, limit: 25 },
    {
      refetchOnWindowFocus: false,
    }
  );

  // Reset accumulated items when active list changes
  useEffect(() => {
    setAccumulatedItems([]);
    setCurrentCursor(undefined);
  }, [listId]);

  // Append new items when data arrives
  useEffect(() => {
    if (data?.items) {
      if (!currentCursor) {
        setAccumulatedItems(data.items as ActivityItemData[]);
      } else {
        setAccumulatedItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.id));
          const newUnique = (data.items as ActivityItemData[]).filter(
            (i) => !existingIds.has(i.id)
          );
          return [...prev, ...newUnique];
        });
        setIsLoadingMore(false);
      }
    }
  }, [data, currentCursor]);

  const handleLoadMore = () => {
    if (data?.nextCursor) {
      setIsLoadingMore(true);
      setCurrentCursor(data.nextCursor);
    }
  };

  const handleRefresh = async () => {
    setCurrentCursor(undefined);
    await refetch();
  };

  return (
    <Card className="border-neutral-200 dark:border-neutral-800 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-neutral-500" />
          <CardTitle className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Activity Timeline
          </CardTitle>
          <span className="text-[10px] text-neutral-400">
            Chronological audit log
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 gap-1"
          onClick={handleRefresh}
          disabled={isRefetching || isLoading}
          title="Refresh activity"
        >
          <RefreshCw
            className={`h-3 w-3 ${isRefetching ? "animate-spin" : ""}`}
          />
          <span>Refresh</span>
        </Button>
      </CardHeader>

      <CardContent className="p-4">
        {isLoading && accumulatedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-neutral-400">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <p className="text-xs">Loading activity history...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-red-500">
            Failed to load activity logs: {error.message}
          </div>
        ) : accumulatedItems.length > 0 ? (
          <div className="relative">
            {/* Vertical timeline spine */}
            <div className="absolute left-3.5 top-3 bottom-3 w-px bg-neutral-200 dark:bg-neutral-800" />

            <div className="space-y-1">
              {accumulatedItems.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>

            {/* Load More Button */}
            {data?.nextCursor && (
              <div className="pt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 h-8 text-neutral-600 dark:text-neutral-400"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  Load older activity
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-10 text-center text-neutral-400">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 mb-2">
              <Clock className="h-5 w-5 text-neutral-400" />
            </div>
            <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              No activity recorded yet
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Task edits, status changes, and collaborator invitations will appear here.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

