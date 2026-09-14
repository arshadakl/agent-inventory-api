import { createContext, useContext } from "react";

export type ToastVariant = "success" | "info";

export interface ToastInput {
  description?: string;
  title: string;
  variant?: ToastVariant;
}

export interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
