import { BLOCK, MIN, MAX } from './config.js';
import { clamp, distance } from './random.js';

export function roadAt(value){return clamp(Math.round((value-MIN)/BLOCK)*BLOCK+MIN,MIN,MAX);}
function streetPoint(p) {
  const x=roadAt(p.x),z=roadAt(p.z);
  return Math.abs(p.x-x)<Math.abs(p.z-z)?{x,z:p.z}:{x:p.x,z};
}
export function roadRoute(from,to) {
  const entry=streetPoint(from),exit=streetPoint(to);
  const first={x:roadAt(entry.x),z:roadAt(entry.z)},last={x:roadAt(exit.x),z:roadAt(exit.z)};
  const key=p=>`${p.x}:${p.z}`,frontier=[first],parent=new Map([[key(first),null]]);
  for(let head=0;head<frontier.length&&!parent.has(key(last));head++) {
    const current=frontier[head];
    const adjacent=[[BLOCK,0],[-BLOCK,0],[0,BLOCK],[0,-BLOCK]].map(([dx,dz])=>({x:current.x+dx,z:current.z+dz}));
    adjacent.sort((a,b)=>distance(a,last)-distance(b,last));
    for(const point of adjacent) {
      if(point.x<MIN||point.x>MAX||point.z<MIN||point.z>MAX||parent.has(key(point)))continue;
      parent.set(key(point),current);frontier.push(point);
    }
  }
  const junctions=[];let cursor=last;
  while(cursor){junctions.push(cursor);cursor=parent.get(key(cursor));}
  const route=[entry,...junctions.reverse(),exit];
  return route.filter((point,index)=>index===0||distance(point,route[index-1])>.1);
}
export function signal(time,x,z,axis) {
  const offset=3*Math.round((x+z)/BLOCK)+(axis==='x'?12:0);
  const phase=((time+offset)%24+24)%24;
  if(phase>=12)return 'red';
  return phase>=10?'yellow':'green';
}
export function clearSight(world,a,b) {
  const samples=Math.ceil(distance(a,b)/3);
  for(let sample=1;sample<samples;sample++) {
    const t=sample/samples,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
    if(world.buildings.some(box=>Math.abs(x-box.x)<box.w*.5&&Math.abs(z-box.z)<box.l*.5&&(a.y||0)<box.h))return false;
  }
  return true;
}
function trafficSpeed(state,car,sx,sz,axis) {
  let limit=car.cruise;
  for(const obstacle of state.world.cars) {
    if(obstacle===car)continue;
    const dx=obstacle.x-car.x,dz=obstacle.z-car.z,ahead=dx*sx+dz*sz;
    if(ahead>0&&ahead<6+car.speed*1.3&&Math.abs(dx*sz-dz*sx)<2.2)limit=Math.min(limit,Math.max(0,.8*(ahead-5)));
  }
  for(let junction=MIN;junction<=MAX;junction+=BLOCK) {
    const along=axis==='x'?(junction-car.x)*Math.sign(sx):(junction-car.z)*Math.sign(sz);
    if(along<=7||along>=23)continue;
    const x=axis==='x'?junction:roadAt(car.x),z=axis==='z'?junction:roadAt(car.z);
    if(signal(state.time,x,z,axis)!=='green')limit=Math.min(limit,Math.max(0,(along-9)*1.1));
    else if(along<15)limit=Math.min(limit,4.5);
  }
  return limit;
}
export function updateTraffic(state,dt) {
  for(const car of state.world.cars) {
    if(!car.traffic||car===state.car||!car.route?.length)continue;
    const destination=car.route[car.next],dx=destination.x-car.x,dz=destination.z-car.z,length=Math.hypot(dx,dz);
    if(length<.25){Object.assign(car,destination);car.next=(car.next+1)%car.route.length;continue;}
    const sx=dx/length,sz=dz/length,desired=trafficSpeed(state,car,sx,sz,Math.abs(dx)>Math.abs(dz)?'x':'z');
    car.yaw=Math.atan2(dx,dz);
    const previous=car.speed;car.speed+=clamp(desired-previous,-14*dt,3*dt);
    car.braking=car.speed<previous-.01||desired<.5;
    const advance=Math.min(length,car.speed*dt);car.x+=sx*advance;car.z+=sz*advance;
  }
}
function walkingVelocity(state,ped) {
  const hero=state.car||state.player;
  const vehicle=state.world.cars.find(car=>Math.abs(car.speed)>7&&distance(car,ped)<9);
  const alarm=state.started&&state.wanted>=3&&distance(hero,ped)<35;
  if(vehicle||alarm) {
    const threat=vehicle||hero,length=distance(ped,threat)||1;
    return [(ped.x-threat.x)*3.8/length,(ped.z-threat.z)*3.8/length];
  }
  if(!ped.route?.length)return [0,0];
  const target=ped.route[ped.next],length=distance(ped,target);
  if(length<.3){ped.next=(ped.next+1)%ped.route.length;return [0,0];}
  const dx=(target.x-ped.x)*ped.speed/length,dz=(target.z-ped.z)*ped.speed/length;
  const axis=Math.abs(dx)>Math.abs(dz)?'x':'z',position=axis==='x'?ped.x:ped.z;
  const crossing=(roadAt(position)-position)*Math.sign(axis==='x'?dx:dz);
  const waiting=crossing>6&&crossing<10&&signal(state.time,roadAt(ped.x),roadAt(ped.z),axis)!=='red';
  if(waiting||state.world.cars.some(car=>Math.abs(car.speed)>2&&distance(car,ped)<6))return [0,0];
  return [dx,dz];
}
export function updatePedestrians(state,dt) {
  for(const ped of state.world.peds) {
    ped.flash=Math.max(0,(ped.flash||0)-dt);
    if(ped.down>0){ped.down=Math.max(0,ped.down-dt);ped.moving=false;continue;}
    if(ped.police)continue;
    let [vx,vz]=walkingVelocity(state,ped);
    for(const neighbor of state.world.peds) {
      if(neighbor===ped||neighbor.down>0)continue;
      const length=distance(ped,neighbor);if(length>=.85)continue;
      const force=(.85-length)*3;
      vx+=force*(length>.01?(ped.x-neighbor.x)/length:1);
      vz+=force*(length>.01?(ped.z-neighbor.z)/length:0);
    }
    const x=clamp(ped.x+vx*dt,-172,194),z=clamp(ped.z+vz*dt,-172,172);
    const blocked=state.world.buildings.some(b=>Math.abs(x-b.x)<b.w/2+.35&&Math.abs(z-b.z)<b.l/2+.35);
    if(!blocked){ped.x=x;ped.z=z;}
    ped.moving=Math.hypot(vx,vz)>.1;if(ped.moving)ped.yaw=Math.atan2(vx,vz);
  }
}
