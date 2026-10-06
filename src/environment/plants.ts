import { hash } from '../math';
import { createMesh, ellipsoid, type Mesh } from '../model/mesh';
import { solid } from '../model/material';
import { unit, cross, sub, type V3 } from '../model/vector';

/** Small rooted leaves and grass blades, baked through the same model pipeline as the rat. */
export function vergeModel(variant:number):Mesh {
  const mesh=createMesh(),random=(n:number)=>hash(variant,n,417);
  if(variant>=6){
    for(let i=0;i<5;i++){
      const radius=.035+random(i+1)*.10;
      const start=mesh.vertices.length,center:V3=[(random(i+8)-.5)*.36,(random(i+19)-.5)*.28,radius*.4];
      ellipsoid(mesh,center,
        [radius,radius*(.55+random(i+25)*.3),radius*.6],{color:[101+random(i+33)*31,99+random(i+34)*25,88+random(i+35)*24],texture:'rubble'},undefined,undefined,8,4);
      for(const v of mesh.vertices.slice(start)){
        const rough=.78+hash(Math.round(v.p[0]*400),Math.round(v.p[1]*400),i+50)*.38;
        v.p=[center[0]+(v.p[0]-center[0])*rough,center[1]+(v.p[1]-center[1])*rough,Math.max(0,center[2]+(v.p[2]-center[2])*rough)];
      }
    }
    return mesh;
  }
  const rosette=variant>=4,count=rosette?9:18;
  for(let leaf=0;leaf<count;leaf++){
    const a=random(leaf+1)*Math.PI*2,length=.14+random(leaf+21)*.26;
    const lateral:V3=[-Math.sin(a),Math.cos(a),0],base=mesh.vertices.length;
    const material=solid(rosette?[57+random(leaf+43)*25,76+random(leaf+44)*31,31]:[70+random(leaf+43)*29,85+random(leaf+44)*27,40]);
    for(let j=0;j<=5;j++){
      const t=j/5,spread=rosette?length*t:length*t*t*.46;
      const center:V3=[Math.cos(a)*spread,Math.sin(a)*spread,rosette?Math.sin(t*Math.PI)*length*.33:length*t*(1-t*.30)];
      const width=rosette?Math.sin(t*Math.PI)*.041:(1-t)*.008;
      const normal=unit(cross(sub([Math.cos(a)*length,Math.sin(a)*length,rosette?0:length],center),lateral));
      for(const sign of [-1,1])mesh.vertices.push({p:[center[0]+lateral[0]*width*sign,center[1]+lateral[1]*width*sign,center[2]],n:normal,u:t,v:(sign+1)/2,material});
      if(j){const k=base+(j-1)*2;mesh.indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
  }
  return mesh;
}
