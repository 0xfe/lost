import type { V3 } from './vector';

export type RGB = V3;
/** Opaque 0–255 RGB base color, optionally modulated by a named scalar texture. */
export interface Material { color: RGB; texture?: string }
/** Row-major brightness multipliers (1 is neutral), with positive dimensions and UV repeats. */
export interface ScalarTexture {
  width: number;
  height: number;
  data: ArrayLike<number>;
  repeatU: number;
  repeatV: number;
}
export type TextureSet = Readonly<Record<string, ScalarTexture>>;
export const solid = (color: RGB): Material => ({ color });

/** Nearest-neighbor repeat sampling in model UVs; accepts negative coordinates. */
export function sampleScalar(texture: ScalarTexture, u: number, v: number): number {
  const x = ((Math.floor(u * texture.width * texture.repeatU) % texture.width) + texture.width) % texture.width;
  const y = ((Math.floor(v * texture.height * texture.repeatV) % texture.height) + texture.height) % texture.height;
  return texture.data[y * texture.width + x] ?? 1;
}
