"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, Users, CheckCircle, AlertTriangle, LogIn, UserPlus, LogOut } from "lucide-react";

interface InvitationAcceptCardProps {
  token: string;
}

export function InvitationAcceptCard({ token }: InvitationAcceptCardProps) {
  const router = useRouter();
  const [sessionEmail, setSessionEmail] = React.useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = React.useState(true);
  const [actionError, setActionError] = React.useState<string | null>(null);

  // Check current client session
  React.useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setSessionEmail(user?.email ?? null);
      } catch {
        setSessionEmail(null);
      } finally {
        setIsCheckingSession(false);
      }
    }
    checkAuth();
  }, []);

  // Query invitation metadata safely
  const {
    data: invite,
    isLoading: isInspectLoading,
    error: inspectError,
  } = trpc.invitation.inspect.useQuery(
    { token },
    {
      retry: false,
    }
  );

  const acceptMutation = trpc.invitation.accept.useMutation({
    onSuccess: (data) => {
      // Navigate to dashboard with active list selected
      router.push(`/?listId=${data.listId}`);
      router.refresh();
    },
    onError: (err) => {
      setActionError(err.message);
    },
  });

  const handleSignOutAndSwitch = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`);
  };

  const handleAccept = () => {
    setActionError(null);
    acceptMutation.mutate({ token });
  };

  if (isInspectLoading || isCheckingSession) {
    return (
      <Card className="w-full max-w-md shadow-md border-neutral-200 dark:border-neutral-800">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
          <p className="text-sm text-neutral-500">Verifying invitation link...</p>
        </CardContent>
      </Card>
    );
  }

  if (inspectError || !invite) {
    return (
      <Card className="w-full max-w-md shadow-md border-red-200 dark:border-red-900/50">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto p-3 bg-red-100 text-red-600 rounded-full dark:bg-red-950/60 dark:text-red-400 w-fit">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg font-bold text-red-700 dark:text-red-400">
            Invalid or Expired Invitation
          </CardTitle>
          <CardDescription className="text-sm text-neutral-600 dark:text-neutral-400">
            {inspectError?.message ?? "This invitation link is not valid or has already expired."}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Go to Dashboard
          </Link>
        </CardFooter>
      </Card>
    );
  }

  const isEmailMatching =
    sessionEmail &&
    sessionEmail.toLowerCase() === invite.targetEmail.toLowerCase();

  return (
    <Card className="w-full max-w-md shadow-md border-neutral-200 dark:border-neutral-800">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto p-3 bg-neutral-100 text-neutral-900 rounded-full dark:bg-neutral-800 dark:text-neutral-100 w-fit">
          <Users className="h-6 w-6" />
        </div>
        <CardTitle className="text-xl font-bold tracking-tight">
          List Collaboration Invitation
        </CardTitle>
        <CardDescription>
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            {invite.inviterEmail}
          </span>{" "}
          invited you to collaborate on
        </CardDescription>
        <div className="pt-2">
          <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-50 bg-neutral-100 dark:bg-neutral-800 px-3 py-1 rounded-md">
            {invite.listName}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {actionError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3 rounded-md bg-red-50 text-red-700 text-sm border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
          >
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        <div className="p-3 bg-neutral-50 dark:bg-neutral-900/60 rounded-lg border border-neutral-200 dark:border-neutral-800 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-neutral-500">Your Offered Role:</span>
            <Badge variant={invite.role === "EDITOR" ? "default" : "secondary"}>
              {invite.role}
            </Badge>
          </div>
          <p className="text-xs text-neutral-500">
            {invite.role === "EDITOR"
              ? "Editors can view, add, edit, move, and delete tasks in this list."
              : "Viewers have read-only access to view tasks and progress."}
          </p>
          <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 flex justify-between items-center text-xs text-neutral-500">
            <span>Invited email:</span>
            <span className="font-mono font-medium text-neutral-700 dark:text-neutral-300">
              {invite.targetEmail}
            </span>
          </div>
        </div>

        {/* Unauthenticated State */}
        {!sessionEmail && (
          <div className="space-y-3 pt-2">
            <p className="text-xs text-neutral-600 dark:text-neutral-400 text-center">
              Please sign in or create an account with{" "}
              <strong className="text-neutral-900 dark:text-neutral-200">
                {invite.targetEmail}
              </strong>{" "}
              to accept this invitation.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                className={cn(buttonVariants({ variant: "outline" }), "w-full text-xs")}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Link>
              <Link
                href={`/register?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                className={cn(buttonVariants({ variant: "default" }), "w-full text-xs")}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Sign Up
              </Link>
            </div>
          </div>
        )}

        {/* Authenticated with matching email */}
        {sessionEmail && isEmailMatching && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded border border-emerald-200 dark:border-emerald-900">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>Signed in as verified invitee: {sessionEmail}</span>
            </div>
            <Button
              className="w-full"
              onClick={handleAccept}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Accepting Invitation...
                </>
              ) : (
                "Accept Invitation & Join List"
              )}
            </Button>
          </div>
        )}

        {/* Authenticated with MISMATCHED email */}
        {sessionEmail && !isEmailMatching && (
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded border border-amber-200 dark:border-amber-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Account mismatch</p>
                <p>
                  You are signed in as <strong>{sessionEmail}</strong>, but this
                  invitation is for <strong>{invite.targetEmail}</strong>.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full text-xs"
              onClick={handleSignOutAndSwitch}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sign Out & Switch Account
            </Button>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-center border-t border-neutral-100 dark:border-neutral-800/80 pt-4">
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-xs")}
        >
          Back to Dashboard
        </Link>
      </CardFooter>
    </Card>
  );
}
