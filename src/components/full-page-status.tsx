import { AlertCircle, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface FullPageStatusProps {
  actionLabel?: string;
  message: string;
  onAction?: () => void;
  title: string;
  variant?: "loading" | "error";
}

export function FullPageStatus({
  actionLabel,
  message,
  onAction,
  title,
  variant = "loading",
}: FullPageStatusProps) {
  const Icon = variant === "loading" ? LoaderCircle : AlertCircle;

  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <div className="max-w-sm space-y-4 text-center">
        <Icon
          aria-hidden="true"
          className={`mx-auto size-7 ${variant === "loading" ? "animate-spin text-primary" : "text-destructive"}`}
        />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{message}</p>
        </div>
        {actionLabel && onAction ? (
          <Button onClick={onAction} type="button" variant="outline">
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </main>
  );
}
