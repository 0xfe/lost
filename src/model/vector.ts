/** Right-handed model coordinates: X forward, Y lateral, Z up. Angles are radians. */
export type V3 = readonly [number, number, number];
export const add=(a:V3,b:V3):V3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul=(a:V3,s:number):V3=>[a[0]*s,a[1]*s,a[2]*s];
export const dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit=(a:V3):V3=>mul(a,1/(Math.hypot(...a)||1));
export const rotate=(a:V3,h:number):V3=>[a[0]*Math.cos(h)-a[1]*Math.sin(h),a[0]*Math.sin(h)+a[1]*Math.cos(h),a[2]];
export type Transform=(p:V3)=>V3;
export const identity:Transform=p=>p;
