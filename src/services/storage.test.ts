import { describe, expect, it } from 'vitest';
import type { Library } from '../domain/types';
import { PRESETS } from '../data';
import {
  BACKUP_KEY,
  decodeLibrary,
  LEGACY_KEY,
  LibraryStorage,
  RECOVERY_PREFIX,
  STORAGE_KEY,
  type ExclusiveLock,
} from './storage';

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}
function lock(): ExclusiveLock {
  let pending: Promise<unknown> = Promise.resolve();
  return <T>(task: () => T) => {
    const next = pending.then(task);
    pending = next.catch(() => {});
    return next;
  };
}
const library = (name = 'Original'): Library => ({
  version: 1,
  activeId: 'mine',
  plans: [{ ...PRESETS[0], id: 'mine', name, updatedAt: 1 }],
});

describe('safe library persistence', () => {
  it.each([
    '{broken',
    '',
    'null',
    '{"version":2,"plans":[]}',
    JSON.stringify({
      version: 1,
      activeId: 'mine',
      plans: [{}],
    }),
  ])('preserves unreadable data even when save is requested: %s', async (raw) => {
    const storage = memory({ [STORAGE_KEY]: raw });
    const session = new LibraryStorage(() => storage, lock());
    expect(session.status.issue).toBe('corrupt');
    await session.save(library());
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.data.size).toBe(1);
  });

  it('loads the last good backup without overwriting corruption, then archives on explicit recovery', async () => {
    const raw = '{partially damaged';
    const backup = JSON.stringify(library());
    const storage = memory({ [STORAGE_KEY]: raw, [BACKUP_KEY]: backup });
    const session = new LibraryStorage(() => storage, lock());
    expect(session.status).toMatchObject({
      issue: 'corrupt',
      recoveredFromBackup: true,
      library: library(),
    });
    await session.save(library('Recovered edits'));
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    const result = await session.save(library('Recovered edits'), true);
    expect(result.issue).toBeNull();
    expect(decodeLibrary(storage.getItem(STORAGE_KEY)!)).toEqual(library('Recovered edits'));
    const archives = [...storage.data].filter(([key]) => key.startsWith(RECOVERY_PREFIX));
    expect(archives).toHaveLength(1);
    expect(JSON.parse(archives[0][1]).current).toBe(raw);
    expect(decodeLibrary(storage.getItem(BACKUP_KEY)!)).toEqual(library());
  });

  it('preserves corrupted legacy data and does not silently migrate an empty record', async () => {
    const storage = memory({ [LEGACY_KEY]: '{}' });
    const session = new LibraryStorage(() => storage, lock());
    expect(session.status.issue).toBe('corrupt');
    await session.save(library());
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    await session.save(library(), true);
    const archive = [...storage.data].find(([key]) => key.startsWith(RECOVERY_PREFIX))!;
    expect(JSON.parse(archive[1]).legacy).toBe('{}');
    expect(storage.getItem(LEGACY_KEY)).toBe('{}');
  });

  it('migrates valid legacy data only after a successful save', async () => {
    const raw = JSON.stringify({ N: 70, treeGroups: PRESETS[0].groups, cells: [] });
    const storage = memory({ [LEGACY_KEY]: raw });
    const session = new LibraryStorage(() => storage, lock());
    const initial = session.status.library;
    expect(initial.activeId).toBe('migrated-layout');
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect((await session.save(initial)).issue).toBeNull();
    expect(decodeLibrary(storage.getItem(STORAGE_KEY)!)).toEqual(initial);
    expect(storage.getItem(LEGACY_KEY)).toBe(raw);
  });

  it.each(['archive', 'backup', 'primary'])(
    'keeps the original when the %s write fails',
    async (stage) => {
      const raw = stage === 'archive' ? '{bad' : JSON.stringify(library());
      const storage = memory({ [STORAGE_KEY]: raw });
      const setItem = storage.setItem;
      storage.setItem = (key, value) => {
        if (
          (stage === 'archive' && key.startsWith(RECOVERY_PREFIX)) ||
          (stage === 'backup' && key === BACKUP_KEY) ||
          (stage === 'primary' && key === STORAGE_KEY)
        )
          throw new Error('quota');
        setItem(key, value);
      };
      const session = new LibraryStorage(() => storage, lock());
      expect((await session.save(library('New'), stage === 'archive')).issue).toBe('write');
      expect(storage.getItem(STORAGE_KEY)).toBe(raw);
      storage.setItem = setItem;
      expect((await session.save(library('New'), stage === 'archive')).issue).toBeNull();
    },
  );

  it('keeps one previous valid version and does not rotate the backup on a no-op save', async () => {
    const storage = memory({ [STORAGE_KEY]: JSON.stringify(library()) });
    const session = new LibraryStorage(() => storage, lock());
    await session.save(library('New'));
    await session.save(library('New'));
    expect(decodeLibrary(storage.getItem(BACKUP_KEY)!)).toEqual(library());
  });

  it('serializes concurrent tabs and rejects the stale writer without needing a storage event', async () => {
    const storage = memory({ [STORAGE_KEY]: JSON.stringify(library()) });
    const exclusive = lock();
    const first = new LibraryStorage(() => storage, exclusive);
    const second = new LibraryStorage(() => storage, exclusive);
    const [a, b] = await Promise.all([first.save(library('Tab A')), second.save(library('Tab B'))]);
    expect(a.issue).toBeNull();
    expect(b.issue).toBe('conflict');
    expect(decodeLibrary(storage.getItem(STORAGE_KEY)!)).toEqual(library('Tab A'));
    expect((await second.save(library('Tab B'), true)).issue).toBe('conflict');
    expect(second.reload().library).toEqual(library('Tab A'));
    expect((await second.save(library('Tab B after reload'))).issue).toBeNull();
  });

  it.each(['clear', 'change'])(
    'detects external %s and never flushes a stale snapshot',
    async (action) => {
      const storage = memory({ [STORAGE_KEY]: JSON.stringify(library()) });
      const session = new LibraryStorage(() => storage, lock());
      if (action === 'clear') storage.data.delete(STORAGE_KEY);
      else storage.setItem(STORAGE_KEY, JSON.stringify(library('Remote')));
      const remote = storage.getItem(STORAGE_KEY);
      expect(session.inspect().issue).toBe('conflict');
      await session.save(library('Stale'));
      expect(storage.getItem(STORAGE_KEY)).toBe(remote);
    },
  );

  it('rechecks the baseline even for explicit recovery', async () => {
    const storage = memory({ [STORAGE_KEY]: '{broken' });
    const session = new LibraryStorage(() => storage, lock());
    storage.setItem(STORAGE_KEY, JSON.stringify(library('Fixed elsewhere')));
    expect((await session.save(library(), true)).issue).toBe('conflict');
    expect([...storage.data.keys()].some((key) => key.startsWith(RECOVERY_PREFIX))).toBe(false);
  });

  it('does not overwrite an unread initial store when access becomes available later', async () => {
    const storage = memory({ [STORAGE_KEY]: JSON.stringify(library()) });
    let blocked = true;
    const session = new LibraryStorage(() => {
      if (blocked) throw new Error('denied');
      return storage;
    }, lock());
    expect(session.status.issue).toBe('unavailable');
    blocked = false;
    await session.save(library('Empty fallback'));
    expect(decodeLibrary(storage.getItem(STORAGE_KEY)!)).toEqual(library());
    expect(session.reload().issue).toBeNull();
  });

  it('does not use an unsafe unlocked fallback', async () => {
    const storage = memory({ [STORAGE_KEY]: JSON.stringify(library()) });
    const session = new LibraryStorage(() => storage, undefined);
    expect(session.status.issue).toBe('unsupported');
    await session.save(library('New'));
    expect(decodeLibrary(storage.getItem(STORAGE_KEY)!)).toEqual(library());
  });

  it('invalidates queued saves on reload or disposal', async () => {
    const storage = memory({ [STORAGE_KEY]: JSON.stringify(library()) });
    const session = new LibraryStorage(() => storage, lock());
    const pending = session.save(library('Stale'));
    session.reload();
    await pending;
    const another = session.save(library('Unmounted'));
    session.cancelPending();
    await another;
    expect(decodeLibrary(storage.getItem(STORAGE_KEY)!)).toEqual(library());
  });

  it('rejects data that cannot round-trip before writing either the backup or primary', async () => {
    const raw = JSON.stringify(library());
    const storage = memory({ [STORAGE_KEY]: raw });
    const session = new LibraryStorage(() => storage, lock());
    const invalid = library();
    invalid.plans[0].groups = [{ ...PRESETS[0].groups[0], x: 999 }];
    expect((await session.save(invalid)).issue).toBe('write');
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(BACKUP_KEY)).toBeNull();
  });
});
