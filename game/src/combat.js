import { distance } from './random.js';
import { clearSight } from './ai.js';
import { crime, cue, policeSees } from './justice.js';

function shotRange(world,origin,direction) {
  let range=85;
  for(const wall of world.buildings) {
    if(origin.y+1.25>=wall.h)continue;
    let entry=0,exit=range;
    for(const [axis,size] of [['x','w'],['z','l']]) {
      const low=wall[axis]-wall[size]/2,high=wall[axis]+wall[size]/2,velocity=direction[axis];
      if(Math.abs(velocity)<1e-8) {
        if(origin[axis]<low||origin[axis]>high){exit=-1;break;}
      } else {
        const a=(low-origin[axis])/velocity,b=(high-origin[axis])/velocity;
        entry=Math.max(entry,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
      }
    }
    if(exit>=entry)range=Math.min(range,entry);
  }
  return range;
}
export function attack(state,kind,yaw=state.player.yaw) {
  if(!state.started||state.paused||state.car||state.nextAttack>state.time)return false;
  const firing=kind==='shoot';
  if(firing&&state.ammo<1){state.notice='Out of ammo. Complete a job to restock.';state.noticeTime=2;return false;}
  state.nextAttack=state.time+(firing?.3:.65);
  if(firing)state.ammo--;
  cue(state,firing?'gunshot':'punch');
  const player=state.player,forward={x:Math.sin(yaw),z:Math.cos(yaw)};
  let nearest=null,range=firing?shotRange(state.world,player,forward):2.05;
  for(const body of [...state.world.peds,...state.world.cars]) {
    const vehicle=body.model!==undefined;
    if(body.down>0||(!firing&&vehicle)||Math.abs((body.y||0)-player.y)>=2.5)continue;
    const dx=body.x-player.x,dz=body.z-player.z,depth=dx*forward.x+dz*forward.z;
    const lateral=Math.abs(dx*forward.z-dz*forward.x);
    const valid=firing?depth>0&&depth<range&&lateral<(vehicle?1.35:.55):distance(body,player)<range;
    if(valid&&clearSight(state.world,player,body)){nearest=body;range=firing?depth:distance(body,player);}
  }
  if(firing) {
    state.tracer={x:player.x,z:player.z,y:player.y+1.25,ex:player.x+forward.x*range,ez:player.z+forward.z*range,time:.09};
    crime(state,'gunfire');
  }
  if(!nearest)return true;
  if(!firing&&policeSees(state))crime(state,'assault');
  nearest.flash=.18;nearest.hits=(nearest.hits||0)+1;
  if(nearest.model!==undefined) {
    nearest.damage=(nearest.damage||0)+(firing?12:2);
    if(nearest.police&&nearest.hits>=3)nearest.disabled=12;
    if(!nearest.police)crime(state,'vehicle');
  } else {
    if(!nearest.police||!firing||nearest.hits>=3) {
      nearest.down=nearest.police?12:8;nearest.hits=0;
      nearest.x+=forward.x*.9;nearest.z+=forward.z*.9;
    }
    if(nearest.police)crime(state,'officer');
  }
  return true;
}
