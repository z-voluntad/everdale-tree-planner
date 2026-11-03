import { TREE_UNITS } from './layout';
import type { TreeGroup } from './types';

export function growthProgress(groups: TreeGroup[]) {
  let grown = 0;
  let grownUnits = 0;
  let totalUnits = 0;
  for (const group of groups) {
    totalUnits += TREE_UNITS[group.w];
    if (group.grown) {
      grown++;
      grownUnits += TREE_UNITS[group.w];
    }
  }
  return {
    grown,
    total: groups.length,
    remaining: groups.length - grown,
    grownUnits,
    totalUnits,
    remainingUnits: totalUnits - grownUnits,
    percent: groups.length ? Math.round((grown / groups.length) * 100) : 0,
  };
}

export function toggleGrowth(groups: TreeGroup[], id: string): TreeGroup[] {
  return groups.map((group) => (group.id === id ? { ...group, grown: !group.grown } : group));
}
