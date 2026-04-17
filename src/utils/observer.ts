// Type definitions for global window object
interface KnezObserver {
  emit: (event: string, data: unknown) => void;
  getState: () => Record<string, unknown>;
}

interface KnezWindow extends Window {
  __KNEZ_OBSERVER__?: KnezObserver;
  __KNEZ_STATE__?: Record<string, unknown>;
}

if (typeof window !== 'undefined') {
  (window as KnezWindow).__KNEZ_OBSERVER__ = {
    emit: (event: string, data: unknown) => {
      window.dispatchEvent(new CustomEvent('knez-observation', { detail: { event, data } }));
    },
    getState: () => (window as KnezWindow).__KNEZ_STATE__ ?? {}
  };
  (window as KnezWindow).__KNEZ_STATE__ = {};
}

export const observe = (event: string, data?: unknown) => {
  const observer = (window as KnezWindow).__KNEZ_OBSERVER__;
  if (observer) {
    observer.emit(event, data);
  }
};

export const setObserverState = (patch: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  const current = (window as KnezWindow).__KNEZ_STATE__ ?? {};
  (window as KnezWindow).__KNEZ_STATE__ = { ...current, ...patch };
  window.dispatchEvent(new CustomEvent('knez-state', { detail: (window as KnezWindow).__KNEZ_STATE__ }));
};

export const getObserverState = (): Record<string, unknown> => {
  if (typeof window === 'undefined') return {};
  return (window as KnezWindow).__KNEZ_STATE__ ?? {};
};
