"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Loader2,
  RefreshCw,
  UserPlus,
  CheckCircle2,
  UserMinus,
  LogOut,
  Shield,
  XCircle,
  ExternalLink,
} from "lucide-react";
import type { NotificationType } from "@/db/schema/notifications";

interface NotificationBellProps {
  onSelectList?: (listId: string) => void;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "INVITATION_RECEIVED":
      return <UserPlus className="h-4 w-4 text-blue-500" />;
    case "INVITATION_ACCEPTED":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "MEMBER_REMOVED":
      return <UserMinus className="h-4 w-4 text-red-500" />;
    case "MEMBER_LEFT":
      return <LogOut className="h-4 w-4 text-amber-500" />;
    case "MEMBER_ROLE_CHANGED":
      return <Shield className="h-4 w-4 text-purple-500" />;
    case "INVITATION_REVOKED":
      return <XCircle className="h-4 w-4 text-rose-500" />;
    default:
      return <Bell className="h-4 w-4 text-neutral-500" />;
  }
}

export function NotificationBell({ onSelectList }: NotificationBellProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  const { data: unreadData } = trpc.notification.getUnreadCount.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  const {
    data: notificationsData,
    isLoading,
    isRefetching,
    refetch,
  } = trpc.notification.list.useQuery(
    { limit: 20 },
    {
      enabled: isOpen,
      refetchOnWindowFocus: true,
    }
  );

  const markAsReadMutation = trpc.notification.markAsRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  const markAllAsReadMutation = trpc.notification.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  const deleteMutation = trpc.notification.delete.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  const unreadCount = unreadData?.count ?? 0;

  // Close panel when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = (item: { listId: string | null; isRead: boolean; id: string }) => {
    if (!item.isRead) {
      markAsReadMutation.mutate({ id: item.id });
    }
    if (item.listId && onSelectList) {
      onSelectList(item.listId);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Notifications (${unreadCount} unread)`}
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-neutral-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-10 z-50 w-80 sm:w-96 rounded-xl border border-neutral-200 bg-white p-0 shadow-lg dark:border-neutral-800 dark:bg-neutral-900 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                onClick={() => refetch()}
                disabled={isRefetching}
                title="Refresh notifications"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin" : ""}`}
                />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 gap-1"
                  onClick={() => markAllAsReadMutation.mutate()}
                  disabled={markAllAsReadMutation.isPending}
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-8 text-neutral-400">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <p className="text-xs">Loading notifications...</p>
              </div>
            ) : notificationsData?.items && notificationsData.items.length > 0 ? (
              notificationsData.items.map((item) => (
                <div
                  key={item.id}
                  className={`group relative flex items-start gap-3 p-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/40 ${
                    !item.isRead
                      ? "bg-blue-50/40 dark:bg-blue-950/20"
                      : "bg-white dark:bg-neutral-900"
                  }`}
                >
                  <div className="mt-0.5 shrink-0 rounded-full p-1.5 bg-neutral-100 dark:bg-neutral-800">
                    {getNotificationIcon(item.type)}
                  </div>

                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleNotificationClick(item)}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <p
                        className={`text-xs truncate ${
                          !item.isRead
                            ? "font-semibold text-neutral-900 dark:text-neutral-100"
                            : "font-medium text-neutral-700 dark:text-neutral-300"
                        }`}
                      >
                        {item.title}
                      </p>
                      <span className="text-[10px] text-neutral-400 shrink-0">
                        {formatRelativeTime(new Date(item.createdAt))}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">
                      {item.message}
                    </p>
                    {item.listId && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 mt-1 hover:underline">
                        View list <ExternalLink className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!item.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsReadMutation.mutate({ id: item.id });
                        }}
                        title="Mark as read"
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate({ id: item.id });
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 mb-2">
                  <CheckCheck className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  You&apos;re all caught up!
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  No notifications to show.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

