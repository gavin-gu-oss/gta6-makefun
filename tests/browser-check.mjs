// Installed Chromium, local files, CDP over anonymous pipes: no network listener.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const output=resolve('out/verification');mkdirSync(output,{recursive:true});
const policy='hatch-webgl-all-origins-v1\n';
writeFileSync(resolve(output,'webgl-policy.txt'),policy);
const chrome=spawn('/opt/meta-chromium/chrome',[
  '--hatch-webgl-allowed-domains-file='+resolve(output,'webgl-policy.txt'),
  '--hatch-webgl-allowed-domains-sha256='+createHash('sha256').update(policy).digest('hex'),
  '--headless','--no-sandbox','--disable-dev-shm-usage','--disable-crashpad-for-testing','--disable-breakpad','--disable-crash-reporter','--disable-background-networking','--disable-component-update','--disable-sync','--disable-default-apps','--no-first-run','--metrics-recording-only','--no-proxy-server','--disable-features=MediaRouter','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files','--remote-debugging-pipe','--user-data-dir='+resolve('out/chromium-qa'),'about:blank',
],{stdio:['ignore','ignore','pipe','pipe','pipe']});
let id=0,buffer='',session,exited=false;const pending=new Map(),errors=[],network=[];let stderr='';chrome.stderr.on('data',d=>{stderr+=d.toString();});
for(const n of [3,4])chrome.stdio[n].on('error',()=>{});
chrome.on('exit',(code,signal)=>{exited=true;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Chromium exited '+(signal||code)+' '+stderr.slice(-1600)));}pending.clear();});
function send(method,params={},sid=session){
  return new Promise((resolve,reject)=>{
    const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('CDP timeout '+method+' '+stderr.slice(-1200)));},20000);
    pending.set(key,{resolve,reject,timer});chrome.stdio[3].write(JSON.stringify({id:key,method,params,...(sid?{sessionId:sid}:{})})+'\0');
  });
}
chrome.stdio[4].on('data',data=>{
  buffer+=data.toString();let split;
  while((split=buffer.indexOf('\0'))!==-1){const raw=buffer.slice(0,split);buffer=buffer.slice(split+1);if(!raw)continue;const m=JSON.parse(raw);
    if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.description||a.value).join(' '));
    if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url))network.push(m.params.request.url);
  }
});
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function frames(n=20){await evaluate(`new Promise(resolve=>{let n=${n};function tick(){if(--n<=0)resolve(true);else requestAnimationFrame(tick);}requestAnimationFrame(tick);})`);}
async function navigate(query=''){
  await send('Page.navigate',{url:pathToFileURL(resolve('game/index.html')).href+query});
  await evaluate(`new Promise((resolve,reject)=>{let n=0;const poll=()=>{if(globalThis.solano)return resolve(true);if(++n>500)return reject(Error('Game did not initialize'));setTimeout(poll,20);};poll();})`);
  await frames(12);const s=await evaluate('solano.snapshot()');assert.equal(s.glError,0);assert.equal(await evaluate("document.getElementById('error').hidden"),true);return s;
}
async function key(code,type='keyDown'){await send('Input.dispatchKeyEvent',{type,code,key:code.startsWith('Key')?code.slice(3).toLowerCase():code==='Space'?' ':code,windowsVirtualKeyCode:code==='Space'?32:code==='Escape'?27:code.startsWith('Key')?code.charCodeAt(3):0});}
try {
  await send('Browser.getVersion',{},null);
  const target=await send('Target.createTarget',{url:'about:blank'},null);session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  for(const name of ['start','play','end']){
    const s=await navigate('?shot='+name+'&seed=1');
    assert.equal(s.shot,name);assert.ok(s.traffic>=10);assert.ok(s.pedestrians>=16);
    if(name==='play'){assert.equal(s.wanted,2);assert.equal(s.driving,'hero');assert.equal(await evaluate("document.getElementById('hud').hidden"),false);}
    if(name==='end'){assert.equal(s.mission,2);assert.equal(await evaluate("document.getElementById('complete').hidden"),false);}
    const image=await send('Page.captureScreenshot',{format:'png'});writeFileSync(resolve(output,name+'.png'),Buffer.from(image.data,'base64'));
    console.log('PASS real WebGL '+name+' '+JSON.stringify(s));
  }
  await navigate();await evaluate("document.getElementById('begin').click()");await frames(5);let s=await evaluate('solano.snapshot()');assert.equal(s.started,true);assert.equal(s.driving,null);
  const onFoot={x:s.x,z:s.z};await key('KeyW');await frames(30);await key('KeyW','keyUp');s=await evaluate('solano.snapshot()');assert.ok(Math.hypot(s.x-onFoot.x,s.z-onFoot.z)>.5);console.log('PASS WASD walking');
  // Restart at the hero to test actual DOM/input entry and car physics.
  await key('KeyP');await key('KeyP','keyUp');assert.equal((await evaluate('solano.snapshot()')).paused,true);
  await evaluate("document.getElementById('menu').click();document.getElementById('begin').click()");await key('KeyE');await key('KeyE','keyUp');s=await evaluate('solano.snapshot()');assert.equal(s.driving,'hero');
  const inCar={x:s.x,z:s.z};await key('KeyW');await frames(60);await key('KeyW','keyUp');s=await evaluate('solano.snapshot()');assert.ok(Math.hypot(s.x-inCar.x,s.z-inCar.z)>2);console.log('PASS E entry and W driving');
  await key('Space');await frames(45);await key('Space','keyUp');await key('KeyE');await key('KeyE','keyUp');assert.equal((await evaluate('solano.snapshot()')).driving,null);console.log('PASS handbrake and E exit');
  await key('Space');await key('Space','keyUp');await frames(3);assert.ok((await evaluate('solano.snapshot()')).y>0);console.log('PASS jump');await frames(60);
  await key('KeyP');await key('KeyP','keyUp');const before=(await evaluate('solano.snapshot()')).time;await frames(10);assert.equal((await evaluate('solano.snapshot()')).time,before);await evaluate("document.getElementById('save').click()");assert.match(await evaluate("document.getElementById('save-result').textContent"),/PROGRESS SAVED/);
  await evaluate("document.getElementById('menu').click()");assert.equal(await evaluate("document.getElementById('continue').hidden"),false);await evaluate("document.getElementById('continue').click()");assert.equal((await evaluate('solano.snapshot()')).started,true);console.log('PASS pause, save, and Continue');
  assert.deepEqual(errors,[],'browser console/runtime errors');assert.deepEqual(network,[],'external runtime requests');console.log('PASS zero browser console errors; zero HTTP(S) runtime requests');
  writeFileSync(resolve(output,'browser-report.json'),JSON.stringify({errors,network,passed:true},null,2));
} finally {if(!exited&&session)await send('Browser.close',{},null).catch(()=>{});chrome.kill();}
