// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlanner } from './usePlanner';
import { PRESETS } from '../data';
import { toggleGrowth } from '../domain/progress';
import { BACKUP_KEY, decodeLibrary, exportLibrary, STORAGE_KEY } from '../services/storage';
import type { Library } from '../domain/types';

vi.mock('../i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
let planner: ReturnType<typeof usePlanner>;
let root: Root;
let element: HTMLDivElement;
function Harness() {
  planner = usePlanner();
  return null;
}
async function mount() {
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
  await act(async () => {
    root.render(createElement(StrictMode, null, createElement(Harness)));
  });
}
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}
function stored(): Library {
  return decodeLibrary(localStorage.getItem(STORAGE_KEY)!);
}
function initial(name = 'Mine'): Library {
  return {
    version: 1,
    activeId: 'mine',
    plans: [{ ...PRESETS[0], id: 'mine', name, updatedAt: 1 }],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  let queue: Promise<unknown> = Promise.resolve();
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: {
      request: <T>(_key: string, task: () => T) => {
        const next = queue.then(task);
        queue = next.catch(() => {});
        return next;
      },
    },
  });
});
afterEach(async () => {
  if (root)
    await act(async () => {
      root.unmount();
    });
  element?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('planner persistence lifecycle', () => {
  it('never replaces a corrupted save on mount, edit, manual save or pagehide', async () => {
    const raw = '{damaged';
    localStorage.setItem(STORAGE_KEY, raw);
    await mount();
    expect(planner.storageError).toBe('corrupt');
    expect(planner.saved).toBe(false);
    await flush();
    await act(async () => {
      planner.create(true);
    });
    await flush();
    await act(async () => {
      await planner.save();
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(planner.plans).toHaveLength(1);
    expect(planner.saved).toBe(false);
  });

  it('keeps autosave, template copying, undo/redo and refresh persistence working', async () => {
    await mount();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    await act(async () => {
      planner.edit(toggleGrowth(planner.active.groups, planner.active.groups[0].id));
    });
    const id = planner.active.id;
    expect(id).not.toMatch(/^preset-/);
    expect(planner.saved).toBe(false);
    await flush();
    expect(planner.saved).toBe(true);
    expect(stored().plans[0].groups[0].grown).toBe(true);
    await act(async () => {
      planner.undo();
    });
    await flush();
    expect(stored().plans[0].groups[0].grown).toBeUndefined();
    await act(async () => {
      planner.redo();
    });
    await flush();
    expect(stored().plans[0].groups[0].grown).toBe(true);
    await act(async () => {
      root.unmount();
    });
    element.remove();
    await mount();
    expect(planner.active.id).toBe(id);
    expect(planner.active.groups[0].grown).toBe(true);
    expect(planner.canUndo).toBe(false);
    expect(planner.saved).toBe(true);
  });

  it('preserves local edits but blocks auto/manual/unload saves after another tab writes', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial()));
    await mount();
    await act(async () => {
      planner.rename('Local unsaved');
    });
    const remote = JSON.stringify(initial('Remote changes'));
    localStorage.setItem(STORAGE_KEY, remote);
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: remote }));
    });
    expect(planner.storageError).toBe('conflict');
    await flush();
    await act(async () => {
      await planner.save();
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(remote);
    expect(planner.active.name).toBe('Local unsaved');
    expect(planner.saved).toBe(false);
    const backup = JSON.stringify(exportLibrary(planner.library));
    await act(async () => {
      planner.reloadStorage();
    });
    expect(planner.active.name).toBe('Remote changes');
    await act(async () => {
      planner.importFile(backup);
    });
    await flush();
    expect(stored().plans.map((p) => p.name)).toEqual(['Remote changes', 'Local unsaved']);
    expect(new Set(stored().plans.map((p) => p.id)).size).toBe(2);
  });

  it('detects another tab even when no storage event has arrived', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial()));
    await mount();
    await act(async () => {
      planner.rename('Local');
    });
    const remote = JSON.stringify(initial('Remote'));
    localStorage.setItem(STORAGE_KEY, remote);
    await flush();
    expect(planner.storageError).toBe('conflict');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(remote);
  });

  it('flushes the latest draft on pagehide and warns before leaving with unsaved edits', async () => {
    await mount();
    await act(async () => {
      planner.create(true);
    });
    await act(async () => {
      planner.rename('Latest draft');
    });
    const before = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(before);
    expect(before.defaultPrevented).toBe(true);
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(stored().plans[0].name).toBe('Latest draft');
    const after = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(after);
    expect(after.defaultPrevented).toBe(false);
  });

  it('keeps failed writes unsaved and allows retry without losing the current draft', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial()));
    await mount();
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === STORAGE_KEY) throw new DOMException('Full', 'QuotaExceededError');
      setItem.call(this, key, value);
    });
    await act(async () => {
      planner.rename('Unsaved draft');
    });
    await flush();
    expect(planner.saved).toBe(false);
    expect(planner.storageError).toBe('write');
    expect(stored().plans[0].name).toBe('Mine');
    expect(planner.active.name).toBe('Unsaved draft');
    vi.restoreAllMocks();
    await act(async () => {
      await planner.save();
    });
    expect(stored().plans[0].name).toBe('Unsaved draft');
    expect(planner.saved).toBe(true);
  });

  it('only resumes after explicit recovery and keeps the valid backup available', async () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    localStorage.setItem(BACKUP_KEY, JSON.stringify(initial()));
    await mount();
    expect(planner.active.name).toBe('Mine');
    expect(planner.storageState.recoveredFromBackup).toBe(true);
    await act(async () => {
      planner.rename('Recovered');
    });
    await flush();
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{broken');
    await act(async () => {
      await planner.recoverStorage();
    });
    expect(planner.saved).toBe(true);
    expect(stored().plans[0].name).toBe('Recovered');
  });

  it('does not claim a newer draft is saved when an older queued save completes', async () => {
    await mount();
    await act(async () => {
      planner.create(true);
    });
    await act(async () => {
      const pending = planner.save();
      planner.create(true);
      await pending;
    });
    expect(planner.plans).toHaveLength(2);
    expect(stored().plans).toHaveLength(1);
    expect(planner.saved).toBe(false);
    await flush();
    expect(planner.saved).toBe(true);
    expect(stored().plans).toHaveLength(2);
  });

  it('cancels a queued stale save on reload and resets undo history', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial()));
    await mount();
    await act(async () => {
      planner.edit(toggleGrowth(planner.active.groups, planner.active.groups[0].id));
    });
    expect(planner.canUndo).toBe(true);
    await act(async () => {
      const pending = planner.save();
      planner.reloadStorage();
      await pending;
    });
    expect(planner.canUndo).toBe(false);
    expect(planner.active.groups[0].grown).toBeUndefined();
    await flush();
    expect(stored()).toEqual(initial());
  });
  it('rejects recovery archives and unknown export versions without changing the library', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial()));
    await mount();
    const before = planner.library;
    for (const value of [
      { format: 'everdale-planner-recovery', current: '{broken' },
      { format: 'everdale-planner', version: 2, groups: [] },
      { format: 'everdale-planner-library', version: 2, plans: [] },
    ])
      expect(() => planner.importFile(JSON.stringify(value))).toThrow();
    expect(planner.library).toBe(before);
    expect(stored()).toEqual(initial());
  });
});
