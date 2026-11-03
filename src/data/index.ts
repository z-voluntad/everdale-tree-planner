import fixedData from './fixed-nodes.json';
import one from './layout-one.json';
import two from './layout-two.json';
import area from './build-area.json';
import referenceTwo from './reference-two.json';
import type { FixedNode, Plan, TreeGroup } from '../domain/types';
import type { MessageKey } from '../i18n/messages';
export const FIXED_NODES = fixedData as FixedNode[];
export const BUILD_AREA = area;
const templates = [
  { data: one, title: 'one', description: 'oneDesc' },
  { data: two, title: 'two', description: 'twoDesc' },
] satisfies { data: typeof one | typeof two; title: MessageKey; description: MessageKey }[];
export const PRESET_META = Object.fromEntries(
  templates.map(({ data, title, description }) => [data.id, { title, description }]),
);
export const PRESETS: Plan[] = templates.map(({ data: p }) => ({
  ...p,
  name: p.reference,
  groups: p.groups as TreeGroup[],
  reference: p.reference as 'one' | 'two',
  updatedAt: 0,
}));
export const REFERENCE_TWO = referenceTwo;
export function boundaryPath(mask: string[]) {
  let d = '';
  for (let y = 0; y < 70; y++)
    for (let x = 0; x < 70; x++)
      if (mask[y][x] === '.') {
        if (x === 0 || mask[y][x - 1] !== '.') d += `M${x} ${y}v1`;
        if (x === 69 || mask[y][x + 1] !== '.') d += `M${x + 1} ${y}v1`;
        if (y === 0 || mask[y - 1][x] !== '.') d += `M${x} ${y}h1`;
        if (y === 69 || mask[y + 1][x] !== '.') d += `M${x} ${y + 1}h1`;
      }
  return d;
}
export const BUILD_PATH = boundaryPath(BUILD_AREA);
