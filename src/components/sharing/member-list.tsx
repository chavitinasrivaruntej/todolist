"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Crown, Shield, Eye, AlertCircle } from "lucide-react";

interface MemberListProps {
  listId: string;
  owner: { id: string; email: string };
  members: Array<{
    id: string;
    listId: string;
    userId: string;
    role: "EDITOR" | "VIEWER";
    email?: string | null;
  }>;
  isOwner: boolean;
}

export function MemberList({
  listId,
  owner,
  members,
  isOwner,
}: MemberListProps) {
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = React.useState<string | null>(null);

  const utils = trpc.useUtils();

  const updateRoleMutation = trpc.sharing.updateRole.useMutation({
    onSuccess: async () => {
      setErrorMsg(null);
      setBusyMemberId(null);
      await utils.sharing.getMembersAndInvites.invalidate({ listId });
    },
    onError: (err) => {
      setBusyMemberId(null);
      setErrorMsg(err.message || "Failed to update member role.");
    },
  });

  const removeMemberMutation = trpc.sharing.removeMember.useMutation({
    onSuccess: async () => {
      setErrorMsg(null);
      setBusyMemberId(null);
      await utils.sharing.getMembersAndInvites.invalidate({ listId });
    },
    onError: (err) => {
      setBusyMemberId(null);
      setErrorMsg(err.message || "Failed to remove collaborator.");
    },
  });

  const handleRoleChange = (memberId: string, role: "EDITOR" | "VIEWER") => {
    setErrorMsg(null);
    setBusyMemberId(memberId);
    updateRoleMutation.mutate({ memberId, role });
  };

  const handleRemoveMember = (memberId: string) => {
    setErrorMsg(null);
    setBusyMemberId(memberId);
    removeMemberMutation.mutate({ memberId });
  };

  return (
    <div className="space-y-3">
      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 p-2 rounded bg-red-50 text-red-700 text-xs border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Owner Entry */}
      <div className="flex items-center justify-between p-2.5 rounded-md bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-200/80 dark:border-neutral-800/80 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
            <Crown className="h-3.5 w-3.5" />
          </div>
          <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
            {owner.email}
          </span>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase font-semibold text-amber-700 border-amber-300 dark:border-amber-800">
          Owner
        </Badge>
      </div>

      {/* Collaborator Members */}
      {members.length === 0 ? (
        <p className="text-xs text-neutral-500 text-center py-2">
          No other collaborators have joined this list yet.
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => {
            const isBusy = busyMemberId === member.id;
            return (
              <div
                key={member.id}
                className="flex items-center justify-between p-2.5 rounded-md border border-neutral-200 dark:border-neutral-800 text-xs gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {member.role === "EDITOR" ? (
                      <Shield className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                    {member.email ?? member.userId}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isOwner ? (
                    <>
                      <select
                        value={member.role}
                        disabled={isBusy}
                        onChange={(e) =>
                          handleRoleChange(
                            member.id,
                            e.target.value as "EDITOR" | "VIEWER"
                          )
                        }
                        className="text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                      >
                        <option value="EDITOR">Editor</option>
                        <option value="VIEWER">Viewer</option>
                      </select>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => handleRemoveMember(member.id)}
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                        title="Remove member"
                        aria-label={`Remove ${member.email ?? member.userId}`}
                      >
                        {isBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <Badge variant={member.role === "EDITOR" ? "default" : "secondary"}>
                      {member.role}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

