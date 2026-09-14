import { CheckCircle2, Info, X } from "lucide-react";
import { useCallback, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  ToastContext,
  type ToastInput,
  type ToastVariant,
} from "@/lib/toast-context";
import { cn } from "@/lib/utils";

interface ToastItem extends ToastInput {
  id: string;
  variant: ToastVariant;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      const item: ToastItem = {
        ...input,
        id,
        variant: input.variant ?? "success",
      };
      setToasts((current) => [...current, item].slice(-3));
      window.setTimeout(() => dismiss(id), 5_000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed right-4 bottom-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3"
      >
        {toasts.map((item) => (
          <Toast
            key={item.id}
            onDismiss={() => dismiss(item.id)}
            toast={item}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({
  onDismiss,
  toast,
}: {
  onDismiss: () => void;
  toast: ToastItem;
}) {
  const Icon = toast.variant === "success" ? CheckCircle2 : Info;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-card p-4 shadow-lg",
        toast.variant === "success" ? "border-emerald-200" : "border-border",
      )}
      role="status"
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-5 shrink-0",
          toast.variant === "success" ? "text-emerald-600" : "text-primary",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {toast.description}
          </p>
        ) : null}
      </div>
      <Button
        aria-label="Dismiss notification"
        className="-mr-2 -mt-2"
        onClick={onDismiss}
        size="icon"
        type="button"
        variant="ghost"
      >
        <X aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}
