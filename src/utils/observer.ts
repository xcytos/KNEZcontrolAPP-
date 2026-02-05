// Observation Hook for Playwright
// This allows Playwright to listen for internal app events without brittle DOM polling
if (typeof window !== 'undefined') {
  (window as any).__KNEZ_OBSERVER__ = {
    emit: (event: string, data: any) => {
      console.log(`[KNEZ_OBSERVER] ${event}`, data);
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
