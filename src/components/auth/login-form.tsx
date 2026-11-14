"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, LogIn, AlertCircle } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validationResult = loginSchema.safeParse({ email, password });
    if (!validationResult.success) {
      setErrorMessage(validationResult.error.issues[0]?.message ?? "Invalid credentials format.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: validationResult.data.email,
        password: validationResult.data.password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred during sign in."
      );
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-md border-neutral-200 dark:border-neutral-800">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-neutral-900 text-neutral-50 rounded-lg dark:bg-neutral-100 dark:text-neutral-900">
            <LogIn className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold tracking-tight">Sign In</CardTitle>
            <CardDescription>
              Access your personal Todo workspaces and tasks
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md dark:bg-red-950/50 dark:border-red-900 dark:text-red-400"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Password
              </label>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="current-password"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>

          <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50"
            >
              Create an account
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
