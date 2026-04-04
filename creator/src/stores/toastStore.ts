import { create } from "zustand";

interface ToastState {
  message: string | null;
  show: (message: string, duration?: number) => void;
  dismiss: () => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>((set) => ({
  message: null,

  show: (message, duration = 2000) => {
    clearTimeout(timer);
    set({ message });
    timer = setTimeout(() => {
      set({ message: null });
    }, duration);
  },

  dismiss: () => {
    clearTimeout(timer);
    set({ message: null });
  },
}));
