import { describe, expect, it } from 'vitest';
import { PRESETS, FIXED_NODES } from '../data';
import { growthProgress, toggleGrowth } from './progress';
import { exportPlan, makeTree, parsePlan } from './layout';
import { decodeLibrary } from '../services/storage';
import { planSvg } from '../services/export';
import type { TreeGroup } from './types';

describe('growth tracking', () => {
  it('counts whole groves and estimates trees using their sizes', () => {
    const groups: TreeGroup[] = [
      { id: 'large', x: 0, y: 0, w: 5, h: 5, grown: true },
      { id: 'medium', x: 5, y: 0, w: 4, h: 4 },
      { id: 'small', x: 9, y: 0, w: 2, h: 2, grown: true },
    ];
    expect(growthProgress(groups)).toEqual({
      grown: 2,
      total: 3,
      remaining: 1,
      grownUnits: 10,
      totalUnits: 15,
      remainingUnits: 5,
      percent: 67,
    });
    expect(growthProgress([])).toMatchObject({ percent: 0, remaining: 0, remainingUnits: 0 });
    expect(growthProgress(groups.map((g) => ({ ...g, grown: true })))).toMatchObject({
      percent: 100,
      remaining: 0,
    });
  });

  it('toggles without mutating templates or changing positions', () => {
    const original = structuredClone(PRESETS[0].groups);
    const first = original[0];
    const marked = toggleGrowth(PRESETS[0].groups, first.id);
    expect(marked[0]).toEqual({ ...first, grown: true });
    expect(marked.slice(1)).toEqual(original.slice(1));
    expect(PRESETS[0].groups).toEqual(original);
    expect(toggleGrowth(marked, first.id)[0].grown).toBe(false);
    expect(toggleGrowth(marked, 'missing')).toEqual(marked);
    expect(makeTree(first.w, 20, 20).grown).toBeUndefined();
  });

  it('preserves growth in exported JSON and saved libraries', () => {
    const p = {
      ...PRESETS[0],
      id: 'my-progress',
      groups: toggleGrowth(PRESETS[0].groups, PRESETS[0].groups[0].id),
    };
    expect(parsePlan(JSON.parse(JSON.stringify(exportPlan(p))), FIXED_NODES)).toEqual(p);
    const library = decodeLibrary(JSON.stringify({ version: 1, activeId: p.id, plans: [p] }));
    expect(library.plans[0]).toEqual(p);
    expect(growthProgress(library.plans[0].groups).grown).toBe(1);
    const oldPlan = parsePlan(exportPlan(PRESETS[1]), FIXED_NODES);
    expect(growthProgress(oldPlan.groups)).toMatchObject({ grown: 0, total: 87 });
  });

  it('rejects malformed growth flags instead of silently marking trees grown', () => {
    for (const grown of ['true', 1, null, {}, []]) {
      expect(() =>
        parsePlan({ ...PRESETS[0], groups: [{ ...PRESETS[0].groups[0], grown }] }, FIXED_NODES),
      ).toThrow();
    }
  });

  it('renders both the dark fill and the check mark in SVG backups', () => {
    const p = { ...PRESETS[0], groups: toggleGrowth(PRESETS[0].groups, PRESETS[0].groups[0].id) };
    const svg = planSvg(p, 'My growth', false);
    expect(svg.match(/fill="#365d42"/g)).toHaveLength(1);
    expect(svg).toContain('d="M0 .4.35.75 1 0"');
    expect(planSvg(PRESETS[0], 'Untouched', false)).not.toContain('fill="#365d42"');
  });
});
