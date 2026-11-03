import type { FixedNode, PaintCell, PlacementIssue, Plan, TreeGroup, TreeSize } from './types';
export const MAP_SIZE = 70;
export const TREE_UNITS: Record<TreeSize, number> = { 2: 3, 4: 5, 5: 7 };
export const TREE_LIMIT = 450;
export const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export function placementIssue(
  t: TreeGroup,
  groups: TreeGroup[],
  fixed: FixedNode[],
  ignoreId?: string,
): PlacementIssue {
  if (
    !Number.isInteger(t.x) ||
    !Number.isInteger(t.y) ||
    t.x < 0 ||
    t.y < 0 ||
    t.x + t.w > MAP_SIZE ||
    t.y + t.h > MAP_SIZE
  )
    return 'bounds';
  if (fixed.some((n) => overlaps(t, n))) return 'fixed';
  return groups.some((g) => g.id !== ignoreId && overlaps(t, g)) ? 'overlap' : null;
}
export const treeStats = (groups: TreeGroup[]) =>
  groups.reduce(
    (s, g) => ({
      ...s,
      count: s.count + 1,
      units: s.units + TREE_UNITS[g.w],
      area: s.area + g.w * g.h,
      [g.w]: s[g.w] + 1,
    }),
    { count: 0, units: 0, area: 0, 2: 0, 4: 0, 5: 0 },
  );
export function makeTree(w: TreeSize, x: number, y: number): TreeGroup {
  return { id: crypto.randomUUID(), x, y, w, h: w };
}
export function validateGroups(value: unknown, fixed: FixedNode[]): TreeGroup[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error('invalid');
  const result: TreeGroup[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') throw new Error('invalid');
    const g = raw as TreeGroup;
    if (
      typeof g.id !== 'string' ||
      !g.id ||
      g.id.length > 120 ||
      ![2, 4, 5].includes(g.w) ||
      g.h !== g.w ||
      (g.grown !== undefined && typeof g.grown !== 'boolean') ||
      result.some((t) => t.id === g.id)
    )
      throw new Error('invalid');
    const clean = {
      id: g.id,
      x: g.x,
      y: g.y,
      w: g.w,
      h: g.h,
      ...(g.grown !== undefined ? { grown: g.grown } : {}),
    };
    if (placementIssue(clean, result, fixed)) throw new Error('invalid');
    result.push(clean);
  }
  return result;
}
export function parsePlan(value: unknown, fixed: FixedNode[]): Plan {
  if (!value || typeof value !== 'object') throw new Error('invalid');
  const d = value as Record<string, unknown>;
  if (d.N !== undefined && d.N !== 70) throw new Error('invalid');
  const groups = validateGroups(d.groups ?? d.treeGroups ?? [], fixed);
  if (!Array.isArray(d.cells ?? []) || ((d.cells as unknown[] | undefined)?.length ?? 0) > 4900)
    throw new Error('invalid');
  const cells: PaintCell[] = ((d.cells as unknown[]) ?? []).map((raw) => {
    if (
      !Array.isArray(raw) ||
      raw.length < 3 ||
      !Number.isInteger(raw[0]) ||
      !Number.isInteger(raw[1]) ||
      raw[0] < 0 ||
      raw[1] < 0 ||
      raw[0] >= 70 ||
      raw[1] >= 70 ||
      typeof raw[2] !== 'string' ||
      !/^#[\da-f]{6}$/i.test(raw[2])
    )
      throw new Error('invalid');
    return [raw[0], raw[1], raw[2]];
  });
  return {
    id: typeof d.id === 'string' ? d.id : crypto.randomUUID(),
    name: typeof d.name === 'string' ? d.name.trim().slice(0, 60) : '',
    groups,
    cells,
    reference: d.reference === 'one' || d.reference === 'two' ? d.reference : undefined,
    updatedAt:
      typeof d.updatedAt === 'number' && Number.isFinite(d.updatedAt) ? d.updatedAt : Date.now(),
  };
}
export function exportPlan(plan: Plan) {
  return { format: 'everdale-planner', version: 1, N: MAP_SIZE, ...plan };
}
