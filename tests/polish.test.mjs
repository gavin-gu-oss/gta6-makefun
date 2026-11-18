import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,makeCar,carGeometry,personGeometry} from '../game/src/world.js';
import {createState,step,resolveBody,carBounds} from '../game/src/simulation.js';
import {roadRoute} from '../game/src/ai.js';
import {updateJustice} from '../game/src/justice.js';
import {attack} from '../game/src/combat.js';
import {advanceMission,marker,CHECKPOINTS,hasDante} from '../game/src/missions.js';
import {JOB} from '../game/src/config.js';
import {stageShot} from '../game/src/shots.js';
import {Geometry,perspective,lookAt,multiply} from '../game/src/render.js';
import {chase} from './chase-check.mjs';

test('60-second populated pursuit reduces stuck time and recovers obstructed patrols',()=>{
  const result=chase();console.log('CHASE '+JSON.stringify(result));
  assert.equal(result.patrols.length,3);assert.ok(result.stuckPatrolSeconds<15);
  assert.ok(result.patrols.every(p=>p.longest<4.5&&p.reversals>0));
  const s=createState({cars:[],peds:[],colliders:[],buildings:[]});s.started=true;s.wanted=1;
  const c=makeCar('police-0',0,0);Object.assign(c,{police:true,nav:[],repath:0});s.world.cars.push(c);
  // A patrol facing a wall must trigger its reverse and choose another heading.
  s.world.colliders.push({x:0,z:2.7,w:20,l:1,y:0,h:10});s.player.x=0;s.player.z=84;
  for(let n=0;n<180;n++){s.time+=1/60;s.lastCrime=s.time;updateJustice(s,1/60);}
  assert.ok(c.reversals>0);assert.notEqual(c.yaw,0);
});

test('road graph segments stay on streets instead of cutting across blocks',()=>{
  for(const [from,to] of [[{x:2.7,z:17},{x:126,z:-84}],[{x:-84,z:65},{x:42,z:17}]]) {
    const path=roadRoute(from,to);assert.ok(path.length>3);
    for(let n=1;n<path.length;n++) {
      const a=path[n-1],b=path[n];assert.ok(a.x===b.x||a.z===b.z);
      assert.ok((a.x===b.x?a.x:a.z)%42===0);
    }
  }
});

test('Dante occupies the current passenger seat after pickup and leaves on final delivery',()=>{
  const s=createState(createWorld(1));s.started=true;s.mission=5;s.car=s.world.cars.find(c=>c.id==='hero');
  const mesh=()=>{const g=new Geometry();carGeometry(g,s.car,0,0,hasDante(s,s.car));return g;};
  assert.equal(hasDante(s,s.car),false);const before=mesh().data.length;
  Object.assign(s.car,marker(s));advanceMission(s,1.2);assert.equal(s.stage,1);assert.equal(hasDante(s,s.car),true);
  const aboard=mesh();assert.ok(aboard.data.length>before);assert.ok(aboard.data.every(Number.isFinite));
  for(let model=0;model<3;model++){s.car.model=model;assert.ok(mesh().data.every(Number.isFinite));}
  s.car.model=2;s.stage=3;Object.assign(s.car,marker(s));advanceMission(s,1.2);
  assert.equal(s.mission,6);assert.equal(hasDante(s,s.car),false);assert.equal(mesh().data.length,before);
});

test('aiming the horizontal pistol at a nearby real pedestrian registers a hit',()=>{
  const s=createState(createWorld(1));s.started=true;const p=s.world.peds[0];
  Object.assign(s.player,{x:p.x,z:p.z-4,y:0});
  assert.equal(attack(s,'shoot',Math.atan2(p.x-s.player.x,p.z-s.player.z)),true);
  assert.ok(p.down>0);assert.equal(s.ammo,23);assert.ok(s.wanted>0);
});

test('M2 street route fits 90 seconds at even the slowest normal traffic cruise',()=>{
  const s=createState(createWorld(1));s.started=true;s.mission=2;s.car=s.world.cars.find(c=>c.id==='hero');
  Object.assign(s.car,JOB.delivery);let previous=JOB.delivery,distance=0,ticks=0;
  const speed=6,dt=1/60;
  for(const target of CHECKPOINTS) {
    distance+=Math.abs(target.x-previous.x)+Math.abs(target.z-previous.z);previous=target;
    while(Math.hypot(target.x-s.car.x,target.z-s.car.z)>.001&&s.mission===2) {
      const dx=target.x-s.car.x,dz=target.z-s.car.z,d=Math.hypot(dx,dz),travel=Math.min(d,speed*dt);
      s.car.yaw=Math.atan2(dx,dz);s.car.speed=speed;s.car.x+=dx/d*travel;s.car.z+=dz/d*travel;
      const before={x:s.car.x,z:s.car.z},b=carBounds(s.car);resolveBody(s.world,s.car,b.w/2,b.l/2,s.car);
      assert.ok(Math.hypot(before.x-s.car.x,before.z-s.car.z)<.001,'route is clear of static cars and scenery');
      advanceMission(s,dt);assert.ok(++ticks<5400);
    }
  }
  assert.equal(s.mission,3);assert.equal(distance,504);assert.ok(distance/speed<90);
  console.log('M2 distance='+distance+' m; at 6 m/s: '+distance/speed+' s, margin '+(90-distance/speed)+' s; at mean 7.8 m/s: '+(distance/7.8).toFixed(2)+' s, margin '+(90-distance/7.8).toFixed(2)+' s (stops excluded).');
});

test('M4 has a continuous on-foot route from salvage through stairs and landing to the parcel',()=>{
  const s=createState(createWorld(1));s.started=true;Object.assign(s.player,{x:-126,z:42});
  const r=s.world.rooftop,route=[{x:-42,z:42},{x:-42,z:-42},{x:r.stairX,z:-42},{x:r.stairX,z:r.stairStart},{x:r.stairX,z:r.stairEnd},{x:r.x,z:r.stairEnd},{x:r.x,z:r.z}];
  const i={yaw:0,pitch:.32,orbitTime:0,jump:false,down:(...keys)=>keys.includes('KeyW')};let ticks=0;
  // Isolate traversal/mission constraints from combat; wanted is applied at the parcel.
  for(const t of route)while(Math.hypot(t.x-s.player.x,t.z-s.player.z)>.08) {
    i.yaw=Math.atan2(t.x-s.player.x,t.z-s.player.z);step(s,i,1/60);assert.ok(++ticks<9000,'route must remain walkable');
  }
  assert.ok(Math.abs(s.player.y-r.y)<.1);s.mission=4;advanceMission(s,1.2);
  assert.equal(s.mission,5);assert.equal(s.wanted,2);
  console.log('M4 physical walking route: '+(ticks/60).toFixed(2)+' s at 3.4 m/s; no mission deadline. Enemy survival is not simulated by this route test.');
});

test('M5 vault waits only in range and advances after 20 seconds of fixed ticks',()=>{
  const s=createState(createWorld(1));s.started=true;s.mission=5;s.stage=2;s.car=s.world.cars.find(c=>c.id==='hero');
  advanceMission(s,30);assert.equal(s.vaultTime,0);Object.assign(s.car,marker(s),{speed:0});
  for(let n=0;n<1199;n++)advanceMission(s,1/60);assert.equal(s.stage,2);
  for(let n=0;n<2;n++)advanceMission(s,1/60);assert.equal(s.stage,3);assert.equal(s.wanted,3);
});

test('shot subjects and their full meshes project inside the viewport with a five-percent margin',()=>{
  for(const [width,height] of [[1280,720],[1440,900]])for(const shot of ['start','play','end']) {
    const s=createState(createWorld(1));stageShot(s,shot);const c=s.stageCamera;
    const m=multiply(perspective(c.fov,width/height,.15,1100),lookAt(c.eye,c.target));
    const project=(x,y,z)=>{
      const w=m[3]*x+m[7]*y+m[11]*z+m[15];assert.ok(w>.15,'subject in front of near plane');
      return {x:((m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5)*width,y:(.5-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*.5)*height};
    };
    const hero=s.world.cars.find(c=>c.id==='hero');
    const subjects=shot==='play'?[['player car',hero],['nearest police',s.world.cars.filter(c=>c.police).sort((a,b)=>Math.hypot(a.x-hero.x,a.z-hero.z)-Math.hypot(b.x-hero.x,b.z-hero.z))[0]]]:[[shot==='start'?'hero car':'delivery car',hero],['Rae',s.player]];
    for(const [name,p] of subjects) {
      const g=new Geometry();if(p.model===undefined)personGeometry(g,p,0,true);else carGeometry(g,p);
      for(let n=0;n<g.data.length;n+=12){const q=project(...g.data.slice(n,n+3));assert.ok(q.x>width*.05&&q.x<width*.95&&q.y>height*.05&&q.y<height*.95,shot+' '+name+' has viewport margin');}
      const q=project(p.x,p.model===undefined?.95:.85,p.z);console.log('SHOT '+width+'x'+height+' '+shot+' '+name+': ('+q.x.toFixed(2)+', '+q.y.toFixed(2)+')');
    }
  }
});
