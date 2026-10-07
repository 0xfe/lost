// Deliberately report locations/rule names only, never matching credential values.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const rules=[
  ['Mapbox token','[sp]k\\.[A-Za-z0-9_-]{20,}\\.[A-Za-z0-9_-]{10,}'],
  ['GitHub token','(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})'],
  ['AWS access key','(AKIA|ASIA)[A-Z0-9]{16}'],
  ['Private key','-----BEGIN (RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----'],
  ['Google API key','AIza[A-Za-z0-9_-]{35}'],
];
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
let failures=0;
for(const file of new Set(files)){
  if(/^assets\/audio\/source\/.*\.html?$/.test(file)){console.error(`Working tree: ${file}: downloaded source HTML is prohibited`);failures++;}
  let bytes;try{bytes=await readFile(file);}catch(error){if(error.code==='ENOENT')continue;throw error;}
  if(bytes.includes(0))continue;
  const text=bytes.toString('utf8');
  for(const [name,pattern] of rules)if(new RegExp(pattern).test(text)){console.error(`Working tree: ${file}: ${name}`);failures++;}
}
const commits=execFileSync('git',['rev-list','--all'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
for(const [name,pattern] of rules){
  const result=spawnSync('git',['grep','-I','-l','-E','-e',pattern,...commits,'--'],{encoding:'utf8',maxBuffer:16*1024*1024});
  if(result.error)throw result.error;
  if(result.status!==0&&result.status!==1)throw Error('Git history scan failed');
  for(const location of result.stdout.trim().split('\n').filter(Boolean)){console.error(`History: ${location}: ${name}`);failures++;}
}
if(failures){console.error(`${failures} finding(s). Remove credentials from every affected commit before pushing.`);process.exitCode=1;}
else console.log(`Credential-pattern checks passed: ${new Set(files).size} working files and ${commits.length} reachable commits. No matching token values found.`);
