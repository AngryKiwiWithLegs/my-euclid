/**
 * 全局通知 store：任何层级的组件直接调用 useNotify()，
 * 不再经过 props 层层透传；toast 状态只触发 ToastHost 一个订阅者的重渲染。
 */
import { create } from "zustand";
import type { Notify } from "./views";

interface ToastState {
  message: string | null;
  notify: Notify;
  dismiss: () => void;
}

let toastTimer: number | undefined;

export const useToastStore = create<ToastState>(set => ({
  message: null,
  notify: (message, duration = 3500) => {
    window.clearTimeout(toastTimer);
    set({ message });
    toastTimer = window.setTimeout(() => set({ message: null }), duration);
  },
  dismiss: () => {
    window.clearTimeout(toastTimer);
    set({ message: null });
  },
}));

export function useNotify(): Notify {
  return useToastStore(state => state.notify);
}
