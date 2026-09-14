import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, UserPlus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { createUserSchema } from "@shared/schemas/auth";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiClientError } from "@/lib/api-client";

import { useCreateUser } from "../user-hooks";

const addUserSchema = createUserSchema
  .extend({ confirmPassword: z.string().min(1, "Confirm the password.") })
  .refine((input) => input.password === input.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type AddUserInput = z.infer<typeof addUserSchema>;

export function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const createUser = useCreateUser();
  const form = useForm<AddUserInput>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  function changeOpen(nextOpen: boolean): void {
    if (createUser.isPending) return;
    setOpen(nextOpen);

    if (nextOpen) {
      createUser.reset();
      form.reset();
    }
  }

  const submit = form.handleSubmit(async (input) => {
    try {
      await createUser.mutateAsync({
        email: input.email,
        password: input.password,
      });
      setOpen(false);
      form.reset();
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.code === "EMAIL_ALREADY_EXISTS"
      ) {
        form.setError("email", { message: error.message });
      }
    }
  });

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden="true" className="size-4" />
          Add user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            Create an internal account. All users have the same application
            permissions.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" noValidate onSubmit={submit}>
          {createUser.isError ? (
            <Alert className="border-destructive/30 bg-destructive/5 text-destructive">
              {getCreateError(createUser.error)}
            </Alert>
          ) : null}
          <UserFormField
            error={form.formState.errors.email?.message}
            label="Email"
            name="new-user-email"
          >
            <Input
              aria-describedby="new-user-email-error"
              aria-invalid={Boolean(form.formState.errors.email)}
              autoComplete="email"
              id="new-user-email"
              type="email"
              {...form.register("email")}
            />
          </UserFormField>
          <UserFormField
            error={form.formState.errors.password?.message}
            label="Password"
            name="new-user-password"
          >
            <Input
              aria-describedby="new-user-password-error"
              aria-invalid={Boolean(form.formState.errors.password)}
              autoComplete="new-password"
              id="new-user-password"
              type="password"
              {...form.register("password")}
            />
          </UserFormField>
          <UserFormField
            error={form.formState.errors.confirmPassword?.message}
            label="Confirm password"
            name="confirm-user-password"
          >
            <Input
              aria-describedby="confirm-user-password-error"
              aria-invalid={Boolean(form.formState.errors.confirmPassword)}
              autoComplete="new-password"
              id="confirm-user-password"
              type="password"
              {...form.register("confirmPassword")}
            />
          </UserFormField>
          <DialogFooter className="pt-2">
            <Button
              disabled={createUser.isPending}
              onClick={() => changeOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={createUser.isPending} type="submit">
              {createUser.isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : null}
              {createUser.isPending ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserFormField({
  children,
  error,
  label,
  name,
}: {
  children: ReactNode;
  error: string | undefined;
  label: string;
  name: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      {children}
      <p className="min-h-5 text-sm text-destructive" id={`${name}-error`}>
        {error}
      </p>
    </div>
  );
}

function getCreateError(error: Error): string {
  return error instanceof ApiClientError
    ? error.message
    : "The user could not be created. Please try again.";
}
