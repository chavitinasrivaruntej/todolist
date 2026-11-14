"use client";

import * as React from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, Send, CheckCircle, AlertTriangle, Copy } from "lucide-react";

interface InviteMemberFormProps {
  listId: string;
  onSuccess?: () => void;
}

export function InviteMemberForm({ listId, onSuccess }: InviteMemberFormProps) {
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"EDITOR" | "VIEWER">("EDITOR");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successInfo, setSuccessInfo] = React.useState<{
    url: string;
    email: string;
  } | null>(null);
  const [copied, setCopied] = React.useState(false);

  const utils = trpc.useUtils();

  const inviteMutation = trpc.sharing.invite.useMutation({
    onSuccess: (data) => {
      setEmail("");
      setErrorMsg(null);
      setSuccessInfo({ url: data.invitationUrl, email });
      utils.sharing.getMembersAndInvites.invalidate({ listId });
      onSuccess?.();
    },
    onError: (err) => {
      setErrorMsg(err.message || "Failed to dispatch invitation.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessInfo(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMsg("Please provide an email address.");
      return;
    }

    inviteMutation.mutate({
      listId,
      email: trimmed,
      role,
    });
  };

  const handleCopyLink = async () => {
    if (!successInfo?.url) return;
    try {
      await navigator.clipboard.writeText(successInfo.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2 p-2.5 rounded-md bg-red-50 text-red-700 text-xs border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successInfo && (
        <div className="p-3 rounded-md bg-emerald-50 text-emerald-800 text-xs border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900 space-y-2">
          <div className="flex items-center gap-1.5 font-medium">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Invitation created for {successInfo.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={successInfo.url}
              className="text-xs font-mono h-8 bg-white dark:bg-neutral-900"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 gap-1 text-xs"
              onClick={handleCopyLink}
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          Collaborator Email
        </label>
        <div className="relative">
          <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
          <Input
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={inviteMutation.isPending}
            className="pl-8 text-xs"
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
          Permission Level
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRole("EDITOR")}
            className={`p-2.5 text-left rounded-md border text-xs transition-colors ${
              role === "EDITOR"
                ? "border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-900 font-semibold"
                : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/40"
            }`}
          >
            <div className="font-medium text-neutral-900 dark:text-neutral-100">
              Editor
            </div>
            <div className="text-[11px] text-neutral-500 font-normal">
              Can add, edit, move and delete tasks
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRole("VIEWER")}
            className={`p-2.5 text-left rounded-md border text-xs transition-colors ${
              role === "VIEWER"
                ? "border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-900 font-semibold"
                : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/40"
            }`}
          >
            <div className="font-medium text-neutral-900 dark:text-neutral-100">
              Viewer
            </div>
            <div className="text-[11px] text-neutral-500 font-normal">
              Read-only access to view tasks
            </div>
          </button>
        </div>
      </div>

      <Button
        type="submit"
        size="sm"
        disabled={inviteMutation.isPending || !email.trim()}
        className="w-full gap-1.5"
      >
        {inviteMutation.isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sending Invite...
          </>
        ) : (
          <>
            <Send className="h-3.5 w-3.5" />
            Send Invitation
          </>
        )}
      </Button>
    </form>
  );
}

