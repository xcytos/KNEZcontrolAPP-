if (typeof window !== 'undefined') {
  (window as any).__KNEZ_OBSERVER__ = {
    emit: (event: string, data: any) => {
      window.dispatchEvent(new CustomEvent('knez-observation', { detail: { event, data } }));
    },
    getState: () => (window as any).__KNEZ_STATE__
  };
  (window as any).__KNEZ_STATE__ = {};
}

export const observe = (event: string, data?: any) => {
  if ((window as any).__KNEZ_OBSERVER__) {
    (window as any).__KNEZ_OBSERVER__.emit(event, data);
  }
};

export const setObserverState = (patch: Record<string, unknown>) => {
  if (typeof window === 'undefined') return;
  const current = (window as any).__KNEZ_STATE__ ?? {};
  (window as any).__KNEZ_STATE__ = { ...current, ...patch };
  window.dispatchEvent(new CustomEvent('knez-state', { detail: (window as any).__KNEZ_STATE__ }));
};

export const getObserverState = (): Record<string, unknown> => {
  if (typeof window === 'undefined') return {};
  return (window as any).__KNEZ_STATE__ ?? {};
};
