import * as React from "react";
import { InvitationAcceptCard } from "@/components/sharing/invitation-accept-card";

export const metadata = {
  title: "List Invitation - Caize Todo",
  description: "Accept an invitation to collaborate on a todo list",
};

async function InviteTokenResolver({
  paramsPromise,
}: {
  paramsPromise: Promise<{ token: string }>;
}) {
  const { token } = await paramsPromise;
  return <InvitationAcceptCard token={token} />;
}

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-neutral-50/50 dark:bg-neutral-950">
      <div className="w-full max-w-md flex flex-col items-center space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Caize Todo
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Secure collaborative workspace
          </p>
        </div>
        <React.Suspense
          fallback={
            <div className="flex justify-center p-8">
              <span className="text-sm text-neutral-400">Loading invitation...</span>
            </div>
          }
        >
          <InviteTokenResolver paramsPromise={params} />
        </React.Suspense>
      </div>
    </main>
  );
}
