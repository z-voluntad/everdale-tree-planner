import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { BUILD_PATH, FIXED_NODES, REFERENCE_TWO } from '../data';
import { makeTree, placementIssue } from '../domain/layout';
import { useI18n } from '../i18n';
import type { Plan, Point, TreeGroup, TreeSize } from '../domain/types';
import type { MessageKey } from '../i18n/messages';
import { GroveSymbol } from './GroveSymbol';
type View = { x: number; y: number; size: number };
type Gesture = {
  mode: 'move' | 'palette' | 'place' | 'pan';
  pointerId: number;
  start: Point;
  offset: Point;
  size: TreeSize;
  id?: string;
  moved: boolean;
  view: View;
};
export interface MapBoardHandle {
  startPalette: (e: ReactPointerEvent, size: TreeSize) => void;
  arm: (size: TreeSize) => void;
  zoom: (factor: number) => void;
  fit: () => void;
}
interface Props {
  plan: Plan;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (groups: TreeGroup[]) => void;
  onMessage: (key: MessageKey) => void;
  grid: boolean;
  boundary: boolean;
  reference: boolean;
}
export const MapBoard = forwardRef<MapBoardHandle, Props>(function MapBoard(
  { plan, selected, onSelect, onEdit, onMessage, grid, boundary, reference },
  ref,
) {
  const { t } = useI18n();
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [view, setView] = useState<View>({ x: -4, y: -4, size: 78 });
  const [ghost, setGhost] = useState<TreeGroup | null>(null);
  const [armed, setArmed] = useState<TreeSize | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const point = (e: { clientX: number; clientY: number }): Point => {
    const s = svg.current!;
    const p = s.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const result = p.matrixTransform(s.getScreenCTM()!.inverse());
    return { x: Math.floor(result.x), y: Math.floor(result.y) };
  };
  const candidate = (e: { clientX: number; clientY: number }, g: Gesture): TreeGroup => {
    const p = point(e);
    return {
      id: g.id ?? 'preview',
      x: p.x - g.offset.x,
      y: p.y - g.offset.y,
      w: g.size,
      h: g.size,
    };
  };
  const inside = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    return (
      e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    );
  };
  function cancel() {
    gesture.current = null;
    setGhost(null);
    setMoving(null);
    setArmed(null);
  }
  function zoom(factor: number) {
    setView((v) => {
      const size = Math.min(100, Math.max(18, v.size * factor));
      return { x: v.x + (v.size - size) / 2, y: v.y + (v.size - size) / 2, size };
    });
  }
  useImperativeHandle(ref, () => ({
    startPalette(e, size) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setArmed(null);
      gesture.current = {
        mode: 'palette',
        pointerId: e.pointerId,
        start: { x: e.clientX, y: e.clientY },
        offset: { x: Math.floor(size / 2), y: Math.floor(size / 2) },
        size,
        moved: false,
        view,
      };
    },
    arm(size) {
      setArmed(size);
      onMessage('readyPlace');
      svg.current?.focus();
    },
    zoom,
    fit() {
      setView({ x: -4, y: -4, size: 78 });
    },
  }));
  useEffect(() => {
    cancel();
  }, [plan.id]);
  useEffect(() => {
    function move(e: PointerEvent) {
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) return;
      if (Math.hypot(e.clientX - g.start.x, e.clientY - g.start.y) > 4) g.moved = true;
      if (g.mode === 'pan') {
        const r = svg.current!.getBoundingClientRect(),
          scale = g.view.size / Math.min(r.width, r.height);
        setView({
          ...g.view,
          x: Math.max(-65, Math.min(65, g.view.x - (e.clientX - g.start.x) * scale)),
          y: Math.max(-65, Math.min(65, g.view.y - (e.clientY - g.start.y) * scale)),
        });
        return;
      }
      setGhost(inside(e) ? candidate(e, g) : null);
      if (g.mode === 'move' && g.moved) setMoving(g.id!);
    }
    function up(e: PointerEvent) {
      const g = gesture.current;
      if (!g || g.pointerId !== e.pointerId) return;
      gesture.current = null;
      setGhost(null);
      setMoving(null);
      if (g.mode === 'pan') return;
      if (g.mode === 'palette' && !g.moved) {
        setArmed(g.size);
        onMessage('readyPlace');
        return;
      }
      if (g.mode === 'move' && !g.moved) return;
      if (!inside(e)) {
        onMessage('bounds');
        return;
      }
      const next = candidate(e, g),
        issue = placementIssue(
          next,
          plan.groups,
          FIXED_NODES,
          g.mode === 'move' ? g.id : undefined,
        );
      if (issue) {
        onMessage(issue);
        return;
      }
      if (g.mode === 'move') {
        const old = plan.groups.find((t) => t.id === g.id);
        if (old?.x === next.x && old.y === next.y) return;
        onEdit(plan.groups.map((t) => (t.id === g.id ? next : t)));
        onMessage('moved');
      } else {
        const added = makeTree(g.size, next.x, next.y);
        onEdit([...plan.groups, added]);
        onSelect(added.id);
        setArmed(null);
        onMessage('placed');
      }
    }
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') cancel();
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', key);
    };
  });
  useEffect(() => {
    const element = svg.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12);
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);
  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    e.currentTarget.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    const hit = (e.target as Element).closest('[data-tree-id]')?.getAttribute('data-tree-id');
    const group = plan.groups.find((t) => t.id === hit);
    const p = point(e);
    if (armed) {
      gesture.current = {
        mode: 'place',
        pointerId: e.pointerId,
        start: { x: e.clientX, y: e.clientY },
        offset: { x: Math.floor(armed / 2), y: Math.floor(armed / 2) },
        size: armed,
        moved: false,
        view,
      };
      setGhost(candidate(e, gesture.current));
      return;
    }
    if (group && e.button === 0) {
      onSelect(group.id);
      gesture.current = {
        mode: 'move',
        pointerId: e.pointerId,
        start: { x: e.clientX, y: e.clientY },
        offset: { x: p.x - group.x, y: p.y - group.y },
        size: group.w,
        id: group.id,
        moved: false,
        view,
      };
    } else {
      onSelect(null);
      gesture.current = {
        mode: 'pan',
        pointerId: e.pointerId,
        start: { x: e.clientX, y: e.clientY },
        offset: { x: 0, y: 0 },
        size: 4,
        moved: false,
        view,
      };
    }
  };
  const issue = ghost
    ? placementIssue(
        ghost,
        plan.groups,
        FIXED_NODES,
        gesture.current?.mode === 'move' ? gesture.current.id : undefined,
      )
    : null;
  const shorts = {
    soup: 'fixedShortSoup',
    stone: 'fixedShortStone',
    clay: 'fixedShortClay',
    forest: 'fixedShortForest',
  } as const;
  return (
    <div className="map-surface">
      <svg
        ref={svg}
        viewBox={`${view.x} ${view.y} ${view.size} ${view.size}`}
        className={`village-map ${armed ? 'placing' : ''}`}
        tabIndex={0}
        role="img"
        aria-label={t('board')}
        onPointerDown={down}
        onPointerMove={(e) => {
          const p = point(e);
          setCursor(p);
          if (armed && !gesture.current)
            setGhost({
              id: 'preview',
              x: p.x - Math.floor(armed / 2),
              y: p.y - Math.floor(armed / 2),
              w: armed,
              h: armed,
            });
        }}
        onPointerLeave={() => {
          setCursor(null);
          if (!gesture.current) setGhost(null);
        }}
      >
        <defs>
          <pattern id="minor-grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M1 0H0V1" fill="none" stroke="#c5cfb7" strokeWidth=".035" />
          </pattern>
          <pattern id="major-grid" width="5" height="5" patternUnits="userSpaceOnUse">
            <rect width="5" height="5" fill="url(#minor-grid)" />
            <path d="M5 0H0V5" fill="none" stroke="#c2ccb6" strokeWidth=".07" />
          </pattern>
        </defs>
        <rect width="70" height="70" className="map-paper" />
        {reference && plan.reference === 'two' && (
          <g opacity=".28" pointerEvents="none">
            {REFERENCE_TWO.map((c) => (
              <rect key={`${c.x},${c.y}`} x={c.x} y={c.y} width="1" height="1" fill={c.color} />
            ))}
          </g>
        )}
        {plan.cells.map(([x, y, c]) => (
          <rect
            key={`${x},${y}`}
            x={x}
            y={y}
            width="1"
            height="1"
            fill={c}
            opacity=".55"
            pointerEvents="none"
          />
        ))}
        {grid && <rect width="70" height="70" fill="url(#major-grid)" pointerEvents="none" />}
        {plan.groups.map((g) => (
          <g key={g.id} opacity={moving === g.id ? 0.2 : 1}>
            <GroveSymbol tree={g} selected={selected === g.id && moving !== g.id} />
          </g>
        ))}
        {FIXED_NODES.map((n) => (
          <g key={n.id} className={`fixed-node ${n.kind}`}>
            <title>
              {t(n.kind)} · {n.x}, {n.y}
            </title>
            <rect x={n.x + 0.1} y={n.y + 0.1} width={n.w - 0.2} height={n.h - 0.2} rx=".28" />
            <text
              x={n.x + n.w / 2}
              y={n.y + n.h / 2 + 0.08}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {t(shorts[n.kind])}
            </text>
          </g>
        ))}
        {boundary && <path d={BUILD_PATH} className="build-boundary" pointerEvents="none" />}
        <g className="map-entrance">
          <path d="M36.3 66V64.3h1.4V66M35.8 66.4h2.4" />
          <text x="37" y="68.5" textAnchor="middle">
            {t('entrance')}
          </text>
        </g>
        {ghost && <GroveSymbol tree={ghost} ghost invalid={!!issue} />}
        <g className="map-rulers" aria-hidden="true">
          {Array.from({ length: 15 }, (_, i) => i * 5).map((n) => (
            <g key={n}>
              <text x={n + 0.5} y="-1.3" textAnchor="middle">
                {n}
              </text>
              <text x="-1.3" y={n + 0.7} textAnchor="end">
                {n}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <div className="map-caption">
        <span>
          {cursor && cursor.x >= 0 && cursor.x < 70 && cursor.y >= 0 && cursor.y < 70
            ? `X ${cursor.x} · Y ${cursor.y}`
            : t('fixedMap')}
        </span>
        <span>{ghost && issue ? t(issue) : t('moveHint')}</span>
      </div>
    </div>
  );
});
