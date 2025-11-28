declare module 'd3-org-chart' {
  export class OrgChart<T = any> {
    constructor();
    container(element: HTMLElement | null): this;
    data(data: T[]): this;
    nodeWidth(fn: (d?: any) => number): this;
    nodeHeight(fn: (d?: any) => number): this;
    childrenMargin(fn: (d?: any) => number): this;
    compactMarginBetween(fn: (d?: any) => number): this;
    compactMarginPair(fn: (d?: any) => number): this;
    neighbourMargin(fn: (d?: any) => number): this;
    siblingsMargin(fn: (d?: any) => number): this;
    nodeButtonX(fn: (d?: any) => number): this;
    nodeButtonY(fn: (d?: any) => number): this;
    nodeContent(fn: (d: any) => string): this;
    onNodeClick(fn: (nodeId: string) => void): this;
    render(): this;
    exportSvg(): void;
    destroy(): void;
  }
}

