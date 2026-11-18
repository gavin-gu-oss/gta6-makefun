import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,makeCar} from '../game/src/world.js';
import {createState,step,interact,followCamera} from '../game/src/simulation.js';
import * as justice from '../game/src/justice.js';
import {signal,updateTraffic,updatePedestrians} from '../game/src/ai.js';
import {Sound} from '../game/src/audio.js';
import {attack} from '../game/src/combat.js';
import {marker,advanceMission,saveGame,loadSave} from '../game/src/missions.js';

const input=()=>({down:()=>false,yaw:0,pitch:.32,orbitTime:0,jump:false});
const empty=()=>({cars:[],peds:[],colliders:[],buildings:[],signals:[]});
function state(){const s=createState(empty());s.started=true;s.shotReleased=true;return s;}

test('stealing raises one star, repeated crimes cool down, pursuit count scales',()=>{
  const s=state(),c=makeCar('stolen',0,17);s.world.cars.push(c);assert.ok(interact(s));assert.equal(s.wanted,1);
  justice.crime(s,'theft');assert.equal(s.wanted,1);
  step(s,input(),1/60);assert.equal(s.world.cars.filter(c=>c.police).length,1);
  s.wanted=3;step(s,input(),1/60);assert.equal(s.world.cars.filter(c=>c.police).length,2);
  s.wanted=5;step(s,input(),1/60);assert.equal(s.world.cars.filter(c=>c.police).length,3);
});
test('wanted decays only unseen; busted and wasted restore health and deduct 20 percent',()=>{
  const s=state();s.wanted=2;s.lastCrime=-100;s.lastSeen=-100;s.decayClock=24.99;
  justice.updateJustice(s,.02);assert.equal(s.wanted,1);
  s.cash=1000;justice.recover(s,'BUSTED');assert.equal(s.cash,800);assert.equal(s.wanted,0);assert.equal(s.health,100);assert.equal(s.outcome,'BUSTED');
  s.health=0;justice.updateJustice(s,.02);assert.equal(s.cash,640);assert.equal(s.outcome,'WASTED');
});
test('signals alternate and traffic maintains following gap on its lane',()=>{
  assert.equal(signal(0,0,0,'z'),'green');assert.equal(signal(0,0,0,'x'),'red');assert.equal(signal(11,0,0,'z'),'yellow');
  const s=state(),a=makeCar('a',-2.7,-18),b=makeCar('b',-2.7,-12);
  Object.assign(a,{traffic:true,speed:8,cruise:8,next:0,route:[{x:-2.7,z:80}]});s.world.cars.push(a,b);
  updateTraffic(s,.1);assert.ok(a.speed<8);assert.equal(a.x,-2.7);
});
test('combat ray hits nearest target, ammo decreases, police withstand two hits',()=>{
  const s=state();Object.assign(s.player,{x:0,z:0,yaw:0});const p={x:0,z:5,y:0,police:true,hits:0};s.world.peds.push(p);
  for(let n=0;n<2;n++){s.time+=1;attack(s,'shoot',0);assert.equal(p.down||0,0);}
  s.time+=1;attack(s,'shoot',0);assert.ok(p.down>0);assert.equal(s.ammo,21);
  s.time+=1;const q={x:0,z:1,y:0};s.world.peds.push(q);attack(s,'punch',0);assert.ok(q.down>0);assert.equal(s.ammo,21);
});
test('sequential missions run checkpoints, specific repo car, rooftop, vault and final payout once',()=>{
  const s=createState(createWorld(1));s.started=true;s.mission=2;s.car=s.world.cars.find(c=>c.id==='hero');
  for(let n=0;n<5;n++){Object.assign(s.car,marker(s));advanceMission(s,.1);}
  assert.equal(s.mission,3);const repo=s.world.cars.find(c=>c.id==='repo');assert.ok(repo);
  s.car=repo;advanceMission(s,.1);Object.assign(repo,marker(s),{speed:0});advanceMission(s,1.2);assert.equal(s.mission,4);
  s.car=null;Object.assign(s.player,marker(s));advanceMission(s,1.2);assert.equal(s.mission,5);
  s.car=repo;for(let n=0;n<2;n++){Object.assign(repo,marker(s),{speed:0});advanceMission(s,1.2);}
  assert.equal(s.stage,2);advanceMission(s,20.1);assert.equal(s.stage,3);Object.assign(repo,marker(s));advanceMission(s,1.2);
  assert.equal(s.mission,6);assert.equal(s.storyComplete,true);const cash=s.cash;advanceMission(s,100);assert.equal(s.cash,cash);assert.equal(s.ammo,24);assert.equal(s.lastReward,2500);
});
test('checkpoint timeout and damaged repo can retry; save/load retains stage, earnings and ammo',()=>{
  const s=createState(createWorld(1));s.started=true;s.mission=2;s.timer=.01;s.stage=3;advanceMission(s,.02);assert.equal(s.stage,0);assert.equal(s.timer,90);
  s.mission=3;s.stage=1;const repo=s.world.cars.find(c=>c.id==='repo');repo.damage=80;s.car=repo;advanceMission(s,.1);assert.equal(s.stage,0);assert.equal(repo.damage,0);
  s.mission=5;s.stage=3;s.ammo=7;s.earnings=3300;let data;const storage={setItem:(k,v)=>data=v,getItem:()=>data};assert.ok(saveGame(s,storage));
  const loaded=loadSave(storage);assert.equal(loaded.stage,3);assert.equal(loaded.ammo,7);assert.equal(loaded.earnings,3300);
});
test('rooftop stair surface is reachable continuously from the sidewalk',()=>{
  const w=createWorld(1),s=createState(w);s.started=true;assert.ok(w.rooftop);
  const r=w.rooftop;Object.assign(s.player,{x:r.stairX,z:r.stairStart,y:0});const i=input();i.down=(...c)=>c.includes('KeyW');i.yaw=0;
  let highest=0;for(let n=0;n<600;n++){step(s,i,1/60);highest=Math.max(highest,s.player.y);}
  assert.ok(highest>=r.y-.3);
});

test('repo delivery rejects an unrelated car and punch ignores cars',()=>{
  const s=createState(createWorld(1));s.started=true;s.mission=3;s.stage=1;s.car=s.world.cars.find(c=>c.id==='hero');Object.assign(s.car,marker(s));
  advanceMission(s,2);assert.equal(s.mission,3);
  const a=state();Object.assign(a.player,{x:0,z:0,yaw:0});a.world.cars.push(makeCar('shield',0,1));
  const p={x:1.2,z:0};a.world.peds.push(p);attack(a,'punch',0);assert.ok(p.down>0);
});
test('two seconds of police contact causes busted; recovery is immediately saveable',()=>{
  const s=state();s.wanted=1;s.cash=1000;s.world.peds.push({x:0,z:18,y:0,police:true,carId:'police-0',down:0});
  for(let n=0;n<130;n++)step(s,input(),1/60);
  assert.equal(s.outcome,'BUSTED');assert.equal(s.cash,800);assert.equal(s.wanted,0);assert.ok(s.missionRevision>0);
});
test('rooftop follow camera targets above the roof and collisions cause crime and damage',()=>{
  const s=state();s.player.y=6;const camera=followCamera(s,input(),1/60);assert.ok(camera.target[1]>6);
  s.player.y=0;s.car=makeCar('hero',0,0,2,0);s.car.speed=25;s.world.cars.push(s.car,makeCar('traffic',0,3,0,0));
  step(s,input(),1/60);assert.equal(s.wanted,1);assert.ok(s.health<100);assert.ok(s.car.damage>0);
});

test('traffic stops before a red crosswalk and pedestrians wait, cross, flee and separate',()=>{
  const s=state();s.time=13;const c=makeCar('red',-2.7,-22);Object.assign(c,{traffic:true,speed:8,cruise:8,next:0,route:[{x:-2.7,z:70}]});s.world.cars.push(c);
  for(let n=0;n<300;n++)updateTraffic(s,1/60);assert.ok(c.z<-8);assert.ok(c.speed<.3);
  s.world.cars=[];s.time=0;const p={x:8.2,z:-8,speed:1.2,next:0,route:[{x:8.2,z:8}]};s.world.peds.push(p);
  updatePedestrians(s,.1);assert.equal(p.z,-8);s.time=13;updatePedestrians(s,.1);assert.ok(p.z>-8);
  const old=p.x;s.world.cars.push(Object.assign(makeCar('threat',p.x-2,p.z),{speed:12}));updatePedestrians(s,.1);assert.ok(p.x>old);
  s.world.cars=[];const q={...p};s.world.peds.push(q);const before=distance2(p,q);updatePedestrians(s,.1);assert.ok(distance2(p,q)>before);
});
const distance2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

test('sound stays lazy until a gesture, mute and pause silence continuous voices',()=>{
  const original=globalThis.AudioContext;let contexts=0;
  const param=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;}});
  globalThis.AudioContext=class {
    constructor(){contexts++;this.currentTime=0;this.state='running';this.destination={};}
    createGain(){return {gain:param(),connect(){},disconnect(){}};}
    createOscillator(){return {frequency:param(),connect(){},disconnect(){},start(){},stop(){}};}
    resume(){return Promise.resolve();}
  };
  try {
    const sound=new Sound(),s=state();s.car=makeCar('hero',0,0);s.car.speed=20;s.world.cars.push(s.car);
    sound.update(s);assert.equal(contexts,0);sound.resume();assert.equal(contexts,1);sound.update(s);assert.ok(sound.engine.g.gain.value>0);assert.ok(sound.engine.o.frequency.value>38);
    sound.toggle();assert.equal(sound.master.gain.value,0);s.paused=true;sound.update(s);assert.equal(sound.engine.g.gain.value,0);assert.equal(sound.siren.g.gain.value,0);
    sound.toggle();sound.silence();assert.equal(sound.engine.g.gain.value,0);
  } finally {globalThis.AudioContext=original;}
});

test('taking a cruiser transfers control to Rae and spawns an independent pursuit car',()=>{
  const s=state(),c=makeCar('police-0',0,17);c.police=true;s.world.cars.push(c);assert.ok(interact(s));assert.equal(c.police,false);assert.equal(c.cruiser,true);
  step(s,input(),1/60);assert.equal(s.car,c);const pursuit=s.world.cars.filter(q=>q.police);assert.equal(pursuit.length,1);assert.notEqual(pursuit[0],c);
});
