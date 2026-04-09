import { create } from "zustand";

export interface ToastPayload {
  message: string;
  kicker?: string;
  variant?: "default" | "astral" | "ember";
  glyph?: string;
}

interface ToastState {
  toast: ToastPayload | null;
  message: string | null;
  show: (toast: string | ToastPayload, duration?: number) => void;
  dismiss: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

function normalizeToast(input: string | ToastPayload): ToastPayload {
  if (typeof input === "string") {
    return { message: input, variant: "default" };
  }

  return {
    variant: "default",
    ...input,
  };
}

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  message: null,

  show: (input, duration = 2000) => {
    const toast = normalizeToast(input);
    clearTimeout(timer);
    set({ toast, message: toast.message });
    timer = setTimeout(() => {
      set({ toast: null, message: null });
    }, duration);
  },

  dismiss: () => {
    clearTimeout(timer);
    set({ toast: null, message: null });
  },
}));
