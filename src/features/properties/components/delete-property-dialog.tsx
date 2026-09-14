import { LoaderCircle } from "lucide-react";

import type { Property } from "@shared/types/property";

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

interface DeletePropertyDialogProps {
  error: boolean;
  loading: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  property: Property | null;
}

export function DeletePropertyDialog({
  error,
  loading,
  onConfirm,
  onOpenChange,
  property,
}: DeletePropertyDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(property)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete property?</DialogTitle>
          <DialogDescription>
            {property
              ? `This permanently removes “${property.title}” from inventory.`
              : "This permanently removes the property from inventory."}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <Alert className="border-destructive/30 bg-destructive/5 text-destructive">
            The property could not be deleted. Please try again.
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
            {loading ? "Deleting…" : "Delete property"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
