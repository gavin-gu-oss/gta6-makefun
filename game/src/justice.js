import { makeCar } from './world.js';
import { angleDelta, clamp, distance } from './random.js';
import { roadAt, roadRoute, clearSight } from './ai.js';
import { resolveBody, carBounds } from './simulation.js';

export const STATION={x:-84,z:8,name:'Harbor Precinct steps'};
export const HOSPITAL={x:42,z:-34,name:'Solano Community Hospital'};
export function cue(state,name){state.events.push(name);if(state.events.length>32)state.events.shift();}
export function crime(state,type,amount=1) {
  if(state.time<(state.crimeCooldown[type]??-1))return false;
  state.crimeCooldown[type]=state.time+8;state.lastCrime=state.time;state.decayClock=0;
  const before=state.wanted;state.wanted=clamp(state.wanted+amount,0,5);
  if(state.wanted>before)cue(state,'wanted');return true;
}
export function policeSees(state) {
  const p=state.car||state.player;
  return state.world.cars.some(c=>c.police&&c.disabled<=0&&distance(c,p)<65&&clearSight(state.world,c,p))||state.world.peds.some(c=>c.police&&!(c.down>0)&&distance(c,p)<35&&clearSight(state.world,c,p));
}
export function recover(state,kind) {
  const spawn=kind==='BUSTED'?STATION:HOSPITAL;
  state.cash=Math.floor(state.cash*.8);state.wanted=0;state.health=100;state.car=null;state.arrest=0;state.decayClock=0;state.invulnerable=6;
  Object.assign(state.player,spawn,{y:0,vy:0,moving:false});resolveBody(state.world,state.player,.34,.34);
  state.outcome=kind;state.outcomeTime=4;state.stage=0;state.timer=90;state.vaultTime=0;state.retryDelay=7;state.pickupTime=0;
  state.missionRevision++;
  state.camera=null;state.world.cars=state.world.cars.filter(c=>!c.police);state.world.peds=state.world.peds.filter(p=>!p.police);
  if(state.mission===1)state.mission=0;
  const repo=state.world.cars.find(c=>c.id==='repo');if(repo){Object.assign(repo,{x:164,z:58,yaw:Math.PI,damage:0,speed:0});}
  state.notice=kind+'  /  20% cash lost. Your current job can be retried.';state.noticeTime=7;
}
function spawnPolice(state,index) {
  const p=state.car||state.player,x=roadAt(p.x),z=clamp(roadAt(p.z)+(index%2? -42:42),-168,168);
  let serial=index;while(state.world.cars.some(c=>c.id==='police-'+serial))serial++;
  const c=makeCar('police-'+serial,x+2.7,z,0,Math.PI,[.13,.22,.25]);
  Object.assign(c,{police:true,disabled:0,hits:0,nav:[],repath:0,damage:0});
  // Keep each spawn away from another vehicle without using unseeded randomness.
  for(let n=0;n<12&&state.world.cars.some(q=>distance(q,c)<6);n++)c.z=clamp(c.z-7,-165,165);
  state.world.cars.push(c);
}
function pursue(state,c,dt) {
  const p=state.car||state.player;c.disabled=Math.max(0,c.disabled-dt);c.flash=Math.max(0,(c.flash||0)-dt);
  if(c.disabled>0){c.speed=0;return;}
  c.repath-=dt;
  let junction=false;
  while(c.nav?.length&&distance(c,c.nav[0])<1.3){c.nav.shift();junction=true;}
  if(!c.nav?.length||junction&&c.repath<=0){c.nav=roadRoute(c,p);c.repath=2;while(c.nav.length>1&&distance(c,c.nav[0])<1.3)c.nav.shift();}
  const direct=distance(c,p)<14&&clearSight(state.world,c,p),t=direct?p:c.nav[0];
  const yaw=Math.atan2(t.x-c.x,t.z-c.z),turn=angleDelta(c.yaw,yaw);
  const reversing=c.reverseTime>0;
  if(reversing){c.reverseTime-=dt;c.yaw+=(c.reversals%2?1:-1)*dt;}
  else c.yaw+=clamp(turn,-3*dt,3*dt);
  // Brake before junctions so a sharp corner stays inside the street's width.
  const desired=reversing?-4:Math.min(state.car?16+state.wanted*2:10,3+distance(c,t)*.8)*Math.max(.06,Math.cos(turn));
  c.braking=c.speed>desired;c.speed+=clamp(desired-c.speed,-22*dt,7*dt);
  const oldX=c.x,oldZ=c.z;
  c.x+=Math.sin(c.yaw)*c.speed*dt;c.z+=Math.cos(c.yaw)*c.speed*dt;
  const b=carBounds(c);
  if(resolveBody(state.world,c,b.w/2,b.l/2,c))c.speed*=.25;
  const stopped=Math.abs(c.speed)<.5||Math.hypot(c.x-oldX,c.z-oldZ)<dt*.1;
  c.stuckTime=!reversing&&stopped?(c.stuckTime||0)+dt:0;
  if(c.stuckTime>=2){c.stuckTime=0;c.reverseTime=1;c.reversals=(c.reversals||0)+1;c.nav=[];c.repath=0;}
  if(state.car&&distance(c,state.car)<4.5&&state.time>state.nextRam) {
    state.nextRam=state.time+1.5;damage(state,6);state.car.damage=(state.car.damage||0)+5;state.car.speed*=.7;cue(state,'crash');
  }
  if(!state.car&&distance(c,p)<18&&!state.world.peds.some(q=>q.police&&q.carId===c.id)) {
    const officer={x:c.x+2.5,z:c.z,y:0,yaw:0,police:true,carId:c.id,hits:0,color:[.12,.25,.34],skin:[.64,.44,.31]};
    resolveBody(state.world,officer,.34,.34);state.world.peds.push(officer);
  }
}
export function damage(state,amount) {
  if(state.invulnerable>0)return;
  state.health=Math.max(0,state.health-amount);state.lastDamage=state.time;
}
export function updateJustice(state,dt) {
  state.invulnerable=Math.max(0,state.invulnerable-dt);state.outcomeTime=Math.max(0,state.outcomeTime-dt);state.retryDelay=Math.max(0,state.retryDelay-dt);
  if(state.health<=0){recover(state,'WASTED');return;}
  if(state.time-state.lastDamage>7)state.health=Math.min(100,state.health+1.4*dt);
  if(state.wanted>0) {
    if(policeSees(state)){state.lastSeen=state.time;state.decayClock=0;}
    else if(state.time-state.lastCrime>1){state.decayClock+=dt;if(state.decayClock>=25){state.wanted--;state.decayClock=0;}}
  }
  const count=state.wanted===5?3:state.wanted>=3?2:state.wanted?1:0;
  let patrols=state.world.cars.filter(c=>c.police);
  while(patrols.length<count){spawnPolice(state,patrols.length);patrols=state.world.cars.filter(c=>c.police);}
  if(patrols.length>count){const keep=new Set(patrols.slice(0,count));state.world.cars=state.world.cars.filter(c=>!c.police||keep.has(c));state.world.peds=state.world.peds.filter(p=>!p.police||[...keep].some(c=>c.id===p.carId));}
  if(!count){state.arrest=0;return;}
  for(const c of state.world.cars)if(c.police)pursue(state,c,dt);
  let touching=false;
  for(const p of state.world.peds) {
    if(!p.police||p.down>0)continue;
    const target=state.car||state.player,d=distance(p,target);p.moving=!state.car&&d>1;
    if(p.moving){p.yaw=Math.atan2(target.x-p.x,target.z-p.z);p.x+=Math.sin(p.yaw)*3.6*dt;p.z+=Math.cos(p.yaw)*3.6*dt;resolveBody(state.world,p,.3,.3);}
    if(!state.car&&d<1.65&&Math.abs((p.y||0)-state.player.y)<2)touching=true;
  }
  if(!state.car)touching ||=state.world.cars.some(c=>c.police&&c.disabled<=0&&distance(c,state.player)<3.2&&state.player.y<2);
  state.arrest=touching?state.arrest+dt:Math.max(0,state.arrest-dt*2);
  if(state.arrest>=2)recover(state,'BUSTED');
}
