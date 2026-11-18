import { makeCar } from './world.js';
import { clamp, distance, angleDelta } from './random.js';
import { roadAt, roadRoute, clearSight } from './ai.js';
import { carBounds, resolveBody } from './simulation.js';

export const STATION={x:-84,z:8,name:'Harbor Precinct steps'};
export const HOSPITAL={x:42,z:-34,name:'Solano Community Hospital'};
export function cue(state,name){state.events.push(name);if(state.events.length>32)state.events.splice(0,state.events.length-32);}
export function crime(state,type,amount=1) {
  if((state.crimeCooldown[type]??-1)>state.time)return false;
  state.crimeCooldown[type]=state.time+8;state.lastCrime=state.time;state.decayClock=0;
  const stars=clamp(state.wanted+amount,0,5);
  if(stars>state.wanted)cue(state,'wanted');state.wanted=stars;
  return true;
}
export function policeSees(state) {
  const target=state.car||state.player;
  const sees=(officer,range)=>distance(officer,target)<range&&clearSight(state.world,officer,target);
  return state.world.cars.some(car=>car.police&&car.disabled<=0&&sees(car,65))||state.world.peds.some(ped=>ped.police&&!(ped.down>0)&&sees(ped,35));
}
export function damage(state,amount) {
  if(state.invulnerable>0)return;
  state.lastDamage=state.time;state.health=Math.max(0,state.health-amount);
}
export function recover(state,kind) {
  state.cash=Math.floor(.8*state.cash);
  Object.assign(state,{car:null,wanted:0,health:100,arrest:0,decayClock:0,invulnerable:6,outcome:kind,outcomeTime:4,stage:0,timer:90,vaultTime:0,retryDelay:7,pickupTime:0,camera:null});
  Object.assign(state.player,kind==='BUSTED'?STATION:HOSPITAL,{y:0,vy:0,moving:false});
  resolveBody(state.world,state.player,.34,.34);
  state.world.cars=state.world.cars.filter(car=>!car.police);state.world.peds=state.world.peds.filter(ped=>!ped.police);
  if(state.mission===1)state.mission=0;
  const repo=state.world.cars.find(car=>car.id==='repo');
  if(repo)Object.assign(repo,{x:164,z:58,yaw:Math.PI,speed:0,damage:0});
  state.missionRevision++;state.notice=`${kind}  /  20% cash lost. Your current job can be retried.`;state.noticeTime=7;
}
function addPatrol(state,index) {
  const target=state.car||state.player;let serial=index;
  while(state.world.cars.some(car=>car.id===`police-${serial}`))serial++;
  const z=clamp(roadAt(target.z)+(index%2?-42:42),-168,168);
  const patrol=makeCar(`police-${serial}`,roadAt(target.x)+2.7,z,0,Math.PI,[.13,.22,.25]);
  Object.assign(patrol,{police:true,hits:0,nav:[],repath:0});
  for(let attempt=0;attempt<12&&state.world.cars.some(car=>distance(patrol,car)<6);attempt++)patrol.z=clamp(patrol.z-7,-165,165);
  state.world.cars.push(patrol);return patrol;
}
function waypoint(state,patrol,dt) {
  patrol.repath=(patrol.repath||0)-dt;let arrived=false;
  while(patrol.nav?.length&&distance(patrol,patrol.nav[0])<1.3){patrol.nav.shift();arrived=true;}
  const target=state.car||state.player;
  if(!patrol.nav?.length||(arrived&&patrol.repath<=0)) {
    patrol.nav=roadRoute(patrol,target);patrol.repath=2;
    while(patrol.nav.length>1&&distance(patrol,patrol.nav[0])<1.3)patrol.nav.shift();
  }
  return distance(patrol,target)<14&&clearSight(state.world,patrol,target)?target:patrol.nav[0];
}
function drivePatrol(state,patrol,dt) {
  patrol.disabled=Math.max(0,(patrol.disabled||0)-dt);patrol.flash=Math.max(0,(patrol.flash||0)-dt);
  if(patrol.disabled>0){patrol.speed=0;return;}
  const goal=waypoint(state,patrol,dt),turn=angleDelta(patrol.yaw,Math.atan2(goal.x-patrol.x,goal.z-patrol.z));
  const backing=patrol.reverseTime>0;
  if(backing){patrol.reverseTime-=dt;patrol.yaw+=dt*(patrol.reversals%2?1:-1);}
  else patrol.yaw+=clamp(turn,-dt*3,dt*3);
  const topSpeed=state.car?16+state.wanted*2:10;
  const desired=backing?-4:Math.min(topSpeed,3+distance(patrol,goal)*.8)*Math.max(.06,Math.cos(turn));
  patrol.braking=patrol.speed>desired;patrol.speed+=clamp(desired-patrol.speed,-dt*22,dt*7);
  const before={x:patrol.x,z:patrol.z};
  patrol.x+=dt*patrol.speed*Math.sin(patrol.yaw);patrol.z+=dt*patrol.speed*Math.cos(patrol.yaw);
  const size=carBounds(patrol);
  if(resolveBody(state.world,patrol,size.w/2,size.l/2,patrol))patrol.speed*=.25;
  const blocked=Math.abs(patrol.speed)<.5||distance(before,patrol)<dt*.1;
  patrol.stuckTime=blocked&&!backing?(patrol.stuckTime||0)+dt:0;
  if(patrol.stuckTime>=2){patrol.stuckTime=0;patrol.reverseTime=1;patrol.reversals=(patrol.reversals||0)+1;patrol.nav=[];patrol.repath=0;}
  if(state.car&&distance(patrol,state.car)<4.5&&state.time>state.nextRam) {
    state.nextRam=state.time+1.5;damage(state,6);state.car.damage=(state.car.damage||0)+5;state.car.speed*=.7;cue(state,'crash');
  }
  if(!state.car&&distance(patrol,state.player)<18&&!state.world.peds.some(ped=>ped.police&&ped.carId===patrol.id)) {
    const officer={x:patrol.x+2.5,z:patrol.z,y:0,yaw:0,police:true,carId:patrol.id,hits:0,color:[.12,.25,.34],skin:[.64,.44,.31]};
    resolveBody(state.world,officer,.34,.34);state.world.peds.push(officer);
  }
}
export function updateJustice(state,dt) {
  for(const field of ['invulnerable','outcomeTime','retryDelay'])state[field]=Math.max(0,state[field]-dt);
  if(state.health<=0){recover(state,'WASTED');return;}
  if(state.time-state.lastDamage>7)state.health=Math.min(100,state.health+dt*1.4);
  if(state.wanted>0) {
    if(policeSees(state)){state.lastSeen=state.time;state.decayClock=0;}
    else if(state.time-state.lastCrime>1) {
      state.decayClock+=dt;if(state.decayClock>=25){state.wanted--;state.decayClock=0;}
    }
  }
  const needed=state.wanted===5?3:state.wanted>=3?2:state.wanted>0?1:0;
  const fleet=state.world.cars.filter(car=>car.police);
  while(fleet.length<needed)fleet.push(addPatrol(state,fleet.length));
  const kept=fleet.slice(0,needed),ids=new Set(kept.map(car=>car.id));
  if(fleet.length>needed) {
    state.world.cars=state.world.cars.filter(car=>!car.police||ids.has(car.id));
    state.world.peds=state.world.peds.filter(ped=>!ped.police||ids.has(ped.carId));
  }
  if(needed===0){state.arrest=0;return;}
  for(const car of kept)drivePatrol(state,car,dt);
  let contact=false;const target=state.car||state.player;
  for(const officer of state.world.peds) {
    if(!officer.police||officer.down>0)continue;
    const range=distance(officer,target);officer.moving=!state.car&&range>1;
    if(officer.moving) {
      officer.yaw=Math.atan2(target.x-officer.x,target.z-officer.z);
      officer.x+=Math.sin(officer.yaw)*dt*3.6;officer.z+=Math.cos(officer.yaw)*dt*3.6;resolveBody(state.world,officer,.3,.3);
    }
    if(!state.car&&range<1.65&&Math.abs((officer.y||0)-state.player.y)<2)contact=true;
  }
  if(!state.car&&state.player.y<2&&kept.some(car=>car.disabled<=0&&distance(car,state.player)<3.2))contact=true;
  state.arrest=contact?state.arrest+dt:Math.max(0,state.arrest-2*dt);
  if(state.arrest>=2)recover(state,'BUSTED');
}
