export type ToastVariant = "success" | "error" | "info" | "warning";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  createdAt: number;
};

export type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type Listener = () => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
let idSeq = 0;

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getToasts() {
  return toasts;
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function pushToast(input: ToastInput) {
  const item: ToastItem = {
    id: `toast-${++idSeq}-${Date.now()}`,
    title: input.title,
    description: input.description,
    variant: input.variant ?? "info",
    duration: input.duration ?? (input.variant === "error" ? 6000 : 4500),
    createdAt: Date.now(),
  };
  toasts = [item, ...toasts].slice(0, 5);
  emit();
  return item.id;
}

export const toast = {
  success(title: string, description?: string) {
    return pushToast({ title, description, variant: "success" });
  },
  error(title: string, description?: string) {
    return pushToast({ title, description, variant: "error" });
  },
  info(title: string, description?: string) {
    return pushToast({ title, description, variant: "info" });
  },
  warning(title: string, description?: string) {
    return pushToast({ title, description, variant: "warning" });
  },
  dismiss: dismissToast,
};
