import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound, LoaderCircle, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import {
  createApiKeySchema,
  type CreateApiKeyInput,
} from "@shared/schemas/api-key";
import type { ApiKey, CreatedApiKey } from "@shared/types/api-key";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiClientError } from "@/lib/api-client";
import { formatUnixDate } from "@/lib/format";
import { useToast } from "@/lib/toast-context";

import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "./api-key-hooks";

export function ApiKeysPage() {
  const apiKeys = useApiKeys();
  const deleteApiKey = useDeleteApiKey();
  const { toast } = useToast();
  const [recentlyCreatedKey, setRecentlyCreatedKey] =
    useState<CreatedApiKey | null>(null);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);

  async function confirmDelete(): Promise<void> {
    if (!keyToDelete) return;

    try {
      await deleteApiKey.mutateAsync(keyToDelete.id);
      toast({ title: "API key deleted" });
      if (recentlyCreatedKey?.apiKey.id === keyToDelete.id) {
        setRecentlyCreatedKey(null);
      }
      setKeyToDelete(null);
    } catch {
      // Keep the confirmation open so the user can retry.
    }
  }

  async function copyApiKey(secret: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(secret);
      toast({ title: "API key copied" });
    } catch {
      toast({
        title: "Copy failed",
        description: "Select and copy the key manually.",
      });
    }
  }

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Integrations</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              API keys
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Create a key for n8n to search inventory without accessing the
              dashboard.
            </p>
          </div>
          <CreateApiKeyDialog
            onCreated={(createdKey) => {
              setRecentlyCreatedKey(createdKey);
              setSecretDialogOpen(true);
            }}
          />
        </header>

        <Alert>
          API keys are shown once when created. Copy the secret into n8n, then
          delete the key immediately if it is no longer needed.
        </Alert>

        {apiKeys.isPending ? (
          <div aria-label="Loading API keys" className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton className="h-24 w-full" key={index} />
            ))}
          </div>
        ) : apiKeys.isError ? (
          <Alert className="flex items-center justify-between gap-4 border-destructive/30 bg-destructive/5 text-destructive">
            <span>Unable to load API keys.</span>
            <Button
              onClick={() => void apiKeys.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              Try again
            </Button>
          </Alert>
        ) : apiKeys.data.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
            <KeyRound
              aria-hidden="true"
              className="mx-auto size-8 text-muted-foreground"
            />
            <h2 className="mt-4 font-semibold">No API keys yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a key to connect n8n to your available property inventory.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {apiKeys.data.map((apiKey) => (
              <Card className="py-5" key={apiKey.id}>
                <CardHeader className="grid-cols-[minmax(0,1fr)_auto] items-start px-5">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {apiKey.name}
                    </CardTitle>
                    <code className="mt-2 block truncate text-xs text-muted-foreground">
                      {apiKey.prefix}…
                    </code>
                  </div>
                  <Badge>Active</Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 px-5 pt-1 sm:flex-row sm:items-end sm:justify-between">
                  <p className="text-xs leading-5 text-muted-foreground">
                    Created {formatUnixDate(apiKey.createdAt)}
                    {apiKey.lastUsedAt
                      ? ` · Last used ${formatUnixDate(apiKey.lastUsedAt)}`
                      : " · Not used yet"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentlyCreatedKey?.apiKey.id === apiKey.id ? (
                      <Button
                        aria-label={`Copy ${apiKey.name}`}
                        onClick={() =>
                          void copyApiKey(recentlyCreatedKey.secret)
                        }
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Copy aria-hidden="true" className="size-4" />
                        Copy API key
                      </Button>
                    ) : null}
                    <Button
                      aria-label={`Delete ${apiKey.name}`}
                      onClick={() => {
                        deleteApiKey.reset();
                        setKeyToDelete(apiKey);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <SecretDialog
        onCopy={() => void copyApiKey(recentlyCreatedKey?.secret ?? "")}
        onOpenChange={setSecretDialogOpen}
        open={secretDialogOpen}
        secret={recentlyCreatedKey?.secret ?? null}
      />
      <DeleteDialog
        apiKey={keyToDelete}
        error={deleteApiKey.isError}
        loading={deleteApiKey.isPending}
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          if (!open && !deleteApiKey.isPending) setKeyToDelete(null);
        }}
      />
    </main>
  );
}

function CreateApiKeyDialog({
  onCreated,
}: {
  onCreated: (apiKey: CreatedApiKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const createApiKey = useCreateApiKey();
  const form = useForm<CreateApiKeyInput>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: { name: "" },
  });

  function changeOpen(nextOpen: boolean): void {
    if (createApiKey.isPending) return;
    setOpen(nextOpen);
    if (nextOpen) {
      createApiKey.reset();
      form.reset();
    }
  }

  const submit = form.handleSubmit(async (input) => {
    try {
      const createdKey = await createApiKey.mutateAsync(input);
      setOpen(false);
      form.reset();
      onCreated(createdKey);
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        error.code === "API_KEY_NAME_CONFLICT"
      ) {
        form.setError("name", { message: error.message });
      }
    }
  });

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <Button onClick={() => changeOpen(true)} type="button">
        <Plus aria-hidden="true" className="size-4" />
        Create API key
      </Button>
      {open ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Name the n8n connection. The secret will be displayed only once.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" noValidate onSubmit={submit}>
            {createApiKey.isError ? (
              <Alert className="border-destructive/30 bg-destructive/5 text-destructive">
                {createApiKey.error.message}
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                {...form.register("name")}
                aria-invalid={Boolean(form.formState.errors.name)}
              />
              <p className="min-h-5 text-sm text-destructive">
                {form.formState.errors.name?.message}
              </p>
            </div>
            <DialogFooter>
              <Button
                disabled={createApiKey.isPending}
                onClick={() => changeOpen(false)}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button disabled={createApiKey.isPending} type="submit">
                {createApiKey.isPending ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : null}
                {createApiKey.isPending ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function SecretDialog({
  onCopy,
  onOpenChange,
  open,
  secret,
}: {
  onCopy: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  secret: string | null;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copy your API key</DialogTitle>
          <DialogDescription>
            Copy and store this key now. It remains available on this page until
            you refresh or leave.
          </DialogDescription>
        </DialogHeader>
        <code className="block break-all rounded-md bg-muted p-3 text-xs">
          {secret}
        </code>
        <DialogFooter>
          <Button onClick={onCopy} type="button">
            <Copy aria-hidden="true" className="size-4" />
            Copy API key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  apiKey,
  error,
  loading,
  onConfirm,
  onOpenChange,
}: {
  apiKey: ApiKey | null;
  error: boolean;
  loading: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(apiKey)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete API key?</DialogTitle>
          <DialogDescription>
            This permanently removes {apiKey?.name}. n8n requests using this key
            will stop working immediately.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert className="border-destructive/30 bg-destructive/5 text-destructive">
            Unable to delete this key. Please try again.
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            disabled={loading}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={loading}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {loading ? "Deleting…" : "Delete key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
