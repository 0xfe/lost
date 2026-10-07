import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

test('credential guard finds removed historical tokens and never prints their values',async t=>{
  const root=await mkdtemp(join(tmpdir(),'lost-credential-check-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const env={...process.env,GIT_AUTHOR_NAME:'Fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'Fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid'};
  const git=(...args:string[])=>execFileSync('git',['-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null',...args],{cwd:root,env,stdio:'pipe'});
  const scan=()=>spawnSync(process.execPath,[resolve('scripts/check-secrets.mjs')],{cwd:root,encoding:'utf8'});
  git('init','-q');await writeFile(join(root,'README.md'),'Fixture');git('add','.');git('commit','-qm','Initial');
  assert.equal(scan().status,0);
  // Synthetic shape only; never use a real credential in a test fixture.
  const value=['pk','A'.repeat(40),'B'.repeat(24)].join('.');
  await writeFile(join(root,'page.html'),`mapToken = '${value}'`);
  let result=scan();assert.equal(result.status,1);assert.match(result.stderr,/Working tree: page.html: Mapbox token/);
  assert.ok(!(result.stdout+result.stderr).includes(value));
  git('add','.');git('commit','-qm','Fixture token');git('rm','page.html');git('commit','-qm','Remove from tip');
  result=scan();assert.equal(result.status,1);assert.match(result.stderr,/History: [a-f0-9]+:page.html: Mapbox token/);
  assert.ok(!(result.stdout+result.stderr).includes(value));
});
