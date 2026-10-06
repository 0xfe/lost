import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import type { Atlas } from '../src/assets';

test('every generated direction/pose is complete, transparent at its edges, and inside the budget',async()=>{
  const atlas=JSON.parse(await readFile('public/assets/atlas.json','utf8')) as Atlas;
  const {data,info}=await sharp('public/assets/atlas.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(info.width,atlas.width);assert.equal(info.height,atlas.height);
  assert.ok(data.length<=16*1048576);assert.equal(atlas.rat.length,8);
  for(const row of atlas.rat){assert.equal(row.length,4);for(const frame of row){
    let solid=0;
    for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++){
      const alpha=data[((frame.y+y)*info.width+frame.x+x)*4+3]!;
      if(alpha>48){solid++;assert.ok(x>1&&x<frame.width-2&&y>1&&y<frame.height-2,'Artwork must not touch crop edges');}
    }
    assert.ok(solid>1200,'A clipped/empty pose must fail the asset check');
  }}
});
