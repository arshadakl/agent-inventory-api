import { Trash2, UserRound, Users } from "lucide-react";
import { useState } from "react";

import type { User } from "@shared/types/user";

import { useCurrentUser } from "@/features/auth/auth-hooks";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUnixDate } from "@/lib/format";

import { AddUserDialog } from "./components/add-user-dialog";
import { DeleteUserDialog } from "./components/delete-user-dialog";
import { useDeleteUser, useUsers } from "./user-hooks";

export function UsersPage() {
  const users = useUsers();
  const currentUser = useCurrentUser();
  const deleteUser = useDeleteUser();
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  function requestDelete(user: User): void {
    deleteUser.reset();
    setUserToDelete(user);
  }

  async function confirmDelete(): Promise<void> {
    if (!userToDelete) return;

    try {
      await deleteUser.mutateAsync(userToDelete.id);
      setUserToDelete(null);
    } catch {
      // Keep the confirmation open so the user can retry.
    }
  }

  return (
    <main className="p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Access</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Users
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage the people who can access this internal workspace.
            </p>
          </div>
          <AddUserDialog />
        </header>

        {users.isPending ? (
          <UserListSkeleton />
        ) : users.isError ? (
          <Alert className="flex items-center justify-between gap-4 border-destructive/30 bg-destructive/5 text-destructive">
            <span>Unable to load users.</span>
            <Button
              onClick={() => void users.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              Try again
            </Button>
          </Alert>
        ) : users.data.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-6 py-16 text-center">
            <Users
              aria-hidden="true"
              className="mx-auto size-8 text-muted-foreground"
            />
            <h2 className="mt-4 font-semibold">No users found</h2>
          </div>
        ) : (
          <UserList
            currentUserId={currentUser.data?.id}
            onDelete={requestDelete}
            users={users.data}
          />
        )}
      </div>

      <DeleteUserDialog
        error={deleteUser.isError}
        loading={deleteUser.isPending}
        onConfirm={() => void confirmDelete()}
        onOpenChange={(open) => {
          if (!open && !deleteUser.isPending) setUserToDelete(null);
        }}
        user={userToDelete}
      />
    </main>
  );
}

function UserList({
  currentUserId,
  onDelete,
  users,
}: {
  currentUserId: string | undefined;
  onDelete: (user: User) => void;
  users: User[];
}) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card sm:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-muted/45">
              <TableHead>User</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-24">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full bg-secondary text-primary">
                      <UserRound aria-hidden="true" className="size-4" />
                    </span>
                    <span className="font-medium">{user.email}</span>
                    {user.id === currentUserId ? (
                      <Badge variant="secondary">You</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatUnixDate(user.createdAt)}
                </TableCell>
                <TableCell>
                  <DeleteUserButton
                    current={user.id === currentUserId}
                    onDelete={onDelete}
                    user={user}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-3 sm:hidden">
        {users.map((user) => (
          <Card className="gap-4 py-5" key={user.id}>
            <CardHeader className="grid-cols-[1fr_auto] px-5">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">
                  {user.email}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Added {formatUnixDate(user.createdAt)}
                </p>
              </div>
              <DeleteUserButton
                current={user.id === currentUserId}
                onDelete={onDelete}
                user={user}
              />
            </CardHeader>
            {user.id === currentUserId ? (
              <CardContent className="px-5">
                <Badge variant="secondary">Current account</Badge>
              </CardContent>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}

function DeleteUserButton({
  current,
  onDelete,
  user,
}: {
  current: boolean;
  onDelete: (user: User) => void;
  user: User;
}) {
  return (
    <Button
      aria-label={
        current ? "Cannot delete your own account" : `Delete ${user.email}`
      }
      disabled={current}
      onClick={() => onDelete(user)}
      size="icon"
      type="button"
      variant="ghost"
    >
      <Trash2 aria-hidden="true" className="size-4" />
    </Button>
  );
}

function UserListSkeleton() {
  return (
    <div aria-label="Loading users" className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton className="h-20 w-full" key={index} />
      ))}
    </div>
  );
}
