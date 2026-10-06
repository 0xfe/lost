import type { Pose } from './types';
import { createMesh, type Mesh } from '../model/mesh';
import type { V3 } from '../model/vector';
import { buildBody } from './body';
import { buildHead } from './head';
import { buildLimbs, type Limb } from './limbs';
import { buildTail } from './tail';

export interface Rig { mesh:Mesh; joints:Limb[]; nose:V3; ears:V3[]; spine:V3[] }
/** Pure pose evaluation: anatomy is assembled in a stable order into the shared mesh format. */
export function ratModel(p:Pose):Rig {
  const mesh=createMesh();
  const body=buildBody(mesh,p);
  const {nose,ears}=buildHead(mesh,p,body);
  const joints=buildLimbs(mesh,p,body);
  buildTail(mesh,p,body);
  return {mesh,joints,nose,ears,spine:body.sections.map(s=>body.world([s.x,s.y,s.z+s.rz]))};
}
