// Capture the original server callback through its imported node:http binding.
// No server socket is ever created or bound.
import http from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { Writable } from 'node:stream';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
let handler;
const original=http.createServer;
try {
  http.createServer=callback=>{handler=callback;return {listen(){return this;}};};
  syncBuiltinESMExports();
  await import('../serve.ts');
} finally {http.createServer=original;syncBuiltinESMExports();}
assert.equal(typeof handler,'function');
const modules=readdirSync(new URL('../game/src/',import.meta.url)).filter(name=>name.endsWith('.js')).map(name=>'/src/'+name);
for(const url of ['/',...modules,'/?shot=start&seed=1','/?shot=play&seed=1','/?shot=end&seed=1']) {
  const result=await new Promise((resolve,reject)=>{
    const chunks=[];
    const response=new Writable({write(chunk,encoding,callback){chunks.push(Buffer.from(chunk));callback();}});
    response.writeHead=(status,headers)=>{response.status=status;response.headers=headers;return response;};
    response.on('error',reject);response.on('finish',()=>resolve({status:response.status,headers:response.headers,body:Buffer.concat(chunks).toString()}));
    handler({url},response);
  });
  assert.equal(result.status,200,url);
  assert.match(result.headers['content-type'],url.startsWith('/src/')?/javascript/:/text\/html/);
  if(url.startsWith('/src/'))assert.equal(result.body,readFileSync(new URL('../game'+url,import.meta.url),'utf8'));
  else assert.match(result.body,/Solano Streets/);
  console.log('PASS 200 '+url+' ('+result.headers['content-type']+')');
}
