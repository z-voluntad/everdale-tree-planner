import { useEffect, useRef, useState } from 'react';
import { FIXED_NODES, PRESETS, PRESET_META } from '../data';
import { parsePlan } from '../domain/layout';
import { loadLibrary, STORAGE_KEY } from '../services/storage';
import { useI18n } from '../i18n';
import type { Library, Plan, TreeGroup } from '../domain/types';
export function usePlanner() {
  const { t } = useI18n();
  const [storageError, setStorageError] = useState(false);
  const [library, setLibrary] = useState<Library>(() => {
    try {
      return loadLibrary(localStorage);
    } catch {
      return { version: 1, activeId: 'preset-one', plans: [] };
    }
  });
  const [saved, setSaved] = useState(true);
  const [, tick] = useState(0);
  const histories = useRef(new Map<string, { past: Plan[]; future: Plan[] }>());
  const active =
    library.plans.find((p) => p.id === library.activeId) ??
    PRESETS.find((p) => p.id === library.activeId) ??
    PRESETS[0];
  const isPreset = active.id.startsWith('preset-');
  const name = (p: Plan) =>
    PRESET_META[p.id] ? t(PRESET_META[p.id].title) : p.name || t('myPlan');
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      setSaved(true);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };
  useEffect(() => {
    setSaved(false);
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
        setSaved(true);
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [library]);
  useEffect(() => {
    const onUnload = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
      } catch {
        /* export remains available */
      }
    };
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  }, [library]);
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
    setLibrary((l) => ({
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
    setLibrary((l) => ({
      ...l,
      plans: l.plans.map((p) => (p.id === active.id ? { ...previous, updatedAt: Date.now() } : p)),
    }));
    tick((n) => n + 1);
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
    setLibrary((l) => ({ ...l, activeId: p.id, plans: [...l.plans, p] }));
    return p.id;
  }
  function importFile(raw: string) {
    const plan = parsePlan(JSON.parse(raw), FIXED_NODES);
    if (!plan.name) plan.name = t('unknownName');
    create(false, plan);
  }
  function rename(value: string) {
    if (!isPreset && value.trim())
      setLibrary((l) => ({
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
    storageError,
    save,
    edit,
    create,
    rename,
    importFile,
    select: (id: string) => setLibrary((l) => ({ ...l, activeId: id })),
    undo: () => travel('past'),
    redo: () => travel('future'),
    canUndo: !!history?.past.length,
    canRedo: !!history?.future.length,
  };
}
