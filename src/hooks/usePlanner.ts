import { useCallback, useEffect, useRef, useState } from 'react';
import { FIXED_NODES, PRESETS, PRESET_META } from '../data';
import { parsePlan } from '../domain/layout';
import {
  decodeLibrary,
  LibraryStorage,
  LIBRARY_FORMAT,
  STORAGE_KEY,
  LEGACY_KEY,
} from '../services/storage';
import { useI18n } from '../i18n';
import type { Library, Plan, TreeGroup } from '../domain/types';
export function usePlanner() {
  const { t } = useI18n();
  const [storage] = useState(
    () =>
      new LibraryStorage(
        () => window.localStorage,
        navigator.locks ? (task) => navigator.locks.request(STORAGE_KEY, task) : undefined,
      ),
  );
  const [storageState, setStorageState] = useState(storage.status);
  const [library, setLibrary] = useState(storageState.library);
  const latest = useRef(library);
  const histories = useRef(new Map<string, { past: Plan[]; future: Plan[] }>());
  const active =
    library.plans.find((p) => p.id === library.activeId) ??
    PRESETS.find((p) => p.id === library.activeId) ??
    PRESETS[0];
  const isPreset = active.id.startsWith('preset-');
  const name = (p: Plan) =>
    PRESET_META[p.id] ? t(PRESET_META[p.id].title) : p.name || t('myPlan');
  const saved = !storageState.issue && storageState.library === library;
  function updateLibrary(update: (previous: Library) => Library) {
    latest.current = update(latest.current);
    setLibrary(latest.current);
  }
  const save = useCallback(async () => {
    if (latest.current === storage.status.library && !storage.status.issue) {
      setStorageState(storage.inspect());
      return;
    }
    await storage.save(latest.current);
    setStorageState(storage.status);
  }, [storage]);
  async function recoverStorage() {
    await storage.save(latest.current, true);
    setStorageState(storage.status);
  }
  function reloadStorage() {
    const next = storage.reload();
    latest.current = next.library;
    setLibrary(next.library);
    setStorageState(next);
    histories.current.clear();
  }
  useEffect(() => {
    if (library === storage.status.library) return;
    const timeout = setTimeout(() => {
      void save();
    }, 250);
    return () => clearTimeout(timeout);
  }, [library, save, storage]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_KEY || event.key === LEGACY_KEY)
        setStorageState(storage.inspect());
    };
    const inspect = () => setStorageState(storage.inspect());
    const flush = () => {
      void save();
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (latest.current !== storage.status.library) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('storage', changed);
    window.addEventListener('pageshow', inspect);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', visibility);
    inspect(); // Catch changes between the initial read and listener registration.
    return () => {
      storage.cancelPending();
      window.removeEventListener('storage', changed);
      window.removeEventListener('pageshow', inspect);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [storage, save]);
  const history = histories.current.get(active.id);
  function edit(groups: TreeGroup[]) {
    const id = isPreset ? crypto.randomUUID() : active.id;
    const base = {
      ...structuredClone(active),
      id,
      name: isPreset ? `${name(active)} · ${t('copy')}` : active.name,
    };
    const h = histories.current.get(id) ?? { past: [], future: [] };
    h.past.push(base);
    if (h.past.length > 80) h.past.shift();
    h.future = [];
    histories.current.set(id, h);
    const next = { ...base, groups, updatedAt: Date.now() };
    updateLibrary((l) => ({
      ...l,
      activeId: id,
      plans: isPreset ? [...l.plans, next] : l.plans.map((p) => (p.id === id ? next : p)),
    }));
  }
  function travel(direction: 'past' | 'future') {
    const h = histories.current.get(active.id);
    if (!h?.[direction].length) return;
    const previous = h[direction].pop()!;
    h[direction === 'past' ? 'future' : 'past'].push(structuredClone(active));
    updateLibrary((l) => ({
      ...l,
      plans: l.plans.map((p) => (p.id === active.id ? { ...previous, updatedAt: Date.now() } : p)),
    }));
  }
  function create(blank = false, supplied?: Plan) {
    const p: Plan = supplied
      ? { ...supplied, id: crypto.randomUUID() }
      : blank
        ? {
            id: crypto.randomUUID(),
            name: `${t('myPlan')} ${library.plans.length + 1}`,
            groups: [],
            cells: [],
            updatedAt: Date.now(),
          }
        : {
            ...structuredClone(active),
            id: crypto.randomUUID(),
            name: `${name(active)} · ${t('copy')}`,
          };
    p.updatedAt = Date.now();
    updateLibrary((l) => ({ ...l, activeId: p.id, plans: [...l.plans, p] }));
    return p.id;
  }
  function importFile(raw: string) {
    const value = JSON.parse(raw);
    const bytes = new TextEncoder().encode(raw).length;
    if (value?.format === LIBRARY_FORMAT) {
      if (bytes > 10_000_000) throw new Error('large');
      const imported = decodeLibrary(raw);
      const plans = imported.plans.map((p) => ({
        ...p,
        id: crypto.randomUUID(),
        updatedAt: Date.now(),
      }));
      const index = imported.plans.findIndex((p) => p.id === imported.activeId);
      updateLibrary((l) => ({
        ...l,
        plans: [...l.plans, ...plans],
        activeId: plans[index]?.id ?? plans[0]?.id ?? l.activeId,
      }));
      return;
    }
    if (value?.format !== undefined && (value.format !== 'everdale-planner' || value.version !== 1))
      throw new Error('invalid');
    if (bytes > 2_000_000) throw new Error('large');
    const plan = parsePlan(value, FIXED_NODES);
    if (!plan.name) plan.name = t('unknownName');
    create(false, plan);
  }
  function rename(value: string) {
    if (!isPreset && value.trim())
      updateLibrary((l) => ({
        ...l,
        plans: l.plans.map((p) =>
          p.id === active.id ? { ...p, name: value.trim().slice(0, 60), updatedAt: Date.now() } : p,
        ),
      }));
  }
  return {
    active,
    isPreset,
    plans: library.plans,
    name,
    saved,
    library,
    storageState,
    storageError: storageState.issue,
    reloadStorage,
    recoverStorage,
    save,
    edit,
    create,
    rename,
    importFile,
    select: (id: string) => updateLibrary((l) => ({ ...l, activeId: id })),
    undo: () => travel('past'),
    redo: () => travel('future'),
    canUndo: !!history?.past.length,
    canRedo: !!history?.future.length,
  };
}
