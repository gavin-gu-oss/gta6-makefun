import { MODELS } from './config.js';
import { clamp, angleDelta, distance } from './random.js';
import { advanceMission } from './missions.js';
import { updateTraffic, updatePedestrians } from './ai.js';
import { crime, updateJustice, damage, cue } from './justice.js';
import { attack } from './combat.js';

export function createState(world) {
  return {
    world,player:{x:0,z:17,y:0,yaw:Math.PI,vy:0,moving:false},car:null,
    time:0,started:false,paused:false,shot:null,shotReleased:false,camera:null,notice:'',noticeTime:0,
    cash:120,earnings:0,health:100,ammo:24,wanted:0,
    crimeCooldown:{},lastCrime:-100,lastSeen:-100,lastDamage:-100,decayClock:0,
    arrest:0,nextRam:0,invulnerable:0,outcome:'',outcomeTime:0,nextAttack:0,
    mission:0,stage:0,timer:90,vaultTime:0,retryDelay:0,pickupTime:0,missionRevision:0,
    banner:0,lastMission:'First Pickup',lastReward:750,dialogue:[],dialogueTime:0,
    storyComplete:false,storyScreen:false,events:[],
  };
}
export function carBounds(car) {
  const m=MODELS[car.model],s=Math.abs(Math.sin(car.yaw)),c=Math.abs(Math.cos(car.yaw));
  return {x:car.x,z:car.z,w:c*m.width+s*m.length,l:s*m.width+c*m.length,y:0,h:1.6};
}
export function pushOut(body,hw,hl,obstacle) {
  if((body.y||0)>obstacle.y+obstacle.h)return false;
  const dx=body.x-obstacle.x,dz=body.z-obstacle.z,px=hw+obstacle.w/2-Math.abs(dx),pz=hl+obstacle.l/2-Math.abs(dz);
  if(px<=0||pz<=0)return false;
  if(px<pz)body.x+=(dx>=0?1:-1)*(px+.002);else body.z+=(dz>=0?1:-1)*(pz+.002);
  return true;
}
function bounds(p) {
  p.z=clamp(p.z,-174,174);
  // The pier is accessible on foot. Elsewhere the shore is the map boundary.
  p.x=clamp(p.x,-174,Math.abs(p.z-84)<3.6?282:199);
}
export function resolveBody(world,body,hw,hl,ignoreCar=null) {
  let hit=false;
  for(let pass=0;pass<2;pass++) {
    for(const obstacle of world.colliders)if(pushOut(body,hw,hl,obstacle))hit=true;
    for(const other of world.cars)if(other!==ignoreCar&&pushOut(body,hw,hl,carBounds(other)))hit=true;
  }
  bounds(body);return hit;
}
export function notify(state,text,seconds=5){state.notice=text;state.noticeTime=seconds;}
export function interact(state) {
  if(!state.started||state.paused)return false;
  if(state.car) {
    const car=state.car;if(Math.abs(car.speed)>5){notify(state,'Slow down before stepping out.');return false;}
    const a=car.yaw,c=Math.cos(a),s=Math.sin(a),p=state.player;
    // Try both doors and the rear, so a wall never traps Rae.
    for(const [side,back] of [[1,0],[-1,0],[0,-1]]) {
      const candidate={x:car.x+c*side*2.1-s*back*3.5,z:car.z-s*side*2.1-c*back*3.5,y:0};
      const old={...candidate};resolveBody(state.world,candidate,.34,.34,car);
      if(distance(old,candidate)<.25){Object.assign(p,candidate,{yaw:a,vy:0});state.car=null;car.speed=0;return true;}
    }
    notify(state,'The doors are blocked. Move to an open space.');return false;
  }
  let nearest=null,d=4;
  for(const car of state.world.cars){const n=distance(state.player,car);if(n<d&&Math.abs(car.speed)<12){d=n;nearest=car;}}
  if(nearest){
    const stolen=nearest.id!=='hero'&&!nearest.owned;
    if(stolen){nearest.owned=true;crime(state,'theft');}
    // A cruiser keeps its livery but gives up pursuit ownership on takeover.
    if(nearest.police)Object.assign(nearest,{police:false,cruiser:true,disabled:0});
    Object.assign(nearest,{traffic:false,speed:0});state.car=nearest;state.player.y=0;
    notify(state,`${MODELS[nearest.model].name}  ·  W/S drive  ·  Space handbrake`,3);return true;
  }
  notify(state,'Get closer to a car, then press E.');return false;
}
export function groundAt(world,p) {
  const roof=world.rooftop;if(!roof)return 0;
  const onStairs=Math.abs(p.x-roof.stairX)<1.6&&p.z>=roof.stairStart-1&&p.z<=roof.stairEnd;
  if(onStairs) {
    const progress=clamp((p.z-roof.stairStart)/(roof.stairEnd-roof.stairStart),0,1);
    return progress*roof.y;
  }
  if(p.y<roof.y-.6)return 0;
  const onRoof=Math.abs(p.x-roof.x)<roof.w/2+.2&&Math.abs(p.z-roof.z)<roof.l/2+.2;
  const onLanding=p.x>=roof.x&&p.x<=roof.stairX+1.5&&Math.abs(p.z-roof.stairEnd)<2;
  return onRoof||onLanding?roof.y:0;
}
function vehicleImpact(state,car,impact,struck) {
  car.speed*=-.18;
  if(impact<=3)return;
  damage(state,impact*.65);car.damage=(car.damage||0)+impact*.9;car.flash=.15;cue(state,'crash');
  if(struck)crime(state,'vehicle');
  if(impact>9)notify(state,'Easy, Vega. This ride still has to get you home.',2);
}
function hitPedestrians(state,car) {
  if(Math.abs(car.speed)<=3)return;
  for(const person of state.world.peds) {
    if(person.down>0||distance(car,person)>=1.7)continue;
    person.down=9;person.flash=.2;car.damage=(car.damage||0)+3;
    damage(state,2);crime(state,'pedestrian');cue(state,'crash');
  }
}
function onFootActions(state,input) {
  const player=state.player;
  if(input.punch)attack(state,'punch',input.yaw);
  if(input.fire)attack(state,'shoot',input.yaw);
  for(const vehicle of state.world.cars) {
    if(Math.abs(vehicle.speed)<=6||distance(vehicle,player)>=1.8||player.y>=1.5||state.time<=state.nextRam)continue;
    state.nextRam=state.time+1;damage(state,Math.abs(vehicle.speed)*1.6);
    player.x+=Math.cos(vehicle.yaw)*2;player.z-=Math.sin(vehicle.yaw)*2;
    resolveBody(state.world,player,.34,.34);cue(state,'crash');
  }
}
export function step(state,input,dt) {
  if(state.paused)return;
  state.time+=dt;state.banner=Math.max(0,state.banner-dt);state.noticeTime=Math.max(0,state.noticeTime-dt);
  input.orbitTime=Math.max(0,input.orbitTime-dt);
  const staged=state.shot&&!state.shotReleased;
  if(!staged){updateTraffic(state,dt);updatePedestrians(state,dt);}
  if(!state.started)return;
  if(staged)return;
  const car=state.car,p=state.player;
  state.dialogueTime=Math.max(0,state.dialogueTime-dt);
  if(state.tracer&&(state.tracer.time-=dt)<=0)state.tracer=null;
  for(const vehicle of state.world.cars)vehicle.flash=Math.max(0,(vehicle.flash||0)-dt);
  if(car) {
    const m=MODELS[car.model],throttle=(input.down('KeyW','ArrowUp')?1:0)-(input.down('KeyS','ArrowDown')?1:0);
    const brake=input.down('Space'),steer=(input.down('KeyA','ArrowLeft')?1:0)-(input.down('KeyD','ArrowRight')?1:0);
    car.braking=!!brake||throttle*car.speed<0;
    car.speed+=throttle*m.accel*dt*(throttle*car.speed<0?2.5:1);
    car.speed*=Math.exp(-(brake?3.3:throttle?0.18:0.85)*dt);car.speed=clamp(car.speed,-10,m.max);
    if(Math.abs(car.speed)<.07)car.speed=0;
    const turn=(1.6/(1+Math.abs(car.speed)*.055))*(brake?1.5:1);
    car.yaw+=steer*turn*clamp(car.speed/5,-1,1)*dt;
    const parts=Math.max(1,Math.ceil(Math.abs(car.speed)*dt/.45));
    for(let i=0;i<parts;i++) {
      car.x+=Math.sin(car.yaw)*car.speed*dt/parts;car.z+=Math.cos(car.yaw)*car.speed*dt/parts;
      hitPedestrians(state,car);
      const struck=state.world.cars.find(q=>q!==car&&distance(car,q)<3.8);
      const b=carBounds(car);
      if(resolveBody(state.world,car,b.w/2,b.l/2,car)){vehicleImpact(state,car,Math.abs(car.speed),struck);break;}
    }
    p.x=car.x;p.z=car.z;p.yaw=car.yaw;p.moving=false;
    if(input.orbitTime===0)input.yaw+=angleDelta(input.yaw,car.yaw)*Math.min(1,dt*3);
  } else {
    let forward=(input.down('KeyW','ArrowUp')?1:0)-(input.down('KeyS','ArrowDown')?1:0),right=(input.down('KeyD','ArrowRight')?1:0)-(input.down('KeyA','ArrowLeft')?1:0);
    const len=Math.hypot(forward,right),speed=input.down('ShiftLeft','ShiftRight')?7.2:3.4;
    p.moving=len>0;
    if(len) {
      forward/=len;right/=len;const dx=Math.sin(input.yaw)*forward-Math.cos(input.yaw)*right,dz=Math.cos(input.yaw)*forward+Math.sin(input.yaw)*right;
      p.x+=dx*speed*dt;p.z+=dz*speed*dt;p.yaw+=angleDelta(p.yaw,Math.atan2(dx,dz))*Math.min(1,dt*14);
      resolveBody(state.world,p,.34,.34);
    }
    const floor=groundAt(state.world,p);
    if(input.jump&&p.y<=floor+.12)p.vy=6.4;
    p.vy-=16*dt;p.y=Math.max(floor,p.y+p.vy*dt);if(p.y===floor)p.vy=0;
    onFootActions(state,input);
  }
  for(const action of ['jump','punch','fire'])input[action]=false;
  const message=advanceMission(state,dt);
  if(message)notify(state,message,6);
  updateJustice(state,dt);
}
export function followCamera(state,input,dt) {
  const p=state.car||state.player,d=state.car?9.7:6.8,pitch=input.pitch;
  const height=state.car?0:state.player.y;
  const target=[p.x,height+1.25,p.z];
  let eye=[p.x-Math.sin(input.yaw)*d, target[1]+2+pitch*6,p.z-Math.cos(input.yaw)*d];
  // Shorten the camera ray before it enters a building; keep walls out of the view.
  for(let f=.08;f<1;f+=.06) {
    const q=target.map((v,i)=>v+(eye[i]-v)*f);
    if(state.world.buildings.some(b=>Math.abs(q[0]-b.x)<b.w/2+.5&&Math.abs(q[2]-b.z)<b.l/2+.5&&q[1]<b.h+.8)){eye=target.map((v,i)=>v+(eye[i]-v)*Math.max(.15,f-.08));break;}
  }
  if(!state.camera)state.camera={eye,target};
  const t=1-Math.exp(-dt*9);
  state.camera.eye=state.camera.eye.map((v,i)=>v+(eye[i]-v)*t);state.camera.target=target;
  return state.camera;
}
