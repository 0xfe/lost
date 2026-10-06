import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, rm, readFile, writeFile, copyFile } from 'node:fs/promises';
import { basename } from 'node:path';

await rm('dist',{recursive:true,force:true});
await mkdir('dist/assets',{recursive:true});
const hash=data=>createHash('sha256').update(data).digest('hex').slice(0,12);
const assetURLs={};
for(const file of ['atlas.png','atlas.json']){
  const data=await readFile(`public/assets/${file}`),name=file.replace('.',`-${hash(data)}.`);
  await copyFile(`public/assets/${file}`,`dist/assets/${name}`); assetURLs[file]=`./assets/${name}`;
}
const audio=JSON.parse(await readFile('assets/audio/clips.json','utf8'));
for(const clip of audio){
  const file=`${clip.id}.wav`,data=await readFile(`assets/audio/clips/${file}`),name=`${clip.id}-${hash(data)}.wav`;
  if(createHash('sha256').update(data).digest('hex')!==clip.sha256)throw Error(`Changed audio clip: ${file}`);
  await copyFile(`assets/audio/clips/${file}`,`dist/assets/${name}`);assetURLs[file]=`./assets/${name}`;
}
const result=await build({entryPoints:['src/main.ts','public/style.css'],bundle:true,format:'esm',target:'es2022',
  outdir:'dist/assets',entryNames:'[name]-[hash]',minify:true,sourcemap:true,metafile:true,
  define:{__ASSET_URLS__:JSON.stringify(assetURLs)}});
let html=await readFile('public/index.html','utf8');
for(const [path,info] of Object.entries(result.metafile.outputs)){
  if(info.entryPoint==='src/main.ts')html=html.replace('./app.js',`./assets/${basename(path)}`);
  if(info.entryPoint==='public/style.css')html=html.replace('./style.css',`./assets/${basename(path)}`);
}
await writeFile('dist/index.html',html);
console.log('Built self-contained static site → dist/');
