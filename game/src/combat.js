import { distance } from './random.js';
import { crime, cue, policeSees } from './justice.js';
import { clearSight } from './ai.js';

export function attack(state,kind,yaw=state.player.yaw) {
  if(!state.started||state.paused||state.car||state.time<state.nextAttack)return false;
  const shoot=kind==='shoot';
  if(shoot&&state.ammo<=0){state.notice='Out of ammo. Complete a job to restock.';state.noticeTime=2;return false;}
  state.nextAttack=state.time+(shoot?.3:.65);if(shoot)state.ammo--;
  cue(state,shoot?'gunshot':'punch');
  const p=state.player,sx=Math.sin(yaw),sz=Math.cos(yaw);let target=null,best=shoot?85:2.05;
  for(const q of [...state.world.peds,...state.world.cars]) {
    if(!shoot&&q.model!==undefined)continue;
    if(q.down>0)continue;
    const dx=q.x-p.x,dz=q.z-p.z,along=dx*sx+dz*sz,side=Math.abs(dx*sz-dz*sx),d=distance(p,q);
    if((shoot?along>0&&side<(q.model!==undefined?1.35:.55)&&along<best:d<best)&&Math.abs((q.y||0)-p.y)<2.5&&clearSight(state.world,p,q)) {target=q;best=shoot?along:d;}
  }
  if(shoot){state.tracer={x:p.x,z:p.z,y:p.y+1.25,ex:p.x+sx*best,ez:p.z+sz*best,time:.09};crime(state,'gunfire');}
  else if(policeSees(state))crime(state,'assault');
  if(!target)return true;
  target.flash=.18;target.hits=(target.hits||0)+1;
  if(target.model!==undefined) {
    target.damage=(target.damage||0)+(shoot?12:2);
    if(target.police&&target.hits>=3)target.disabled=12;
    if(!target.police)crime(state,'vehicle');
  } else {
    if(!target.police||!shoot||target.hits>=3){target.down=target.police?12:8;target.x+=sx*.9;target.z+=sz*.9;target.hits=0;}
    if(target.police)crime(state,'officer');
  }
  return true;
}
