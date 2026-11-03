import type { Plan, TreeGroup } from '../domain/types';
import { exportPlan } from '../domain/layout';
import { BUILD_PATH, FIXED_NODES } from '../data';

export function downloadText(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const safeName = (name: string) =>
  name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').slice(0, 60) || 'everdale-layout';
export function downloadPlan(plan: Plan, name: string) {
  downloadText(
    JSON.stringify({ ...exportPlan(plan), name }, null, 2),
    'application/json',
    safeName(name) + '.json',
  );
}
const xml = (text: string) =>
  text.replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!,
  );

function groveSvg(g: TreeGroup) {
  const fill = g.grown ? '#365d42' : g.w === 5 ? '#e0e9cd' : '#d8e5db';
  const stroke = g.grown ? '#2b4c35' : g.w === 5 ? '#a7bc8a' : '#91b1a2';
  const leaf = g.grown ? '#bed6ab' : '#6d9067';
  return `<g><rect x="${g.x + 0.12}" y="${g.y + 0.12}" width="${g.w - 0.24}" height="${g.h - 0.24}" rx=".3" fill="${fill}" stroke="${stroke}" stroke-width=".12"/>
    <path transform="translate(${g.x + g.w / 2} ${g.y + g.h / 2}) scale(${g.w * 0.2})" d="M-.82.65C-1.45-.5-.3-1.12 1-1.15 1.15.05.7 1.1-.5.8M-.95 1.05.55-.55" fill="none" stroke="${leaf}" stroke-width=".16"/>
    ${g.grown ? `<path transform="translate(${g.x + g.w - 1.15} ${g.y + 0.5}) scale(.65)" d="M0 .4.35.75 1 0" fill="none" stroke="#f4faec" stroke-width=".2" stroke-linecap="round" stroke-linejoin="round"/>` : ''}</g>`;
}
export function planSvg(plan: Plan, name: string, boundary: boolean) {
  const cells = plan.cells
    .map(([x, y, color]) => `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`)
    .join('');
  const fixed = FIXED_NODES.map(
    (n) =>
      `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx=".3" fill="${n.kind === 'clay' || n.kind === 'soup' ? '#d8ab8d' : '#aeb7a6'}"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 76 80" width="1140" height="1200">
    <title>${xml(name)}</title><rect x="-3" y="-3" width="76" height="80" fill="#f7f8f2"/>
    <defs><pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#dce2d3" stroke-width=".04"/></pattern></defs>
    <rect width="70" height="70" fill="url(#grid)"/>${cells}${plan.groups.map(groveSvg).join('')}${fixed}
    ${boundary ? `<path d="${BUILD_PATH}" stroke="#7aa8b7" stroke-width=".17" fill="none"/>` : ''}
    <text x="35" y="75" text-anchor="middle" font-family="sans-serif" font-size="1.5" fill="#45614e">${xml(name)} · Everdale Planner</text></svg>`;
}
