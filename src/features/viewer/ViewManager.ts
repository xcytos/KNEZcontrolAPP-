import type { SavedView, ViewerStore, ViewLayout, ViewPlaygroundTab } from './types';
import { VIEWER_STORAGE_KEY, DEFAULT_LAYOUT } from './types';

function loadStore(): ViewerStore {
  try {
    const raw = localStorage.getItem(VIEWER_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { views: [], activeViewId: null };
}

function saveStore(store: ViewerStore) {
  try {
    localStorage.setItem(VIEWER_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

export const ViewManager = {
  getAll(): SavedView[] {
    return loadStore().views;
  },

  getActive(): SavedView | null {
    const store = loadStore();
    if (!store.activeViewId) return null;
    return store.views.find(v => v.id === store.activeViewId) ?? null;
  },

  get(id: string): SavedView | null {
    return loadStore().views.find(v => v.id === id) ?? null;
  },

  create(
    name: string,
    sessionId: string,
    projectId: string | undefined,
    playgroundTabs: ViewPlaygroundTab[],
    layout?: Partial<ViewLayout>,
  ): SavedView {
    const store = loadStore();
    const view: SavedView = {
      id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      createdAt: new Date().toISOString(),
      sessionId,
      projectId,
      playgroundTabs,
      layout: { ...DEFAULT_LAYOUT, ...layout },
    };
    store.views.push(view);
    store.activeViewId = view.id;
    saveStore(store);
    return view;
  },

  update(id: string, partial: Partial<SavedView>) {
    const store = loadStore();
    const idx = store.views.findIndex(v => v.id === id);
    if (idx === -1) return;
    store.views[idx] = { ...store.views[idx], ...partial };
    saveStore(store);
  },

  setActive(id: string | null) {
    const store = loadStore();
    store.activeViewId = id;
    saveStore(store);
  },

  delete(id: string) {
    const store = loadStore();
    store.views = store.views.filter(v => v.id !== id);
    if (store.activeViewId === id) store.activeViewId = store.views[0]?.id ?? null;
    saveStore(store);
  },

  rename(id: string, name: string) {
    ViewManager.update(id, { name });
  },
};
