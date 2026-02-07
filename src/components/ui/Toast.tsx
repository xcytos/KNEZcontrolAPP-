import React, { createContext, useContext, useState, useCallback, useRef } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastToastRef = useRef<{ msg: string; time: number } | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    // CP6-J: Deduplication logic
    const now = Date.now();
    if (
      lastToastRef.current && 
      lastToastRef.current.msg === message && 
      now - lastToastRef.current.time < 2000
    ) {
      return; // Skip duplicate
    }
    lastToastRef.current = { msg: message, time: now };

    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded shadow-lg text-sm font-medium animate-fade-in-up ${
              toast.type === "success"
                ? "bg-green-900 text-green-100 border border-green-700"
                : toast.type === "error"
                ? "bg-red-900 text-red-100 border border-red-700"
                : toast.type === "warning"
                ? "bg-amber-900 text-amber-100 border border-amber-700"
                : "bg-zinc-800 text-zinc-100 border border-zinc-700"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
