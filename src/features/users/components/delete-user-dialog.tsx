import { LoaderCircle } from "lucide-react";

import type { User } from "@shared/types/user";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteUserDialogProps {
  error: boolean;
  loading: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function DeleteUserDialog({
  error,
  loading,
  onConfirm,
  onOpenChange,
  user,
}: DeleteUserDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(user)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user?</DialogTitle>
          <DialogDescription>
            {user
              ? `This removes ${user.email} and signs out all of their active sessions.`
              : "This removes the user and their active sessions."}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert className="border-destructive/30 bg-destructive/5 text-destructive">
            The user could not be deleted. Please try again.
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
            {loading ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : null}
            {loading ? "Deleting…" : "Delete user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
