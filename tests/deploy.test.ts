import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

/** Mock the external uploader; exercise the real argument/order/failure shell logic. */
test('deployment requires a destination; dry run cannot upload; failed assets cannot publish HTML',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lost-deploy-')),log=join(dir,'calls');
  try{
    await writeFile(join(dir,'npm'),'#!/bin/sh\nexit 0\n',{mode:0o755});
    await writeFile(join(dir,'gcloud'),'#!/bin/sh\nprintf "%s\\n" "$*" >> "$LOST_DEPLOY_LOG"\nif [ "$LOST_FAIL_ASSETS" = 1 ] && [ "$2" = rsync ]; then exit 7; fi\n',{mode:0o755});
    const run=(args:string[],fail=false)=>spawnSync('bash',[resolve('scripts/deploy.sh'),...args],{encoding:'utf8',env:{...process.env,PATH:`${dir}:${process.env.PATH}`,LOST_DEPLOY_LOG:log,LOST_FAIL_ASSETS:fail?'1':'0'}});
    assert.equal(run([]).status,2);assert.equal(run(['https://example.com']).status,2);
    const dry=run(['--dry-run','gs://lost-check/study']);assert.equal(dry.status,0);assert.match(dry.stdout,/Assets first:/);assert.match(dry.stdout,/HTML last:/);
    await assert.rejects(readFile(log));
    assert.equal(run(['gs://lost-check/study'],true).status,7);
    assert.equal((await readFile(log,'utf8')).trim().split('\n').length,1);
    await writeFile(log,'');assert.equal(run(['gs://lost-check/study']).status,0);
    const calls=(await readFile(log,'utf8')).trim().split('\n');assert.equal(calls.length,2);
    assert.match(calls[0]!,/^storage rsync/);assert.match(calls[0]!,/max-age=31536000,immutable/);
    assert.match(calls[1]!,/^storage cp dist\/index.html/);assert.match(calls[1]!,/max-age=300,must-revalidate/);
    assert.ok(!calls.join('\n').includes('--delete'));
  }finally{await rm(dir,{recursive:true,force:true});}
});
