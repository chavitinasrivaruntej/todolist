"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { InviteMemberForm } from "@/components/sharing/invite-member-form";
import { MemberList } from "@/components/sharing/member-list";
import { PendingInvitationsList } from "@/components/sharing/pending-invitations-list";
import { Share2, X, Users, Mail, Loader2, AlertCircle } from "lucide-react";

interface ShareListDialogProps {
  listId: string;
  listName: string;
}

export function ShareListDialog({ listId, listName }: ShareListDialogProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"invite" | "members" | "pending">("invite");

  // Query members & invitations when dialog opens
  const {
    data,
    isLoading,
    isError,
    error,
  } = trpc.sharing.getMembersAndInvites.useQuery(
    { listId },
    {
      enabled: isOpen,
      refetchOnWindowFocus: false,
    }
  );

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const memberCount = data?.members?.length ?? 0;
  const inviteCount = data?.invitations?.length ?? 0;
  const isOwner = data?.currentUserRole === "OWNER";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="h-8 gap-1.5 text-xs font-medium border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <Share2 className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-300" />
        <span>Share</span>
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="relative w-full max-w-lg rounded-xl bg-white dark:bg-neutral-900 shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg text-neutral-800 dark:text-neutral-200">
                  <Users className="h-4 w-4" />
                </div>
                <div>
                  <h3
                    id="share-dialog-title"
                    className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
                  >
                    Share &ldquo;{listName}&rdquo;
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Invite collaborators and manage permissions
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 px-4 pt-2 gap-2 text-xs">
              <button
                onClick={() => setActiveTab("invite")}
                className={`pb-2.5 px-2 border-b-2 font-medium transition-colors ${
                  activeTab === "invite"
                    ? "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  <span>Invite</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("members")}
                className={`pb-2.5 px-2 border-b-2 font-medium transition-colors ${
                  activeTab === "members"
                    ? "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
                    : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  <span>Members ({memberCount + 1})</span>
                </div>
              </button>

              {isOwner && (
                <button
                  onClick={() => setActiveTab("pending")}
                  className={`pb-2.5 px-2 border-b-2 font-medium transition-colors ${
                    activeTab === "pending"
                      ? "border-neutral-900 text-neutral-900 dark:border-neutral-100 dark:text-neutral-100"
                      : "border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
                  }`}
                >
                  <span>Pending Invites ({inviteCount})</span>
                </button>
              )}
            </div>

            {/* Content Area */}
            <div className="p-4 overflow-y-auto flex-1">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 space-y-2">
                  <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
                  <p className="text-xs text-neutral-500">Loading sharing settings...</p>
                </div>
              ) : isError ? (
                <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 text-red-700 text-xs border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error.message || "Failed to load sharing details."}</span>
                </div>
              ) : data ? (
                <>
                  {activeTab === "invite" && (
                    <div className="space-y-4">
                      {isOwner ? (
                        <InviteMemberForm
                          listId={listId}
                          onSuccess={() => {
                            // Can stay on tab or show notification
                          }}
                        />
                      ) : (
                        <p className="text-xs text-neutral-500 py-4 text-center">
                          Only the list owner has permission to invite new collaborators.
                        </p>
                      )}
                    </div>
                  )}

                  {activeTab === "members" && (
                    <MemberList
                      listId={listId}
                      owner={data.owner}
                      members={data.members}
                      isOwner={isOwner}
                    />
                  )}

                  {activeTab === "pending" && isOwner && (
                    <PendingInvitationsList
                      listId={listId}
                      invitations={data.invitations}
                    />
                  )}
                </>
              ) : null}
            </div>

            {/* Footer */}
            <div className="p-3 bg-neutral-50 dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

