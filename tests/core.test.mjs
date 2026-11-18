import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, makeCar } from '../game/src/world.js';
import { mulberry32 } from '../game/src/random.js';
import { createState, interact, step, resolveBody, carBounds } from '../game/src/simulation.js';
import { advanceMission, marker, loadSave, saveGame } from '../game/src/missions.js';
import { stageShot, releaseShot } from '../game/src/shots.js';
import { JOB } from '../game/src/config.js';

const world=createWorld(1);
const input=(...keys)=>({down:(...codes)=>codes.some(c=>keys.includes(c)),yaw:Math.PI,pitch:.32,orbitTime:0,jump:false});
const emptyWorld=()=>({colliders:[],buildings:[],cars:[],peds:[]});

test('mulberry seed is repeatable and distinct',()=>{
  const a=mulberry32(1),b=mulberry32(1),c=mulberry32(2);
  for(let i=0;i<30;i++)assert.equal(a(),b());assert.notEqual(b(),c());
});
test('8 by 8 city has seeded geometry, visible traffic, and sidewalk population',()=>{
  const b=createWorld(1);
  assert.deepEqual(world.buildings,b.buildings);assert.deepEqual(world.cars,b.cars);assert.deepEqual(world.geometry.data,b.geometry.data);
  assert.equal(world.buildings.length,62);assert.equal(world.cars.filter(c=>c.traffic).length,12);assert.equal(world.peds.length,24);
  assert.ok(world.geometry.data.every(Number.isFinite));assert.ok(world.colliders.length>130);
});
test('walking runs, jumps, and cannot pass through a wall',()=>{
  const w=emptyWorld();w.colliders=[{x:0,z:-2,w:20,l:1,y:0,h:10}];const s=createState(w);s.started=true;Object.assign(s.player,{x:0,z:0});
  const i=input('KeyW','ShiftLeft');i.jump=true;step(s,i,1/60);assert.ok(s.player.y>0);
  for(let n=0;n<120;n++)step(s,i,1/60);
  assert.ok(s.player.z>=-1.161);assert.equal(s.player.y,0);
});
test('enter any model, accelerate, brake, reverse, handbrake, and exit',()=>{
  for(const model of [0,1,2]) {
    const city=emptyWorld(),owned=makeCar('hero',0,0,model,Math.PI);city.cars.push(owned);
    const state=createState(city);state.started=true;Object.assign(state.player,{x:2,z:0});
    assert.equal(interact(state),true);assert.equal(state.car,owned);assert.equal(state.wanted,0);
    const tick=(key,frames)=>{for(let n=0;n<frames;n++)step(state,input(key),1/60);};
    tick('KeyW',120);const cruising=owned.speed;assert.ok(cruising>10);
    tick('Space',60);assert.ok(owned.speed<cruising*.25);
    tick('KeyS',120);assert.ok(owned.speed<0);
    owned.speed=0;assert.equal(interact(state),true);assert.equal(state.car,null);
    assert.ok(Math.hypot(state.player.x-owned.x,state.player.z-owned.z)>1.9);
  }
});
test('fast cars collide with walls and other cars',()=>{
  const w=emptyWorld(),c=makeCar('driver',0,0,2,Math.PI);w.cars.push(c);w.colliders=[{x:0,z:-8,w:30,l:1,y:0,h:20}];const s=createState(w);s.started=true;s.car=c;c.speed=43;
  for(let n=0;n<30;n++)step(s,input('KeyW'),1/60);
  assert.ok(c.z>-5.4);assert.ok(c.speed<20);
  const other=makeCar('parked',0,0,0,0);w.cars.push(other);c.x=0;c.z=0;
  const b=carBounds(c);assert.ok(resolveBody(w,c,b.w/2,b.l/2,c));assert.ok(Math.hypot(c.x,c.z)>1);
});
test('blocked door exits use the free side',()=>{
  const w=emptyWorld(),c=makeCar('ride',0,0,0,0);w.cars.push(c);w.colliders.push({x:2.1,z:0,w:1,l:6,y:0,h:5});const s=createState(w);s.started=true;s.car=c;
  assert.ok(interact(s));assert.ok(s.player.x<0);
});
test('traffic and pedestrians actually move',()=>{
  const w=createWorld(1),s=createState(w),car=w.cars.find(c=>c.traffic),p=w.peds[1],before={cx:car.x,cz:car.z,px:p.x,pz:p.z};
  for(let n=0;n<60;n++)step(s,input(),1/60);
  assert.ok(Math.hypot(car.x-before.cx,car.z-before.cz)>.5);assert.ok(Math.hypot(p.x-before.px,p.z-before.pz)>.5);
});
test('mission requires a car and a slow stop, updates marker, and pays once',()=>{
  const state=createState(emptyWorld());state.started=true;Object.assign(state.player,JOB.pickup);
  assert.equal(advanceMission(state,2),null);assert.equal(state.mission,0);
  const car=makeCar('hero',JOB.pickup.x,JOB.pickup.z);state.car=car;car.speed=12;
  advanceMission(state,2);assert.equal(state.mission,0);
  car.speed=0;assert.match(advanceMission(state,1.2),/Package secured/);assert.deepEqual(marker(state),JOB.delivery);
  Object.assign(car,JOB.delivery);assert.match(advanceMission(state,1.2),/COMPLETE/);
  assert.equal(state.cash,870);assert.equal(state.mission,2);assert.deepEqual(marker(state),{x:126,z:42,name:'Coast gate'});
  assert.equal(state.ammo,24);advanceMission(state,10);assert.equal(state.cash,870);
});
test('save round-trip validates corrupted, unavailable, and hostile storage',()=>{
  let record;const storage={getItem:()=>record,setItem:(key,value)=>{record=value;}};
  const state=createState(emptyWorld());Object.assign(state,{cash:870,mission:2,wanted:2,stage:3,ammo:8});
  assert.equal(saveGame(state,storage),true);const restored=loadSave(storage);
  for(const [field,value] of Object.entries({cash:870,mission:2,wanted:2,stage:3,ammo:8}))assert.equal(restored[field],value);
  for(const corrupt of ['broken','{"version":1,"x":null}','{"version":2,"x":0,"z":0,"cash":1,"mission":0,"wanted":0}']){record=corrupt;assert.equal(loadSave(storage),null);}
  const hostile={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};
  assert.equal(loadSave(hostile),null);assert.equal(saveGame(state,hostile),false);
  assert.equal(loadSave(null),null);assert.equal(saveGame(state,null),false);
});
test('pause halts physics and staged views are deterministic and releasable',()=>{
  const s=createState(emptyWorld());s.paused=true;step(s,input(),1);assert.equal(s.time,0);
  for(const name of ['start','play','end']){
    const a=createState(createWorld(1)),b=createState(createWorld(1));stageShot(a,name);stageShot(b,name);assert.deepEqual(a.stageCamera,b.stageCamera);assert.deepEqual(a.player,b.player);
    assert.ok(a.world.cars.filter(c=>c.traffic).length>=10);assert.equal(a.world.peds.length,24);
    if(name==='play'){assert.equal(a.wanted,2);assert.equal(a.car.model,2);assert.ok(a.world.cars.some(c=>c.police));}
    if(name==='end'){assert.equal(a.mission,2);assert.equal(a.cash,870);assert.ok(a.banner>0);}
    releaseShot(a);assert.equal(a.stageCamera,null);assert.equal(a.shotReleased,true);
  }
});

test('menu keyboard navigation and activation retain browser defaults',async()=>{
  const {Input}=await import('../game/src/input.js');
  const original=globalThis.addEventListener,listeners={};
  globalThis.addEventListener=(type,fn)=>{listeners[type]=fn;};
  try {
    const i=new Input({addEventListener(){}},()=>{},()=>{},()=>{});
    for(const code of ['Tab','Space','ArrowDown']){
      let prevented=false;listeners.keydown({code,repeat:false,preventDefault(){prevented=true;}});assert.equal(prevented,false,'menu '+code+' must keep its browser default');
    }
    i.active=true;let prevented=false;listeners.keydown({code:'Space',repeat:false,preventDefault(){prevented=true;}});assert.equal(prevented,true);
  } finally {globalThis.addEventListener=original;}
});
