// Trace: REV-016 #8 — Layout engine interface for swappable auto-layout
export interface LayoutNode {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

export interface LayoutOptions {
  direction: "LR" | "TB";
  nodeSpacing: number;
  rankSpacing: number;
}

export interface ILayoutEngine {
  layout(
    nodes: LayoutNode[],
    edges: LayoutEdge[],
    options: LayoutOptions,
  ): LayoutNode[];
}
