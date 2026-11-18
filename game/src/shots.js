import { makeCar } from './world.js';
import { JOB } from './config.js';

export function stageShot(state,name) {
  if(!['start','play','end'].includes(name))return false;
  state.shot=name;state.shotReleased=false;
  const hero=state.world.cars.find(c=>c.id==='hero');
  if(name==='start') {
    Object.assign(hero,{x:168,z:35,yaw:-.35,speed:0});Object.assign(state.player,{x:165.7,z:34,yaw:.65,y:0});
    state.started=false;state.stageCamera={eye:[178,4.1,44],target:[161,1.5,32],fov:.90};state.dusk=.12;
  }
  if(name==='play') {
    Object.assign(state,{started:true,car:hero,wanted:2,mission:1,dusk:.05});
    Object.assign(hero,{x:2.8,z:-23,yaw:Math.PI,speed:24});
    Object.assign(state.player,{x:hero.x,z:hero.z,yaw:hero.yaw});
    // Retain the tested composition: the patrol is eight metres behind Rae.
    const patrol=makeCar('patrol',hero.x-3.6,hero.z+8,0,Math.PI,[.12,.20,.24]);
    patrol.police=true;state.world.cars.push(patrol);
    const traffic=state.world.cars.filter(car=>car.traffic);
    for(const [index,x,z,yaw] of [[0,2.8,-40,Math.PI],[1,-2.8,-51,0]])Object.assign(traffic[index],{x,z,yaw,traffic:false});
    state.stageCamera={eye:[10.5,7.8,0],target:[.7,1.1,-24],fov:1.10};
    state.notice='MARA QUINN  /  Parcel aboard. Follow the coast.';state.noticeTime=100000;
  }
  if(name==='end') {
    state.started=true;state.mission=2;state.cash=120+JOB.reward;state.banner=100000;
    Object.assign(hero,{x:168,z:84,yaw:Math.PI/2,speed:0});Object.assign(state.player,{x:166.7,z:87,yaw:1.8,y:0});
    state.car=null;state.stageCamera={eye:[183,5.2,99],target:[160,2.0,79],fov:.94};state.dusk=.85;
  }
  // Reserve the composition around staged actors without affecting seeded city generation.
  state.world.cars=state.world.cars.filter(c=>c===hero||c.id==='patrol'||c.id==='repo'||c.traffic||Math.hypot(c.x-hero.x,c.z-hero.z)>8);
  return true;
}
export function releaseShot(state) {
  state.shotReleased=true;state.stageCamera=null;state.camera=null;
  if(state.car)state.car.speed=0;
  state.banner=Math.min(state.banner,7);state.noticeTime=Math.min(state.noticeTime,5);
}
