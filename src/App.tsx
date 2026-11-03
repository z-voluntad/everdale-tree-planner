import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  Copy,
  FilePlus2,
  FolderOpen,
  Globe,
  Leaf,
  Minus,
  MoreHorizontal,
  MoveUpRight,
  Plus,
  Redo2,
  Save,
  Scan,
  Trash2,
  Undo2,
  X,
  BookOpen,
} from 'lucide-react';
import { FIXED_NODES, PRESETS, PRESET_META } from './data';
import { useI18n } from './i18n';
import type { MessageKey } from './i18n/messages';
import { usePlanner } from './hooks/usePlanner';
import { makeTree, placementIssue, treeStats } from './domain/layout';
import type { TreeGroup, TreeSize } from './domain/types';
import { MapBoard, type MapBoardHandle } from './components/MapBoard';
import { GroveSymbol } from './components/GroveSymbol';
import { MiniMap } from './components/MiniMap';
import { SourcesDialog } from './components/SourcesDialog';
import { downloadPlan, downloadText, planSvg } from './services/export';
export default function App() {
  const { t, locale, setLocale } = useI18n();
  const planner = usePlanner();
  const board = useRef<MapBoardHandle>(null);
  const file = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<'custom' | 'presets' | 'files' | null>(null);
  const [sources, setSources] = useState(false);
  const [grid, setGrid] = useState(true);
  const [boundary, setBoundary] = useState(true);
  const [reference, setReference] = useState(false);
  const [toast, setToast] = useState<MessageKey | null>(null);
  const current = planner.active;
  const tree = current.groups.find((g) => g.id === selected);
  const stats = treeStats(current.groups);
  const message = (key: MessageKey) => setToast(key);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);
  function choose(id: string) {
    planner.select(id);
    setSelected(null);
    setPanel(null);
  }
  function remove() {
    if (tree) {
      planner.edit(current.groups.filter((g) => g.id !== tree.id));
      setSelected(null);
      message('deleted');
    }
  }
  function move(x: number, y: number) {
    if (!tree) return;
    const next = { ...tree, x, y };
    const issue = placementIssue(next, current.groups, FIXED_NODES, tree.id);
    if (issue) {
      message(issue);
      return;
    }
    if (tree.x !== x || tree.y !== y) {
      planner.edit(current.groups.map((g) => (g.id === tree.id ? next : g)));
      message('moved');
    }
  }
  function duplicate() {
    if (!tree) return;
    for (let d = 1; d < 70; d++)
      for (let dy = -d; dy <= d; dy++)
        for (let dx = -d; dx <= d; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
          const p = { ...tree, x: tree.x + dx, y: tree.y + dy };
          if (!placementIssue(p, current.groups, FIXED_NODES)) {
            const n = makeTree(tree.w, p.x, p.y);
            planner.edit([...current.groups, n]);
            setSelected(n.id);
            message('duplicated');
            return;
          }
        }
    message('noSpace');
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input,textarea,select') || sources) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? planner.redo() : planner.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        planner.save();
        return;
      }
      if (e.key === 'Escape') setPanel(null);
      if (!tree) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        remove();
      }
      const dirs: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      if (dirs[e.key]) {
        e.preventDefault();
        const [x, y] = dirs[e.key],
          d = e.shiftKey ? 5 : 1;
        move(tree.x + x * d, tree.y + y * d);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  const toggle = (p: typeof panel) => setPanel(panel === p ? null : p);
  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="Everdale Planner"
        >
          <span className="brand-mark">
            <Leaf size={21} />
          </span>
          <span>
            <strong>Everdale</strong>
            <small>{t('app')}</small>
          </span>
        </a>
        <nav className="plan-tabs" aria-label={t('planName')}>
          <button
            className={!planner.isPreset ? 'active' : ''}
            onClick={() => toggle('custom')}
            aria-expanded={panel === 'custom'}
          >
            <FolderOpen size={15} />
            {t('custom')}
            <ChevronDown size={12} />
          </button>
          <button
            className={planner.isPreset ? 'active' : ''}
            onClick={() => toggle('presets')}
            aria-expanded={panel === 'presets'}
          >
            {t('presets')}
            <ChevronDown size={12} />
          </button>
        </nav>
        <div className="header-actions">
          <span className={`save-status ${planner.storageError ? 'error' : ''}`}>
            {planner.storageError ? '!' : planner.saved ? <Check size={12} /> : null}
            {planner.storageError ? '' : t(planner.saved ? 'saved' : 'saving')}
          </span>
          <button className="button save-button" aria-label={t('save')} onClick={planner.save}>
            <Save size={14} />
            <span>{t('save')}</span>
          </button>
          <button
            className="icon-button"
            onClick={() => toggle('files')}
            title={t('more')}
            aria-label={t('more')}
            aria-expanded={panel === 'files'}
          >
            <MoreHorizontal size={20} />
          </button>
          <button
            className="language-button"
            onClick={() => setLocale(locale === 'zh-CN' ? 'en' : 'zh-CN')}
            aria-label={t('language')}
          >
            <Globe size={14} />
            {locale === 'zh-CN' ? 'EN' : '中文'}
          </button>
        </div>
      </header>
      {panel && (
        <>
          <button
            className="popover-backdrop"
            aria-label={t('close')}
            onClick={() => setPanel(null)}
          />
          <section
            className={`plan-popover ${panel === 'files' ? 'file-popover' : ''}`}
            aria-label={t(panel === 'files' ? 'more' : panel)}
          >
            <header>
              <h2>{t(panel === 'files' ? 'more' : panel)}</h2>
              <button
                className="icon-button"
                onClick={() => setPanel(null)}
                aria-label={t('close')}
              >
                <X size={16} />
              </button>
            </header>
            {panel === 'presets' && (
              <div className="preset-grid">
                {PRESETS.map((p) => (
                  <button
                    className={`preset-card ${current.id === p.id ? 'chosen' : ''}`}
                    key={p.id}
                    onClick={() => choose(p.id)}
                  >
                    <MiniMap plan={p} />
                    <strong>{planner.name(p)}</strong>
                    <small>{t(PRESET_META[p.id].description)}</small>
                  </button>
                ))}
              </div>
            )}
            {panel === 'custom' && (
              <>
                <div className="custom-list">
                  {planner.plans.length ? (
                    planner.plans.map((p) => (
                      <button
                        className={current.id === p.id ? 'chosen' : ''}
                        key={p.id}
                        onClick={() => choose(p.id)}
                      >
                        <MiniMap plan={p} />
                        <span>
                          <strong>{planner.name(p)}</strong>
                          <small>
                            {p.groups.length} {t('groups')}
                          </small>
                        </span>
                        {current.id === p.id && <Check size={14} />}
                      </button>
                    ))
                  ) : (
                    <p className="empty-library">{t('noCustom')}</p>
                  )}
                </div>
                <div className="library-actions">
                  <button
                    className="button"
                    onClick={() => {
                      planner.create(true);
                      setSelected(null);
                      setPanel(null);
                    }}
                  >
                    <FilePlus2 size={14} />
                    {t('newPlan')}
                  </button>
                  <button
                    className="button"
                    onClick={() => {
                      planner.create();
                      setPanel(null);
                    }}
                  >
                    <Copy size={14} />
                    {t('copyPlan')}
                  </button>
                </div>
                <p className="muted small-text">{t('local')}</p>
              </>
            )}
            {panel === 'files' && (
              <>
                <button className="menu-action" onClick={() => file.current?.click()}>
                  <FolderOpen size={16} />
                  {t('import')}
                </button>
                <button
                  className="menu-action"
                  onClick={() => downloadPlan(current, planner.name(current))}
                >
                  <ArrowDownToLine size={16} />
                  {t('export')}
                </button>
                <button
                  className="menu-action"
                  onClick={() =>
                    downloadText(
                      planSvg(current, planner.name(current), boundary),
                      'image/svg+xml',
                      `everdale-${current.reference ?? 'custom'}.svg`,
                    )
                  }
                >
                  <ArrowDownToLine size={16} />
                  {t('exportSvg')}
                </button>
                <hr />
                <label className="check-row">
                  <input
                    type="checkbox"
                    checked={grid}
                    onChange={(e) => setGrid(e.target.checked)}
                  />
                  {t('grid')}
                </label>
                <label className="check-row" title={t('boundaryTip')}>
                  <input
                    type="checkbox"
                    checked={boundary}
                    onChange={(e) => setBoundary(e.target.checked)}
                  />
                  {t('boundary')}
                </label>
                {current.reference === 'two' && (
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={reference}
                      onChange={(e) => setReference(e.target.checked)}
                    />
                    {t('reference')}
                  </label>
                )}
                <hr />
                <button
                  className="menu-action"
                  onClick={() => {
                    setPanel(null);
                    setSources(true);
                  }}
                >
                  <BookOpen size={16} />
                  {t('sources')}
                </button>
              </>
            )}
          </section>
        </>
      )}
      <main className="workspace">
        <aside className="sidebar">
          <section className="palette-section">
            <div className="section-label">
              {t('treeLibrary')}
              <span>02</span>
            </div>
            <div className="tree-palette">
              {([5, 4] as TreeSize[]).map((size) => (
                <button
                  key={size}
                  className={`palette-card size-${size}`}
                  onPointerDown={(e) => board.current?.startPalette(e, size)}
                  onClick={(e) => {
                    if (e.detail === 0) board.current?.arm(size);
                  }}
                  aria-label={`${t(size === 5 ? 'large' : 'medium')} ${size}×${size}`}
                >
                  <span className="palette-title">
                    {t(size === 5 ? 'large' : 'medium')}
                    <span className="grip">⠿</span>
                  </span>
                  <svg viewBox={`0 0 ${size + 1} ${size + 1}`} aria-hidden="true">
                    <GroveSymbol tree={{ id: 'icon', x: 0.5, y: 0.5, w: size, h: size }} />
                  </svg>
                  <strong>
                    {size} × {size}
                    <small>{t('tiles')}</small>
                  </strong>
                </button>
              ))}
            </div>
            <p className="palette-hint">{t('dragHint')}</p>
          </section>
          <section className="selection-panel">
            <div className="section-label">{t('selected')}</div>
            {tree ? (
              <>
                <div className="selected-name">
                  <Leaf size={14} />
                  <strong>
                    {tree.w} × {tree.h}
                  </strong>
                  <span>{t(tree.w === 5 ? 'large' : tree.w === 4 ? 'medium' : 'small')}</span>
                </div>
                <div className="coordinate-row">
                  <Coordinate
                    label={t('x')}
                    value={tree.x}
                    max={70 - tree.w}
                    onChange={(x) => move(x, tree.y)}
                  />
                  <Coordinate
                    label={t('y')}
                    value={tree.y}
                    max={70 - tree.h}
                    onChange={(y) => move(tree.x, y)}
                  />
                </div>
                <div className="selection-actions">
                  <button className="button" onClick={duplicate}>
                    <Copy size={13} />
                    {t('duplicate')}
                  </button>
                  <button className="button delete-button" onClick={remove}>
                    <Trash2 size={13} />
                    {t('remove')}
                  </button>
                </div>
              </>
            ) : (
              <div className="selection-empty">
                <MoveUpRight size={24} />
                <p>
                  {t('selectHint')}
                  <small>{t('selectSub')}</small>
                </p>
              </div>
            )}
          </section>
          <section className={`budget ${stats.units > 450 ? 'over' : ''}`}>
            <div className="budget-heading">
              <span>{t('units')}</span>
              <strong>
                {stats.units}
                <small> / 450</small>
              </strong>
            </div>
            <div className="budget-track">
              <i style={{ width: `${Math.min(100, (stats.units / 450) * 100)}%` }} />
            </div>
            <div className="budget-meta">
              <span>
                {stats.count} {t('groups')}
              </span>
              <span>
                {stats.area} {t('tiles')}
              </span>
            </div>
            {stats.units > 450 && (
              <p className="over-note">
                {t('over')} +{stats.units - 450}
              </p>
            )}
            <p className="count-note">{t('countNote')}</p>
          </section>
          <div className="sidebar-bottom">
            <button className="text-button" onClick={() => setSources(true)}>
              <BookOpen size={14} />
              {t('sources')}
              <MoveUpRight size={12} />
            </button>
            <details className="help">
              <summary>{t('help')}</summary>
              <p>{t('helpText')}</p>
            </details>
          </div>
        </aside>
        <section className="editor">
          <div className="editor-toolbar">
            <div className="active-plan">
              {planner.isPreset ? (
                <strong>{planner.name(current)}</strong>
              ) : (
                <input
                  aria-label={t('planName')}
                  key={current.id + current.name}
                  defaultValue={planner.name(current)}
                  maxLength={60}
                  onBlur={(e) => planner.rename(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                />
              )}
              <span>{planner.isPreset ? t('readOnly') : t('local')}</span>
            </div>
            <div className="toolbar-actions">
              <button
                className="icon-button"
                onClick={planner.undo}
                disabled={!planner.canUndo}
                title={t('undo')}
                aria-label={t('undo')}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon-button"
                onClick={planner.redo}
                disabled={!planner.canRedo}
                title={t('redo')}
                aria-label={t('redo')}
              >
                <Redo2 size={17} />
              </button>
              <i />
              <button
                className="icon-button"
                onClick={() => board.current?.zoom(1.2)}
                aria-label={t('zoomOut')}
              >
                <Minus size={16} />
              </button>
              <button
                className="icon-button"
                onClick={() => board.current?.zoom(1 / 1.2)}
                aria-label={t('zoomIn')}
              >
                <Plus size={16} />
              </button>
              <button
                className="icon-button"
                onClick={() => board.current?.fit()}
                title={t('fit')}
                aria-label={t('fit')}
              >
                <Scan size={17} />
              </button>
            </div>
          </div>
          <MapBoard
            ref={board}
            plan={current}
            selected={selected}
            onSelect={setSelected}
            onEdit={planner.edit}
            onMessage={message}
            grid={grid}
            boundary={boundary}
            reference={reference}
          />
        </section>
      </main>
      {(toast || planner.storageError) && (
        <div className={`toast ${planner.storageError ? 'error' : ''}`} role="status">
          {t(planner.storageError ? 'saveError' : toast!)}
        </div>
      )}
      <input
        ref={file}
        type="file"
        hidden
        accept=".json,application/json"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            if (f.size > 2_000_000) throw new Error('large');
            planner.importFile(await f.text());
            setSelected(null);
            setPanel(null);
            message('imported');
          } catch {
            message('invalid');
          }
        }}
      />
      <SourcesDialog open={sources} onClose={() => setSources(false)} />
    </div>
  );
}
function Coordinate({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const cancelled = useRef(false);
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (!cancelled.current && draft.trim() && Number.isInteger(n)) onChange(n);
    cancelled.current = false;
    setDraft(String(value));
  };
  return (
    <label>
      {label}
      <input
        type="number"
        value={draft}
        min={0}
        max={max}
        step={1}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelled.current = true;
            setDraft(String(value));
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
