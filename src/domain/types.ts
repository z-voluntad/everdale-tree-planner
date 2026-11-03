export type Locale = 'zh-CN' | 'en';
export type TreeSize = 2 | 4 | 5;
export type PlannerMode = 'progress' | 'layout';
export interface TreeGroup {
  id: string;
  x: number;
  y: number;
  w: TreeSize;
  h: TreeSize;
  /** Missing in older saves; treated as not yet grown. */
  grown?: boolean;
}
export interface FixedNode {
  id: string;
  kind: 'soup' | 'stone' | 'clay' | 'forest';
  x: number;
  y: number;
  w: number;
  h: number;
}
export type PaintCell = [number, number, string];
export interface Plan {
  id: string;
  name: string;
  groups: TreeGroup[];
  cells: PaintCell[];
  reference?: 'one' | 'two';
  updatedAt: number;
}
export interface Library {
  version: 1;
  activeId: string;
  plans: Plan[];
}
export interface Point {
  x: number;
  y: number;
}
export type PlacementIssue = 'bounds' | 'fixed' | 'overlap' | null;
