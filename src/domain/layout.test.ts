import { describe, it, expect } from 'vitest';
import { FIXED_NODES, PRESETS, BUILD_AREA } from '../data';
import { placementIssue, validateGroups, parsePlan, exportPlan, treeStats } from './layout';
import { decodeLibrary, loadLibrary, LEGACY_KEY } from '../services/storage';
import { planSvg } from '../services/export';
import { zh, en } from '../i18n/messages';
describe('verified map and layouts', () => {
  it('keeps the exact seven fixed resource footprints', () => {
    expect(FIXED_NODES.map((n) => [n.x, n.y, n.w, n.h])).toEqual([
      [33, 33, 4, 4],
      [15, 50, 4, 4],
      [16, 17, 4, 4],
      [54, 12, 4, 4],
      [10, 37, 5, 5],
      [54, 27, 5, 5],
      [48, 41, 4, 4],
    ]);
    expect(BUILD_AREA).toHaveLength(70);
    expect(BUILD_AREA.flatMap((r) => [...r]).filter((c) => c === '.')).toHaveLength(2600);
  });
  it('preserves both extracted tree rings without forcing the count to 450', () => {
    expect(treeStats(PRESETS[0].groups)).toMatchObject({ count: 70, units: 450, area: 1564 });
    expect(treeStats(PRESETS[1].groups)).toMatchObject({ count: 87, units: 451, area: 1464 });
    for (const p of PRESETS) expect(validateGroups(p.groups, FIXED_NODES)).toEqual(p.groups);
  });
  it('blocks fixed nodes, overlap and edges but allows movement away from its own footprint', () => {
    const g = { id: 'test', x: 28, y: 24, w: 5 as const, h: 5 as const };
    expect(placementIssue(g, PRESETS[0].groups, FIXED_NODES)).toBeNull();
    expect(placementIssue({ ...g, x: 33, y: 33 }, [], FIXED_NODES)).toBe('fixed');
    expect(placementIssue({ ...g, x: 66 }, [], FIXED_NODES)).toBe('bounds');
    expect(placementIssue({ ...g, x: 1.1 }, [], FIXED_NODES)).toBe('bounds');
    const t = PRESETS[0].groups[0];
    expect(placementIssue(t, PRESETS[0].groups, FIXED_NODES)).toBe('overlap');
    expect(placementIssue(t, PRESETS[0].groups, FIXED_NODES, t.id)).toBeNull();
  });
});
describe('portable plans and local library', () => {
  it('round-trips groups and painted cells', () => {
    const p = {
      ...PRESETS[1],
      id: 'mine',
      name: '庭院 Garden',
      cells: [[20, 20, '#abcdef']] as [number, number, string][],
    };
    expect(parsePlan(JSON.parse(JSON.stringify(exportPlan(p))), FIXED_NODES)).toEqual(p);
    const library = decodeLibrary(JSON.stringify({ version: 1, activeId: 'mine', plans: [p] }));
    expect(library.plans[0]).toEqual(p);
  });
  it('accepts old JSON without changing fixed resources', () => {
    const legacy = { N: 70, treeGroups: PRESETS[0].groups, cells: [], nodes: [{ x: 0, y: 0 }] };
    const imported = parsePlan(legacy, FIXED_NODES);
    expect(imported.groups).toEqual(PRESETS[0].groups);
    expect('nodes' in imported).toBe(false);
    const migrated = loadLibrary({
      getItem: (key) => (key === LEGACY_KEY ? JSON.stringify(legacy) : null),
    });
    expect(migrated.plans).toHaveLength(1);
    expect(migrated.activeId).toBe('migrated-layout');
  });
  it('rejects malformed input without touching the source plan', () => {
    const before = JSON.stringify(PRESETS);
    for (const raw of [
      { ...PRESETS[0], N: 80 },
      { ...PRESETS[0], groups: [PRESETS[0].groups[0], PRESETS[0].groups[0]] },
      { ...PRESETS[0], groups: [{ id: 'x', x: 33, y: 33, w: 5, h: 5 }] },
      { ...PRESETS[0], cells: [[0, 0, 'red" onload="bad']] },
    ])
      expect(() => parsePlan(raw, FIXED_NODES)).toThrow();
    expect(JSON.stringify(PRESETS)).toBe(before);
  });
  it('rejects duplicate library IDs and safely escapes exported names', () => {
    const p = { ...PRESETS[0], id: 'mine' };
    expect(() =>
      decodeLibrary(JSON.stringify({ version: 1, activeId: 'mine', plans: [p, p] })),
    ).toThrow();
    expect(planSvg(p, '<script>&', true)).not.toContain('<script>');
    expect(planSvg(p, '<script>&', true)).toContain('&lt;script&gt;&amp;');
  });
  it('provides both languages for every UI message', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    expect(Object.values(en).every(Boolean)).toBe(true);
  });
});
