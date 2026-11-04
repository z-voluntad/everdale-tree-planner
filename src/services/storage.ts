import { FIXED_NODES, PRESETS } from '../data';
import { parsePlan } from '../domain/layout';
import type { Library } from '../domain/types';

export const STORAGE_KEY = 'everdale-planner.library.v1';
export const LEGACY_KEY = 'everdale.layout.boundaries.v2';
export const BACKUP_KEY = `${STORAGE_KEY}.backup`;
export const RECOVERY_PREFIX = `${STORAGE_KEY}.recovery.`;
export const LIBRARY_FORMAT = 'everdale-planner-library';

type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;
type StoredSnapshot = { current: string | null; legacy: string | null };
export type StorageIssue = 'corrupt' | 'conflict' | 'unavailable' | 'write' | 'unsupported';
export type ExclusiveLock = <T>(task: () => T) => Promise<T>;
export interface StorageState {
  library: Library;
  issue: StorageIssue | null;
  needsRecovery: boolean;
  recoveredFromBackup: boolean;
  original: StoredSnapshot | null;
}

const emptyLibrary = (): Library => ({ version: 1, activeId: 'preset-one', plans: [] });

export function decodeLibrary(raw: string): Library {
  const d = JSON.parse(raw);
  if (!d || d.version !== 1 || !Array.isArray(d.plans) || typeof d.activeId !== 'string')
    throw new Error('invalid');
  const plans = d.plans.map((v: unknown) => {
    if (!v || typeof v !== 'object') throw new Error('invalid');
    const p = v as Record<string, unknown>;
    // Saved libraries must be complete. Do not turn damaged records into empty plans.
    if (
      typeof p.id !== 'string' ||
      !p.id ||
      typeof p.name !== 'string' ||
      !Array.isArray(p.groups) ||
      !Array.isArray(p.cells) ||
      typeof p.updatedAt !== 'number' ||
      !Number.isFinite(p.updatedAt)
    )
      throw new Error('invalid');
    return parsePlan(p, FIXED_NODES);
  });
  if (
    new Set(plans.map((p: { id: string }) => p.id)).size !== plans.length ||
    plans.some((p: { id: string }) => p.id.startsWith('preset-'))
  )
    throw new Error('invalid');
  return {
    version: 1,
    plans,
    activeId: [...plans, ...PRESETS].some((p) => p.id === d.activeId) ? d.activeId : 'preset-one',
  };
}

function readSnapshot(storage: Pick<Storage, 'getItem'>): StoredSnapshot {
  const current = storage.getItem(STORAGE_KEY);
  return { current, legacy: current === null ? storage.getItem(LEGACY_KEY) : null };
}
function decodeSnapshot(snapshot: StoredSnapshot): Library {
  if (snapshot.current !== null) return decodeLibrary(snapshot.current);
  if (snapshot.legacy !== null) {
    const raw = JSON.parse(snapshot.legacy);
    if (!raw || (!Array.isArray(raw.groups) && !Array.isArray(raw.treeGroups)))
      throw new Error('invalid');
    const p = parsePlan(raw, FIXED_NODES);
    p.id = 'migrated-layout';
    p.name = '';
    return { version: 1, activeId: p.id, plans: [p] };
  }
  return emptyLibrary();
}
export function loadLibrary(storage: Pick<Storage, 'getItem'>): Library {
  return decodeSnapshot(readSnapshot(storage));
}
export function exportLibrary(library: Library) {
  return { format: LIBRARY_FORMAT, ...library };
}
const matches = (a: StoredSnapshot, b: StoredSnapshot) =>
  a.current === b.current && a.legacy === b.legacy;

/** One tab's baseline. All writes, including recovery, use the same cross-tab lock. */
export class LibraryStorage {
  private state: StorageState = {
    library: emptyLibrary(),
    issue: null,
    needsRecovery: false,
    recoveredFromBackup: false,
    original: null,
  };
  private generation = 0;

  constructor(
    private readonly getStorage: () => StorageAccess,
    private readonly exclusive: ExclusiveLock | undefined,
  ) {
    this.reload();
  }

  get status(): StorageState {
    return { ...this.state };
  }

  reload(): StorageState {
    this.generation++;
    this.state = {
      library: emptyLibrary(),
      issue: null,
      needsRecovery: false,
      recoveredFromBackup: false,
      original: null,
    };
    let storage: StorageAccess;
    try {
      storage = this.getStorage();
      this.state.original = readSnapshot(storage);
    } catch {
      this.state.issue = 'unavailable';
      return this.status;
    }
    try {
      this.state.library = decodeSnapshot(this.state.original);
      if (!this.exclusive) this.state.issue = 'unsupported';
    } catch {
      this.state.issue = 'corrupt';
      this.state.needsRecovery = true;
      try {
        const backup = storage.getItem(BACKUP_KEY);
        if (backup !== null) {
          this.state.library = decodeLibrary(backup);
          this.state.recoveredFromBackup = true;
        }
      } catch {
        /* Keep the original bytes even if the backup is also unreadable. */
      }
    }
    return this.status;
  }

  cancelPending() {
    this.generation++;
  }

  inspect(): StorageState {
    if (!this.state.original) return this.status;
    try {
      if (!matches(readSnapshot(this.getStorage()), this.state.original))
        this.state.issue = 'conflict';
    } catch {
      this.state.issue = 'unavailable';
    }
    return this.status;
  }

  async save(library: Library, recover = false): Promise<StorageState> {
    const generation = this.generation;
    if (
      !this.state.original ||
      this.state.issue === 'conflict' ||
      (this.state.needsRecovery && !recover)
    )
      return this.status;
    if (!this.exclusive) {
      this.state.issue = 'unsupported';
      return this.status;
    }
    try {
      return await this.exclusive(() => {
        // A reload invalidates pending writes from the previous page state.
        if (generation !== this.generation) return this.status;
        if (this.state.issue === 'conflict') return this.status;
        const storage = this.getStorage();
        const original = this.state.original!;
        if (!matches(readSnapshot(storage), original)) {
          this.state.issue = 'conflict';
          return this.status;
        }
        const raw = JSON.stringify(library);
        decodeLibrary(raw); // Never save a library that cannot be loaded again.
        if (raw !== original.current || this.state.needsRecovery) {
          if (this.state.needsRecovery) {
            // Archiving must succeed BEFORE replacing unreadable data. Never reuse a key.
            storage.setItem(
              `${RECOVERY_PREFIX}${crypto.randomUUID()}`,
              JSON.stringify({
                format: 'everdale-planner-recovery',
                capturedAt: Date.now(),
                ...original,
              }),
            );
          }
          const previous =
            this.state.needsRecovery || original.current === null
              ? JSON.stringify(this.state.library)
              : original.current;
          storage.setItem(BACKUP_KEY, previous);
          storage.setItem(STORAGE_KEY, raw);
        }
        this.state = {
          library,
          issue: null,
          needsRecovery: false,
          recoveredFromBackup: false,
          original: { current: raw, legacy: null },
        };
        return this.status;
      });
    } catch {
      if (generation === this.generation) this.state.issue = 'write';
      return this.status;
    }
  }
}
