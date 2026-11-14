"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerSchema } from "@/lib/validations/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2, UserPlus, AlertCircle, CheckCircle } from "lucide-react";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successNotice, setSuccessNotice] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    const validationResult = registerSchema.safeParse({
      email,
      password,
      confirmPassword,
    });

    if (!validationResult.success) {
      setErrorMessage(validationResult.error.issues[0]?.message ?? "Invalid registration details.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: validationResult.data.email,
        password: validationResult.data.password,
      });

      if (error) {
        setErrorMessage(error.message);
        setIsLoading(false);
        return;
      }

      // If Supabase has email confirmation enabled and session is not immediately returned
      if (data.user && !data.session) {
        setSuccessNotice(
          "Registration successful! Please check your email inbox to confirm your account before logging in."
        );
        setIsLoading(false);
        return;
      }

      // If user session is active, redirect to home dashboard
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred during registration."
      );
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md shadow-md border-neutral-200 dark:border-neutral-800">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-neutral-900 text-neutral-50 rounded-lg dark:bg-neutral-100 dark:text-neutral-900">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-bold tracking-tight">Create Account</CardTitle>
            <CardDescription>
              Sign up for an isolated personal Todo workspace
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

          {successNotice && (
            <div
              role="status"
              className="flex items-start gap-2 p-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md dark:bg-emerald-950/50 dark:border-emerald-900 dark:text-emerald-400"
            >
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successNotice}</span>
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
            <label
              htmlFor="password"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Password (min 8 characters)
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Confirm Password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="new-password"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Sign Up"
            )}
          </Button>

          <p className="text-center text-xs text-neutral-500 dark:text-neutral-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-50"
            >
              Sign In
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
