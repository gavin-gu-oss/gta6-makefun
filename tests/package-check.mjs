import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
function files(dir,prefix='') {
  return readdirSync(dir).sort().flatMap(name=>{
    const full=join(dir,name),path=prefix+name,stats=statSync(full);
    return stats.isDirectory()?files(full,path+'/'):[{path,bytes:stats.size,sha256:createHash('sha256').update(readFileSync(full)).digest('hex')}];
  });
}
const game=files(join(root,'game'));
assert.ok(game.length<993);
assert.ok(game.reduce((sum,f)=>sum+f.bytes,0)<50331648);
assert.ok(statSync(join(root,'game/index.html')).size<1048576);
for(const file of game){
  const text=readFileSync(join(root,'game',file.path),'utf8');
  assert.doesNotMatch(text,/https?:\/\/|fetch\s*\(|XMLHttpRequest|Math\.random/,file.path+' runtime independence');
}
console.log('PASS no external URLs, request APIs, or Math.random in game/');
const build=()=>execFileSync(process.execPath,['main.ts'],{cwd:root,env:{...process.env,MAKEFUN_OUTPUT_DIR:'out'},stdio:'inherit'});
const output=()=>[...files(join(root,'out/game'),'game/'),...files(join(root,'out/screenshots'),'screenshots/'),{path:'dossier.json',sha256:createHash('sha256').update(readFileSync(join(root,'out/dossier.json'))).digest('hex')}];
build();const first=output();build();assert.deepEqual(output(),first);
assert.ok(statSync(join(root,'out/game')).isDirectory());
assert.ok(statSync(join(root,'out/dossier.json')).size<1572864);
console.log('PASS repeat builds are byte-identical ('+first.length+' package files)');
console.log('dossier.json: '+statSync(join(root,'out/dossier.json')).size+' bytes');
console.log('game/: '+game.length+' files / '+game.reduce((sum,f)=>sum+f.bytes,0)+' bytes');
for(const file of game)console.log('  game/'+file.path+'  '+file.bytes);
const extra=['main.ts','README.md','.gitignore','.makefun/owner.json','docs/core-plan.md','tests/core.test.mjs','tests/serve-check.mjs','tests/browser-check.mjs','tests/package-check.mjs'];
for(const file of extra)console.log('  '+file+'  '+statSync(join(root,file)).size);
