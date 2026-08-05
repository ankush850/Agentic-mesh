import { create } from "zustand";

export type ToastTone = "info" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastStore {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (toast) => {
    counter += 1;
    const id = `toast-${counter}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    // Auto-dismiss keeps the toast stack from hiding the UI during long runs.
    window.setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
    }, 5200);
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

/** Imperative helper so non-React code (query callbacks) can raise toasts. */
export const toast = {
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: "info" }),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: "success" }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: "error" }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: "warning" }),
};
