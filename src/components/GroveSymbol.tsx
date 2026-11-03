import type { TreeGroup } from '../domain/types';
export function GroveSymbol({
  tree,
  selected = false,
  ghost = false,
  invalid = false,
}: {
  tree: TreeGroup;
  selected?: boolean;
  ghost?: boolean;
  invalid?: boolean;
}) {
  const { x, y, w } = tree;
  return (
    <g
      className={`grove size-${w} ${selected ? 'selected' : ''} ${ghost ? 'ghost' : ''} ${invalid ? 'invalid' : ''}`}
      data-tree-id={ghost ? undefined : tree.id}
    >
      <rect
        x={x + 0.12}
        y={y + 0.12}
        width={w - 0.24}
        height={w - 0.24}
        rx={0.3}
        className="grove-tile"
      />
      <path
        className="grove-leaf"
        transform={`translate(${x + w / 2} ${y + w / 2}) scale(${w * 0.2})`}
        d="M-.82.65C-1.45-.5-.3-1.12 1-1.15 1.15.05.7 1.1-.5.8M-.95 1.05.55-.55"
      />
      {selected && (
        <>
          <rect x={x} y={y} width={w} height={w} className="selection-outline" />
          {[
            [x, y],
            [x + w, y],
            [x, y + w],
            [x + w, y + w],
          ].map(([a, b]) => (
            <rect
              key={`${a},${b}`}
              x={a - 0.24}
              y={b - 0.24}
              width={0.48}
              height={0.48}
              className="selection-handle"
            />
          ))}
        </>
      )}
    </g>
  );
}
