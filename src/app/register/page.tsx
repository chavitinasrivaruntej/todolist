import { RegisterForm } from "@/components/auth/register-form";

export const metadata = {
  title: "Create Account - Caize Todo",
  description: "Create your personal Todo workspace account",
};

export default function RegisterPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-neutral-50/50 dark:bg-neutral-950">
      <div className="w-full max-w-md flex flex-col items-center space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
            Caize Todo
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Minimalist task management with modular architecture
          </p>
        </div>
        <RegisterForm />
      </div>
    </main>
  );
}
