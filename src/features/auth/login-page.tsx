import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, LoaderCircle, LockKeyhole } from "lucide-react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";

import { loginSchema, type LoginInput } from "@shared/schemas/auth";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/api-client";

import { useLogin } from "./auth-hooks";

export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const login = useLogin();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = form.handleSubmit(async (input) => {
    login.reset();

    try {
      await login.mutateAsync(input);
      navigate(getReturnPath(location.state), { replace: true });
    } catch {
      // The mutation state renders the safe server error below.
    }
  });

  return (
    <main className="grid min-h-svh bg-muted/45 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.72fr)]">
      <section className="hidden border-r bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-white/10">
            <Building2 aria-hidden="true" className="size-5" />
          </span>
          <span className="font-semibold">Real Estate Inventory</span>
        </div>
        <div className="max-w-xl space-y-4">
          <p className="text-4xl font-semibold leading-tight tracking-tight">
            Keep every listing organized in one secure workspace.
          </p>
          <p className="max-w-lg text-base leading-7 text-primary-foreground/70">
            Review availability, manage property details, and keep your internal
            team aligned.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/55">
          Internal access only
        </p>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Building2 aria-hidden="true" className="size-5" />
            </span>
            <span className="font-semibold">Real Estate Inventory</span>
          </div>

          <Card className="shadow-md">
            <CardHeader>
              <div className="mb-2 grid size-10 place-items-center rounded-lg bg-secondary text-primary">
                <LockKeyhole aria-hidden="true" className="size-5" />
              </div>
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription>
                Sign in with your internal account to continue.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" noValidate onSubmit={submit}>
                {login.error ? (
                  <Alert className="border-destructive/35 bg-destructive/5 text-destructive">
                    {getLoginError(login.error)}
                  </Alert>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    aria-describedby="email-error"
                    aria-invalid={Boolean(form.formState.errors.email)}
                    autoComplete="email"
                    id="email"
                    placeholder="you@company.com"
                    type="email"
                    {...form.register("email")}
                  />
                  <FieldError
                    id="email-error"
                    message={form.formState.errors.email?.message}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    aria-describedby="password-error"
                    aria-invalid={Boolean(form.formState.errors.password)}
                    autoComplete="current-password"
                    id="password"
                    type="password"
                    {...form.register("password")}
                  />
                  <FieldError
                    id="password-error"
                    message={form.formState.errors.password?.message}
                  />
                </div>

                <Button
                  className="w-full"
                  disabled={login.isPending}
                  size="lg"
                  type="submit"
                >
                  {login.isPending ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : null}
                  {login.isPending ? "Signing in…" : "Sign in"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  return (
    <p className="min-h-5 text-sm text-destructive" id={id}>
      {message}
    </p>
  );
}

function getLoginError(error: Error): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Unable to sign in. Please try again.";
}

function getReturnPath(state: unknown): string {
  if (!state || typeof state !== "object") {
    return "/dashboard";
  }

  if (!("returnTo" in state)) {
    return "/dashboard";
  }

  const returnTo = state.returnTo;

  return typeof returnTo === "string" && returnTo.startsWith("/")
    ? returnTo
    : "/dashboard";
}
