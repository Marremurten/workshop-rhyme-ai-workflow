import React, { useEffect } from "react";
import type { ToastMessage } from "../types";

const TOAST_DISMISS_MS = 3000;

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (toast.type !== "success") return;

    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, TOAST_DISMISS_MS);

    return () => clearTimeout(timer);
  }, [toast.id, toast.type, onDismiss]);

  return (
    <div
      className={`flex items-center justify-between rounded px-4 py-3 text-white shadow-lg ${
        toast.type === "success" ? "bg-green-500" : "bg-red-500"
      }`}
    >
      <span>{toast.message}</span>
      <button
        aria-label="Close"
        onClick={() => onDismiss(toast.id)}
        className="ml-4 font-bold text-white hover:text-gray-200"
      >
        &times;
      </button>
    </div>
  );
}

const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

export default Toast;
