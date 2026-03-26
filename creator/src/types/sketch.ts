export interface SketchRoom {
  id: string;
  label: string | null;
  gridX: number;
  gridY: number;
}

export interface SketchConnection {
  from: string;
  to: string;
}

export interface SketchParseResult {
  rooms: SketchRoom[];
  connections: SketchConnection[];
}
