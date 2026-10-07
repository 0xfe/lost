import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

async function fixture(t:TestContext){
  const root=await mkdtemp(join(tmpdir(),'lost-upload-test-')),bin=join(root,'bin'),log=join(root,'calls');
  t.after(()=>rm(root,{recursive:true,force:true}));await mkdir(bin);
  await copyFile(resolve('upload.sh'),join(root,'upload.sh'));
  await writeFile(join(bin,'npm'),`#!/bin/sh
if [ "$UPLOAD_FAIL" = build ]; then exit 6; fi
mkdir -p dist/assets
printf 'release index' > dist/index.html
printf 'hashed asset' > dist/assets/main-123.js
`,{mode:0o755});
  await writeFile(join(bin,'sleep'),`#!/bin/sh
printf '["sleep","%s"]\\n' "$1" >> "$UPLOAD_LOG"
`,{mode:0o755});
  await writeFile(join(bin,'gcloud'),`#!/usr/bin/env node
const fs=require('fs'),a=process.argv.slice(2),e=process.env;
fs.appendFileSync(e.UPLOAD_LOG,JSON.stringify(a)+'\\n');
if(a[1]==='rsync'){
 if(e.UPLOAD_FAIL==='assets')process.exit(7);
 fs.writeFileSync('dist/index.html','a later local build');
}
if(a[1]==='cp'){
 if(e.UPLOAD_FAIL==='html')process.exit(8);
 if(fs.readFileSync(a[2],'utf8')!=='release index')process.exit(9);
 fs.copyFileSync(a[2],e.UPLOAD_REMOTE);
}
if(a[1]==='cat'){
 if(e.UPLOAD_FAIL==='read')process.exit(10);
 process.stdout.write(e.UPLOAD_FAIL==='changed'?'another published release':fs.readFileSync(e.UPLOAD_REMOTE));
}
`,{mode:0o755});
  const run=(args:string[],fail='')=>spawnSync('bash',[join(root,'upload.sh'),...args],{
    cwd:tmpdir(),encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`,UPLOAD_LOG:log,UPLOAD_REMOTE:join(root,'remote'),UPLOAD_FAIL:fail},
  });
  const calls=async():Promise<string[][]>=>{try{return (await readFile(log,'utf8')).trim().split('\n').filter(Boolean).map(s=>JSON.parse(s));}catch{return [];}};
  const clear=()=>writeFile(log,'');
  return {run,calls,clear};
}

test('Lost upload help and argument errors do not build or contact GCP',async t=>{
  const f=await fixture(t);assert.equal(f.run(['--help'],'build').status,0);
  for(const args of [['prod'],['gs://other/'],['--clean','--clean'],['--dry-run','--dry-run'],['--unknown']])assert.equal(f.run(args,'build').status,2);
  assert.deepEqual(await f.calls(),[]);
});
test('Lost dry run builds and shows /lost commands without cloud calls or cleanup waits',async t=>{
  const f=await fixture(t),result=f.run(['--clean','--dry-run']);assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/gs:\/\/muthanna\.com\/lost\//);assert.match(result.stdout,/sleep 360/);
  assert.match(result.stdout,/no cloud changes made/);assert.deepEqual(await f.calls(),[]);
  assert.equal(f.run(['--dry-run'],'build').status,6);
});
test('Lost uploads an isolated release, assets first and short-cache HTML last',async t=>{
  const f=await fixture(t),result=f.run([]);assert.equal(result.status,0,result.stderr);
  const calls=await f.calls();assert.equal(calls.length,2);
  const [assets,html]=calls as [string[],string[]];
  assert.deepEqual(assets.slice(0,2),['storage','rsync']);assert.equal(assets[3],'gs://muthanna.com/lost/');
  assert.ok(assets.includes('--cache-control=public,max-age=86400,immutable'));
  assert.ok(assets.includes('--checksums-only'));assert.ok(assets.includes('--predefined-acl=publicRead'));
  const exclusion=assets.find(a=>a.startsWith('--exclude='))!;const pattern=new RegExp(exclusion.slice(10));
  assert.ok(pattern.test('index.html'));assert.ok(!pattern.test('assets/main-123.js'));
  assert.deepEqual(html.slice(0,2),['storage','cp']);assert.equal(html[3],'gs://muthanna.com/lost/index.html');
  assert.ok(html.includes('--cache-control=public,max-age=300,must-revalidate'));assert.ok(html.includes('--content-type=text/html'));
  assert.ok(!assets.includes('--delete-unmatched-destination-objects'));
  await assert.rejects(readFile(html[2]!)); // staging removed on exit
});
test('Lost failed build or asset upload cannot publish HTML',async t=>{
  const f=await fixture(t);assert.equal(f.run([],'build').status,6);assert.deepEqual(await f.calls(),[]);
  assert.equal(f.run(['--clean'],'assets').status,7);assert.equal((await f.calls()).length,1);
  await f.clear();assert.equal(f.run(['--clean'],'html').status,8);assert.equal((await f.calls()).length,2);
});
test('Lost cleanup waits for the cache grace period, checks the index and prunes only /lost',async t=>{
  const f=await fixture(t),result=f.run(['--clean']);assert.equal(result.status,0,result.stderr);
  const calls=await f.calls();assert.equal(calls.length,5);
  assert.deepEqual(calls[2],['sleep','360']);assert.deepEqual(calls[3],['storage','cat','gs://muthanna.com/lost/index.html']);
  assert.equal(calls[4]![3],'gs://muthanna.com/lost/');assert.ok(calls[4]!.includes('--delete-unmatched-destination-objects'));
});
test('Lost cleanup stops if the remote index changes or cannot be read',async t=>{
  const f=await fixture(t);
  for(const fail of ['changed','read']){await f.clear();const result=f.run(['--clean'],fail);assert.notEqual(result.status,0);
    assert.ok(!(await f.calls()).flat().includes('--delete-unmatched-destination-objects'));}
});
