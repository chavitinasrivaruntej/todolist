"use client";

import React from "react";
import type { RealtimeConnectionStatus } from "@/lib/realtime/realtime-client";

interface RealtimeStatusBadgeProps {
  status: RealtimeConnectionStatus;
}

export function RealtimeStatusBadge({ status }: RealtimeStatusBadgeProps) {
  if (status === "IDLE") {
    return null;
  }

  const config = {
    CONNECTED: {
      color: "bg-emerald-500",
      label: "Live sync active",
      pulse: false,
    },
    CONNECTING: {
      color: "bg-amber-500",
      label: "Connecting...",
      pulse: true,
    },
    DISCONNECTED: {
      color: "bg-neutral-400",
      label: "Reconnecting...",
      pulse: true,
    },
    UNAVAILABLE: {
      color: "bg-rose-500",
      label: "Realtime unavailable",
      pulse: false,
    },
  }[status];

  return (
    <div
      className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400"
      title={config.label}
      aria-label={`Realtime status: ${config.label}`}
    >
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.color} opacity-75`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${config.color}`} />
      </span>
      <span className="hidden sm:inline">{status === "CONNECTED" ? "Live" : config.label}</span>
    </div>
  );
}
