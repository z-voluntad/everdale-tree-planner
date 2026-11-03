import { FIXED_NODES, PRESETS } from '../data';
import { parsePlan } from '../domain/layout';
import type { Library } from '../domain/types';
export const STORAGE_KEY = 'everdale-planner.library.v1';
export const LEGACY_KEY = 'everdale.layout.boundaries.v2';
export function decodeLibrary(raw: string): Library {
  const d = JSON.parse(raw);
  if (d.version !== 1 || !Array.isArray(d.plans) || typeof d.activeId !== 'string')
    throw new Error('invalid');
  const plans = d.plans.map((v: unknown) => parsePlan(v, FIXED_NODES));
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
export function loadLibrary(storage: Pick<Storage, 'getItem'>): Library {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw) return decodeLibrary(raw);
  const old = storage.getItem(LEGACY_KEY);
  if (old) {
    const p = parsePlan(JSON.parse(old), FIXED_NODES);
    p.id = 'migrated-layout';
    p.name = '';
    return { version: 1, activeId: p.id, plans: [p] };
  }
  return { version: 1, activeId: 'preset-one', plans: [] };
}
