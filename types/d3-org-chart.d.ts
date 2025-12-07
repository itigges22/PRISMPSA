declare module 'd3-org-chart' {
  export class OrgChart<T = unknown> {
    constructor();
    container(element: HTMLElement | null): this;
    data(data: T[]): this;
    nodeWidth(fn: (d?: unknown) => number): this;
    nodeHeight(fn: (d?: unknown) => number): this;
    childrenMargin(fn: (d?: unknown) => number): this;
    compactMarginBetween(fn: (d?: unknown) => number): this;
    compactMarginPair(fn: (d?: unknown) => number): this;
    neighbourMargin(fn: (d?: unknown) => number): this;
    siblingsMargin(fn: (d?: unknown) => number): this;
    nodeButtonX(fn: (d?: unknown) => number): this;
    nodeButtonY(fn: (d?: unknown) => number): this;
    nodeContent(fn: (d: any) => string): this;
    onNodeClick(fn: (nodeId: string) => void): this;
    render(): this;
    exportSvg(): void;
    destroy(): void;
  }
}

