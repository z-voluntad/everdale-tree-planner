import type { Plan } from '../domain/types';
import { FIXED_NODES } from '../data';
export function MiniMap({ plan }: { plan: Plan }) {
  return (
    <svg viewBox="-2 -2 74 74" aria-hidden="true" className="mini-map">
      <rect width="70" height="70" rx="2" fill="#f7f8f2" />
      {plan.groups.map((g) => (
        <rect
          key={g.id}
          x={g.x + 0.2}
          y={g.y + 0.2}
          width={g.w - 0.4}
          height={g.h - 0.4}
          rx=".5"
          fill={g.w === 5 ? '#a9bb8d' : '#86a898'}
        />
      ))}
      {FIXED_NODES.map((n) => (
        <rect key={n.id} x={n.x} y={n.y} width={n.w} height={n.h} fill="#b6b5a6" />
      ))}
    </svg>
  );
}
