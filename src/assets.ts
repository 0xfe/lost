import type { Region } from './render';
export interface Atlas {
  width: number; height: number;
  floor: Region; wall: Region; glow: Region; shadow: Region;
  rat: Region[][];
  anchors: { x: number; y: number }[];
  roots: { x: number; y: number }[];
  noses: { x: number; y: number }[];
  liveRat:Region;
  fur:number[];
}
