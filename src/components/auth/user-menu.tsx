"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { User, LogOut, Loader2 } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = React.useState<SupabaseUser | null>(null);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const supabase = createClient();

    // Fetch initial user session
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });

    // Listen to auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error("Sign out error:", err);
      setIsSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-neutral-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-medium dark:bg-neutral-800 dark:text-neutral-300">
        <User className="h-3.5 w-3.5 text-neutral-500" />
        <span className="max-w-[160px] truncate" title={user.email ?? "User"}>
          {user.email}
        </span>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="h-8 px-2 text-xs text-neutral-600 hover:text-red-600 dark:text-neutral-400 dark:hover:text-red-400"
        title="Sign Out"
      >
        {isSigningOut ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <LogOut className="h-3.5 w-3.5 mr-1" />
            <span className="hidden sm:inline">Sign Out</span>
          </>
        )}
      </Button>
    </div>
  );
}

