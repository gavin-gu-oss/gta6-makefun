import {createWorld} from '../game/src/world.js';
import {createState} from '../game/src/simulation.js';
import {updateTraffic} from '../game/src/ai.js';
import {updateJustice} from '../game/src/justice.js';

// A reproducible 60-second, five-star chase in the populated seed-1 city.
// The target drives a street rectangle at 12 m/s; patrol physics/collisions run normally.
export function chase() {
  const s=createState(createWorld(1));s.started=true;s.mission=6;
  s.car=s.world.cars.find(c=>c.id==='hero');
  Object.assign(s.car,{x:0,z:0,speed:12});
  const route=[{x:0,z:84},{x:126,z:84},{x:126,z:-84},{x:0,z:-84},{x:0,z:0}];
  const dt=1/60,stats=new Map();let next=0,framesStuck=0;
  for(let frame=0;frame<3600;frame++) {
    s.time+=dt;s.wanted=5;s.lastCrime=s.time;s.invulnerable=1;
    const t=route[next],dx=t.x-s.car.x,dz=t.z-s.car.z,d=Math.hypot(dx,dz),travel=Math.min(d,12*dt);
    s.car.yaw=Math.atan2(dx,dz);s.car.x+=dx/(d||1)*travel;s.car.z+=dz/(d||1)*travel;
    if(d<=travel+.001)next=(next+1)%route.length;
    updateTraffic(s,dt);updateJustice(s,dt);
    let stuck=false;
    for(const c of s.world.cars.filter(c=>c.police)) {
      const row=stats.get(c.id)||{id:c.id,stuck:0,run:0,longest:0,reversals:0};
      if(Math.abs(c.speed)<.5){row.stuck+=dt;row.run+=dt;stuck=true;}else row.run=0;
      row.longest=Math.max(row.longest,row.run);row.reversals=c.reversals||0;stats.set(c.id,row);
    }
    if(stuck)framesStuck++;
  }
  const patrols=[...stats.values()].map(({run,...row})=>row);
  return {seconds:60,targetSpeed:12,patrols,stuckPatrolSeconds:patrols.reduce((n,p)=>n+p.stuck,0),anyPatrolStuckSeconds:framesStuck*dt};
}
if(process.argv[1]===new URL(import.meta.url).pathname)console.log(JSON.stringify(chase(),null,2));
