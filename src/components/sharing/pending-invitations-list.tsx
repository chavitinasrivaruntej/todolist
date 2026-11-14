"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, XCircle, Clock, AlertCircle } from "lucide-react";

interface PendingInvitationsListProps {
  listId: string;
  invitations: Array<{
    id: string;
    email: string;
    role: "EDITOR" | "VIEWER";
    expiresAt: Date | string;
    status: string;
  }>;
}

export function PendingInvitationsList({
  listId,
  invitations,
}: PendingInvitationsListProps) {
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);

  const utils = trpc.useUtils();

  const revokeMutation = trpc.sharing.revokeInvitation.useMutation({
    onSuccess: async () => {
      setErrorMsg(null);
      setRevokingId(null);
      await utils.sharing.getMembersAndInvites.invalidate({ listId });
    },
    onError: (err) => {
      setRevokingId(null);
      setErrorMsg(err.message || "Failed to revoke invitation.");
    },
  });

  const handleRevoke = (invitationId: string) => {
    setErrorMsg(null);
    setRevokingId(invitationId);
    revokeMutation.mutate({ invitationId });
  };

  if (invitations.length === 0) {
    return (
      <p className="text-xs text-neutral-500 text-center py-2">
        No pending invitations.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 p-2 rounded bg-red-50 text-red-700 text-xs border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {invitations.map((inv) => {
        const isRevoking = revokingId === inv.id;
        const expiresDate = new Date(inv.expiresAt);
        const isExpired = new Date() > expiresDate;

        return (
          <div
            key={inv.id}
            className="flex items-center justify-between p-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 text-xs gap-2"
          >
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                  {inv.email}
                </span>
                <Badge
                  variant={inv.role === "EDITOR" ? "default" : "secondary"}
                  className="text-[10px] py-0 px-1.5"
                >
                  {inv.role}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                <Clock className="h-3 w-3" />
                <span>
                  {isExpired
                    ? "Expired"
                    : `Expires ${expiresDate.toLocaleDateString()}`}
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRevoking}
              onClick={() => handleRevoke(inv.id)}
              className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-200 dark:border-red-900/60"
            >
              {isRevoking ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  Revoking...
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3 mr-1" />
                  Revoke
                </>
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

