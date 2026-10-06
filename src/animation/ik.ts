import { add, sub, mul, dot, unit, type V3 } from '../model/vector';

/**
 * Joint position for a reachable two-link chain. Pole must not be parallel to the endpoint axis.
 * Singular reach distances are clamped for numerical stability; callers must keep targets
 * reachable to preserve both link lengths. This function does not reposition endpoints.
 */
export function solveTwoLink(a:V3,b:V3,upper:number,lower:number,pole:V3):V3{
  const axis=unit(sub(b,a)),actual=Math.hypot(...sub(b,a)),d=Math.min(upper+lower-1e-6,Math.max(Math.abs(upper-lower)+1e-6,actual));
  const along=(upper*upper-lower*lower+d*d)/(2*d),off=Math.sqrt(Math.max(0,upper*upper-along*along));
  const bend=unit(sub(pole,mul(axis,dot(pole,axis))));
  return add(a,add(mul(axis,along),mul(bend,off)));
}
