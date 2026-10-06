import type { DrawCommand } from './render';
const CORNERS = [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1] as const;
/** Fill a retained interleaved GPU buffer without allocating arrays per vertex. */
export function writeQuads(commands: readonly DrawCommand[], width: number, height: number, output: Float32Array): number {
  const length = commands.length * 48;
  if (output.length < length) throw new Error('Vertex buffer is too small');
  let i = 0;
  for (const c of commands) {
    const r = c.region;
    const u0 = (r?.x ?? 0) / width, v0 = (r?.y ?? 0) / height;
    const uw = (r?.width ?? 1) / width, vh = (r?.height ?? 1) / height;

    for (let corner = 0; corner < 12; corner += 2) {
      const x = CORNERS[corner]!, y = CORNERS[corner + 1]!;
      const point = c.corners?.[x + y * 2];
      output[i++] = point?.x ?? c.x + x * c.width; output[i++] = point?.y ?? c.y + y * c.height;
      const uv=c.uvCorners?.[x+y*2],u=uv?.x??x,v=uv?.y??y;
      output[i++] = u0 + (c.flip ? 1 - u : u) * uw; output[i++] = v0 + v * vh;
      const tint=c.cornerColors?.[x+y*2]??c.color;
      output[i++] = tint[0]/255; output[i++] = tint[1]/255; output[i++] = tint[2]/255; output[i++] = tint[3]/255;
    }
  }
  return length;
}
