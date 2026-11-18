import { BLOCK, MIN, MAX } from './config.js';
import { clamp, distance } from './random.js';

export const roadAt=n=>clamp(MIN+Math.round((n-MIN)/BLOCK)*BLOCK,MIN,MAX);
export function roadRoute(from,to) {
  const project=p=>Math.abs(p.x-roadAt(p.x))<Math.abs(p.z-roadAt(p.z))?{x:roadAt(p.x),z:p.z}:{x:p.x,z:roadAt(p.z)};
  const join=project(from),end=project(to),start={x:roadAt(join.x),z:roadAt(join.z)},goal={x:roadAt(end.x),z:roadAt(end.z)};
  const key=p=>p.x+','+p.z,queue=[start],parents=new Map([[key(start),null]]);
  // Breadth-first search of adjacent junctions; no segment crosses a city block.
  for(let i=0;i<queue.length&&!parents.has(key(goal));i++) {
    const p=queue[i],neighbors=[{x:p.x+BLOCK,z:p.z},{x:p.x-BLOCK,z:p.z},{x:p.x,z:p.z+BLOCK},{x:p.x,z:p.z-BLOCK}];
    neighbors.sort((a,b)=>distance(a,goal)-distance(b,goal));
    for(const q of neighbors)if(q.x>=MIN&&q.x<=MAX&&q.z>=MIN&&q.z<=MAX&&!parents.has(key(q))){parents.set(key(q),p);queue.push(q);}
  }
  const path=[];for(let p=goal;p;p=parents.get(key(p)))path.unshift(p);
  return [join,...path,end].filter((p,i,a)=>!i||distance(p,a[i-1])>.1);
}
export function signal(time,x,z,axis) {
  const phase=((time+Math.round((x+z)/BLOCK)*3+(axis==='x'?12:0))%24+24)%24;
  return phase<10?'green':phase<12?'yellow':'red';
}
export function clearSight(world,a,b) {
  const d=distance(a,b),steps=Math.ceil(d/3);
  for(let i=1;i<steps;i++) {
    const t=i/steps,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
    if(world.buildings.some(v=>Math.abs(x-v.x)<v.w/2&&Math.abs(z-v.z)<v.l/2&&(a.y||0)<v.h))return false;
  }
  return true;
}
export function updateTraffic(state,dt) {
  const {world}=state;
  for(const c of world.cars) {
    if(!c.traffic||c===state.car)continue;
    const t=c.route[c.next],dx=t.x-c.x,dz=t.z-c.z,d=Math.hypot(dx,dz);
    if(d<.25){c.x=t.x;c.z=t.z;c.next=(c.next+1)%c.route.length;continue;}
    const sx=dx/d,sz=dz/d,axis=Math.abs(dx)>Math.abs(dz)?'x':'z';c.yaw=Math.atan2(dx,dz);
    let desired=c.cruise;
    for(const other of world.cars) {
      if(other===c)continue;
      const ox=other.x-c.x,oz=other.z-c.z,along=ox*sx+oz*sz,side=Math.abs(ox*sz-oz*sx);
      if(along>0&&along<6+c.speed*1.3&&side<2.2)desired=Math.min(desired,Math.max(0,(along-5)*.8));
    }
    // Stop before the crosswalk. Cars already inside clear the junction.
    for(let n=MIN;n<=MAX;n+=BLOCK) {
      const gap=axis==='x'?(n-c.x)*Math.sign(dx):(n-c.z)*Math.sign(dz);
      const ix=axis==='x'?n:roadAt(c.x),iz=axis==='z'?n:roadAt(c.z);
      const color=signal(state.time,ix,iz,axis);
      if(gap>7&&gap<23&&color!=='green')desired=Math.min(desired,Math.max(0,(gap-9)*1.1));
      else if(gap>7&&gap<15)desired=Math.min(desired,4.5);
    }
    const old=c.speed;c.speed+=clamp(desired-c.speed,-14*dt,3*dt);c.braking=c.speed<old-.01||desired<.5;
    const travel=Math.min(d,c.speed*dt);c.x+=sx*travel;c.z+=sz*travel;
  }
}
export function updatePedestrians(state,dt) {
  const {world}=state,hero=state.car||state.player;
  for(const p of world.peds) {
    p.flash=Math.max(0,(p.flash||0)-dt);
    if(p.down>0){p.down=Math.max(0,p.down-dt);p.moving=false;continue;}
    if(p.police)continue;
    let dx=0,dz=0;
    const threat=world.cars.find(c=>Math.abs(c.speed)>7&&distance(c,p)<9);
    const scared=state.started&&state.wanted>=3&&distance(p,hero)<35;
    if(threat||scared) {
      const from=threat||hero,d=distance(from,p)||1;dx=(p.x-from.x)/d*3.8;dz=(p.z-from.z)/d*3.8;
    } else if(p.route) {
      const t=p.route[p.next],d=distance(p,t);
      if(d<.3)p.next=(p.next+1)%p.route.length;
      else {
        dx=(t.x-p.x)/d*p.speed;dz=(t.z-p.z)/d*p.speed;
        const axis=Math.abs(dx)>Math.abs(dz)?'x':'z',center=axis==='x'?roadAt(p.x):roadAt(p.z),gap=axis==='x'?(center-p.x)*Math.sign(dx):(center-p.z)*Math.sign(dz);
        // Cross on the pedestrian phase, waiting on the curb for cars to clear.
        if(gap>6&&gap<10&&signal(state.time,roadAt(p.x),roadAt(p.z),axis)!=='red'){dx=0;dz=0;}
        if(world.cars.some(c=>Math.abs(c.speed)>2&&distance(c,p)<6)){dx=0;dz=0;}
      }
    }
    for(const q of world.peds) {
      if(q===p||q.down>0)continue;const d=distance(p,q);
      if(d<.85){const nx=d>.01?(p.x-q.x)/d:1,nz=d>.01?(p.z-q.z)/d:0;dx+=nx*(.85-d)*3;dz+=nz*(.85-d)*3;}
    }
    const x=clamp(p.x+dx*dt,-172,194),z=clamp(p.z+dz*dt,-172,172);
    if(!world.buildings.some(b=>Math.abs(x-b.x)<b.w/2+.35&&Math.abs(z-b.z)<b.l/2+.35)){p.x=x;p.z=z;}
    p.moving=Math.hypot(dx,dz)>.1;if(p.moving)p.yaw=Math.atan2(dx,dz);
  }
}
