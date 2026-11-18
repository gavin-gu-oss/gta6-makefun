import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,makeCar} from '../game/src/world.js';
import {createState,step,interact,followCamera} from '../game/src/simulation.js';
import {crime,updateJustice,recover,STATION,HOSPITAL} from '../game/src/justice.js';
import {signal,updateTraffic,updatePedestrians} from '../game/src/ai.js';
import {attack} from '../game/src/combat.js';
import {Sound} from '../game/src/audio.js';
import {marker,advanceMission,saveGame,loadSave} from '../game/src/missions.js';

const controls=()=>({yaw:0,pitch:.32,orbitTime:0,jump:false,down:()=>false});
const gap=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function setup(populated=false){const s=createState(populated?createWorld(1):{cars:[],peds:[],buildings:[],colliders:[],signals:[]});s.started=true;s.shotReleased=true;return s;}
function driveTraffic(s,id,x,z){const c=makeCar(id,x,z);Object.assign(c,{traffic:true,next:0,route:[{x,z:80}],cruise:8,speed:8});s.world.cars.push(c);return c;}

test('theft cooldown and star thresholds produce independent pursuit fleets',()=>{
  const s=setup(),ride=makeCar('unowned',0,17);s.world.cars.push(ride);
  assert.equal(interact(s),true);assert.equal(s.wanted,1);
  assert.equal(crime(s,'theft'),false);assert.equal(s.wanted,1);
  for(const [stars,count] of [[1,1],[2,1],[3,2],[4,2],[5,3]]){
    s.wanted=stars;updateJustice(s,1/60);assert.equal(s.world.cars.filter(c=>c.police).length,count);
  }
  s.time=9;crime(s,'theft',9);assert.equal(s.wanted,5);
});

test('unseen wanted decays at 25 seconds while visible suspects retain their stars',()=>{
  const s=setup();s.wanted=2;s.decayClock=24.98;updateJustice(s,.03);assert.equal(s.wanted,1);
  const patrol=s.world.cars.find(c=>c.police);Object.assign(patrol,{x:0,z:30});
  s.decayClock=24.99;updateJustice(s,.1);assert.equal(s.wanted,1);assert.equal(s.decayClock,0);
});

test('busted and wasted cost twenty percent, restore health and reset retry state',()=>{
  const s=setup();s.cash=1000;s.mission=5;s.stage=2;s.health=30;s.wanted=4;
  recover(s,'BUSTED');assert.equal(s.cash,800);assert.equal(s.health,100);assert.equal(s.wanted,0);
  assert.equal(gap(s.player,STATION),0);assert.equal(s.stage,0);assert.equal(s.retryDelay,7);assert.ok(s.missionRevision>0);
  s.health=0;updateJustice(s,.01);assert.equal(s.outcome,'WASTED');assert.equal(s.cash,640);assert.equal(gap(s.player,HOSPITAL),0);
  assert.equal(s.health,100);assert.equal(s.world.cars.filter(c=>c.police).length,0);
});

test('signals gate traffic before the crossing and queues keep their lane',()=>{
  assert.equal(signal(0,0,0,'z'),'green');assert.equal(signal(11,0,0,'z'),'yellow');assert.equal(signal(13,0,0,'z'),'red');assert.equal(signal(0,0,0,'x'),'red');
  const s=setup(),tail=driveTraffic(s,'tail',-2.7,-18);s.world.cars.push(makeCar('ahead',-2.7,-12));
  updateTraffic(s,.1);assert.ok(tail.speed<8);assert.equal(tail.x,-2.7);
  s.world.cars=[];s.time=13;const red=driveTraffic(s,'red',-2.7,-22);
  for(let n=0;n<300;n++)updateTraffic(s,1/60);
  assert.ok(red.z<-8);assert.ok(red.speed<.3);assert.equal(red.x,-2.7);
});

test('pedestrians wait for a crossing phase, flee a fast car and separate',()=>{
  const s=setup(),p={x:8.2,z:-8,speed:1.2,route:[{x:8.2,z:8}],next:0};s.world.peds.push(p);
  updatePedestrians(s,.1);assert.equal(p.z,-8);
  s.time=13;updatePedestrians(s,.1);assert.ok(p.z>-8);
  const before=p.x;s.world.cars.push(Object.assign(makeCar('approach',p.x-2,p.z),{speed:12}));
  updatePedestrians(s,.1);assert.ok(p.x>before);
  s.world.cars=[];const q={...p};s.world.peds.push(q);updatePedestrians(s,.1);assert.ok(gap(p,q)>0);
  s.wanted=3;Object.assign(s.player,{x:p.x-2,z:p.z});const old=p.x;updatePedestrians(s,.1);assert.ok(p.x>old);
});

test('pistol selects the first visible target, consumes ammo and needs three officer hits',()=>{
  const s=setup();Object.assign(s.player,{x:0,z:0,yaw:0});
  const officer={x:0,z:5,y:0,police:true,hits:0},behind={x:0,z:9,y:0};s.world.peds.push(behind,officer);
  for(let shot=0;shot<3;shot++){s.time=shot;assert.equal(attack(s,'shoot',0),true);assert.equal(!!officer.down,shot===2);}
  assert.equal(behind.down,undefined);assert.equal(s.ammo,21);assert.ok(s.tracer);assert.ok(s.wanted>0);
  s.time=4;s.ammo=0;assert.equal(attack(s,'shoot',0),false);assert.equal(s.ammo,0);
});

test('punch ignores vehicles and shots cannot pass through buildings',()=>{
  const s=setup();Object.assign(s.player,{x:0,z:0});s.world.cars.push(makeCar('nearby',0,1));
  const p={x:1.2,z:0};s.world.peds.push(p);assert.equal(attack(s,'punch',0),true);assert.ok(p.down>0);assert.equal(s.ammo,24);
  s.time=1;s.world.cars=[];s.world.peds=[{x:0,z:8}];s.world.buildings.push({x:0,z:4,w:4,l:2,h:8});
  attack(s,'shoot',0);assert.equal(s.world.peds[0].down,undefined);assert.equal(s.ammo,23);
});

test('all five jobs advance sequentially, restock ammo and pay each reward once',()=>{
  const s=setup(true);s.car=s.world.cars.find(c=>c.id==='hero');s.ammo=2;
  for(let n=0;n<2;n++){Object.assign(s.car,marker(s),{speed:0});advanceMission(s,1.2);}
  assert.equal(s.mission,2);assert.equal(s.cash,870);
  for(let n=0;n<5;n++){Object.assign(s.car,marker(s));advanceMission(s,.1);}assert.equal(s.mission,3);
  s.car=s.world.cars.find(c=>c.id==='repo');advanceMission(s,.1);Object.assign(s.car,marker(s),{speed:0});advanceMission(s,1.2);assert.equal(s.mission,4);
  s.car=null;Object.assign(s.player,marker(s));advanceMission(s,1.2);assert.equal(s.mission,5);
  s.car=s.world.cars.find(c=>c.id==='hero');
  for(let n=0;n<2;n++){Object.assign(s.car,marker(s),{speed:0});advanceMission(s,1.2);}assert.equal(s.stage,2);
  advanceMission(s,20.1);assert.equal(s.stage,3);Object.assign(s.car,marker(s));advanceMission(s,1.2);
  assert.equal(s.mission,6);assert.equal(s.earnings,6500);assert.equal(s.cash,6620);assert.equal(s.lastReward,2500);assert.equal(s.ammo,24);assert.equal(s.storyScreen,true);
  advanceMission(s,100);assert.equal(s.cash,6620);
});

test('race and repo failures retry; repo delivery rejects a different vehicle; saves resume stages',()=>{
  const s=setup(true);s.mission=2;s.stage=4;s.timer=.01;advanceMission(s,.02);assert.equal(s.stage,0);assert.equal(s.timer,90);
  const repo=s.world.cars.find(c=>c.id==='repo');s.mission=3;s.stage=1;s.car=s.world.cars.find(c=>c.id==='hero');Object.assign(s.car,marker(s));
  advanceMission(s,2);assert.equal(s.mission,3);repo.damage=80;s.car=repo;advanceMission(s,.1);assert.equal(s.stage,0);assert.equal(repo.damage,0);assert.equal(s.car,null);
  let record;const store={setItem:(key,value)=>{record=value;},getItem:()=>record};
  Object.assign(s,{mission:5,stage:3,ammo:7,earnings:3300});assert.equal(saveGame(s,store),true);
  const restored=loadSave(store);assert.equal(restored.stage,3);assert.equal(restored.ammo,7);assert.equal(restored.earnings,3300);
});

test('rooftop stairs lift the player continuously and the follow camera aims above the roof',()=>{
  const s=setup(true),r=s.world.rooftop,i=controls();Object.assign(s.player,{x:r.stairX,z:r.stairStart,y:0});i.down=(...codes)=>codes.includes('KeyW');
  let peak=0;for(let n=0;n<600;n++){step(s,i,1/60);peak=Math.max(peak,s.player.y);}assert.ok(peak>=r.y-.3);
  s.player.y=6;s.camera=null;assert.ok(followCamera(s,controls(),1/60).target[1]>6);
});

test('two seconds of contact arrests on foot and a driving collision damages and raises wanted',()=>{
  const s=setup();s.wanted=1;s.cash=1000;s.world.peds.push({x:0,z:18,y:0,police:true,carId:'police-0'});
  for(let n=0;n<130;n++)step(s,controls(),1/60);assert.equal(s.outcome,'BUSTED');assert.equal(s.cash,800);assert.ok(s.missionRevision>0);
  const c=setup();c.car=makeCar('hero',0,0,2);c.car.speed=25;c.world.cars.push(c.car,makeCar('traffic',0,3));step(c,controls(),1/60);
  assert.equal(c.wanted,1);assert.ok(c.health<100);assert.ok(c.car.damage>0);
});

test('sound allocates only after a gesture and mute, pause and silence control its voices',()=>{
  const saved=globalThis.AudioContext;let created=0;
  const parameter=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;}});
  globalThis.AudioContext=class {
    constructor(){created++;this.currentTime=0;this.state='running';this.destination={};}
    createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
    createOscillator(){return {frequency:parameter(),connect(){},disconnect(){},start(){},stop(){}};}
    resume(){return Promise.resolve();}
  };
  try {
    const sound=new Sound(),s=setup();s.car=makeCar('hero',0,0);s.car.speed=20;s.world.cars.push(s.car);
    sound.update(s);assert.equal(created,0);sound.resume();assert.equal(created,1);sound.update(s);
    assert.ok(sound.engine.g.gain.value>0);assert.ok(sound.engine.o.frequency.value>38);
    sound.toggle();assert.equal(sound.master.gain.value,0);s.paused=true;sound.update(s);assert.equal(sound.engine.g.gain.value,0);assert.equal(sound.siren.g.gain.value,0);
    sound.toggle();sound.silence();assert.equal(sound.engine.g.gain.value,0);
  } finally {globalThis.AudioContext=saved;}
});

test('a stolen cruiser keeps its lights while a different car handles pursuit',()=>{
  const s=setup(),cruiser=makeCar('police-0',0,17);Object.assign(cruiser,{police:true,disabled:0});s.world.cars.push(cruiser);
  assert.equal(interact(s),true);assert.equal(cruiser.police,false);assert.equal(cruiser.cruiser,true);
  step(s,controls(),1/60);assert.equal(s.car,cruiser);const patrols=s.world.cars.filter(c=>c.police);assert.equal(patrols.length,1);assert.notEqual(patrols[0],cruiser);
});
