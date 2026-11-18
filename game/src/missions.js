import { JOB, SAVE_KEY } from './config.js';
import { clamp, distance } from './random.js';

export const MISSIONS=[
  {name:'First Pickup',reward:750,lines:['Mara Quinn: Welcome to Port Solano, Rae. That Falcon is yours for the evening.','Collect my parcel at Mariner Market. Sunset Pier is waiting.']},
  {name:'Checkpoint Run',reward:900,lines:['Mara Quinn: Let us see how well you know these streets.','Five checkpoints. Ninety seconds. Keep your wheels on the road.']},
  {name:'Repo Job',reward:1100,lines:['Mara Quinn: A gold Falcon GT is parked by the marina. The owner missed a payment.','Bring that specific car to the chop shop. Keep its condition above 40%.']},
  {name:'Rooftop Drop',reward:1250,lines:['Mara Quinn: Someone has tipped off the precinct. They know your face.','Leave the car. Use the exterior stairs on the east side of the teal-roof building. Take the roof parcel.']},
  {name:'The Big Score',reward:2500,lines:['Mara Quinn: Last job, Rae. Dante has the vault codes.','Collect him at the diner, reach the bank, hold twenty seconds, then get to our safe house.']},
];
export const CHECKPOINTS=[{x:126,z:42,name:'Coast gate'},{x:126,z:-84,name:'Market turn'},{x:0,z:-84,name:'Old town sprint'},{x:0,z:42,name:'Civic straight'},{x:84,z:42,name:'Finish line'}];
const CHOP={x:-126,z:42,name:'Quinn Salvage'},DINER={x:42,z:0,name:'Nightjar Diner · Dante'},BANK={x:-84,z:-84,name:'Tide Union Bank'},SAFE={x:84,z:126,name:'Quinn Safe House'};
export function missionIndex(state){return state.mission<2?0:Math.min(4,state.mission-1);}
export function hasDante(state,car){return state.mission===5&&state.stage>0&&!!car&&state.car===car;}
export function introduce(state) {
  if(state.mission>=6)return;
  state.dialogue=MISSIONS[missionIndex(state)].lines;state.dialogueTime=11;
}
export function marker(state) {
  if(state.mission===0)return JOB.pickup;
  if(state.mission===1)return JOB.delivery;
  if(state.mission===2)return CHECKPOINTS[state.stage||0];
  if(state.mission===3)return state.stage?CHOP:{x:164,z:58,name:'Gold Falcon · marina'};
  if(state.mission===4){const r=state.world.rooftop;return r?{x:r.x,z:r.z,y:r.y,name:'Rooftop parcel · east stairs'}:null;}
  if(state.mission===5)return state.stage===0?DINER:state.stage<3?BANK:SAFE;
  return null;
}
export function objective(state) {
  if(state.retryDelay>0)return 'Catch your breath. Mara will call again in '+Math.ceil(state.retryDelay)+' s.';
  if(state.mission<2)return !state.car?(state.mission===0?'Find a ride. Press E beside a car.':'Return to a car and deliver the package.'):(state.mission===0?'FIRST PICKUP / Collect the package at Mariner Market.':'PACKAGE ON BOARD / Deliver to Sunset Pier.');
  if(state.mission===2)return 'CHECKPOINT RUN / '+(state.stage+1)+'/5 · '+Math.ceil(state.timer)+' s · Drive through the gold gates.';
  if(state.mission===3)return state.stage?'REPO JOB / Deliver the gold Falcon to Quinn Salvage · '+Math.max(0,Math.round(100-(state.world.cars.find(c=>c.id==='repo')?.damage||0)))+'% condition.':'REPO JOB / Steal the specific gold Falcon parked at the marina.';
  if(state.mission===4)return 'ROOFTOP DROP / On foot, climb the marked east stairs. Two stars. Stay out of custody.';
  if(state.mission===5)return ['THE BIG SCORE / Pick up Dante at Nightjar Diner in a car.','THE BIG SCORE / Drive Dante to Tide Union Bank.','HOLD THE BANK / Stay within 18 m · Vault opens in '+Math.ceil(Math.max(0,20-state.vaultTime))+' s.','THE BIG SCORE / Escape to the safe house with a car.'][state.stage];
  return 'STORY COMPLETE / Free roam. Port Solano is yours to explore.';
}
function finish(state,index) {
  const job=MISSIONS[index];state.cash+=job.reward;state.earnings+=job.reward;state.lastReward=job.reward;state.lastMission=job.name;state.banner=7;state.ammo=24;
  state.events.push('complete');state.mission++;state.stage=0;state.timer=90;state.vaultTime=0;state.pickupTime=0;state.missionRevision++;
  if(state.mission>=6){state.storyComplete=true;state.storyScreen=true;}
  else introduce(state);
  return job.name.toUpperCase()+' COMPLETE · +$'+job.reward.toLocaleString('en-US');
}
export function advanceMission(state,dt) {
  if(state.retryDelay>0)return null;
  const car=state.car;
  if(state.mission===2) {
    state.timer-=dt;
    if(state.timer<=0){state.stage=0;state.timer=90;state.missionRevision++;return 'Checkpoint clock expired. Route reset — try again.';}
    if(car&&distance(car,marker(state))<7){state.stage++;state.events.push('pickup');state.missionRevision++;if(state.stage===5)return finish(state,1);}
    return null;
  }
  if(state.mission===3) {
    const repo=state.world.cars.find(c=>c.id==='repo');
    if(repo?.damage>=60){if(car===repo)state.car=null;Object.assign(repo,{x:164,z:58,yaw:Math.PI,speed:0,damage:0});state.stage=0;state.missionRevision++;return 'The Falcon took heavy damage. Mara arranged a replacement at the marina.';}
    if(!state.stage){if(car===repo){state.stage=1;state.missionRevision++;state.events.push('pickup');return 'Gold Falcon secured. Deliver it gently to Quinn Salvage.';}return null;}
    if(car!==repo){state.pickupTime=0;return null;}
  }
  if(state.mission===4)state.wanted=Math.max(2,state.wanted);
  if(state.mission===5&&state.stage===2) {
    state.wanted=Math.max(3,state.wanted);
    if(distance(car||state.player,BANK)<18){state.vaultTime+=dt;if(state.vaultTime>=20){state.stage=3;state.missionRevision++;state.events.push('pickup');return 'Dante: Vault is open. We have it. Get to the safe house!';}}
    return null;
  }
  const m=marker(state),actor=car||state.player;
  const valid=state.mission===4?!car&&Math.abs(state.player.y-m.y)<1.2:!!car&&Math.abs(car.speed)<3;
  if(!m||!valid||distance(actor,m)>6){state.pickupTime=0;return null;}
  state.pickupTime+=dt;if(state.pickupTime<1.1)return null;state.pickupTime=0;state.events.push('pickup');state.missionRevision++;
  if(state.mission===0){state.mission=1;return 'Package secured. Mara says: “Bring it to Sunset Pier. Keep it clean.”';}
  if(state.mission===1)return finish(state,0);
  if(state.mission===3)return finish(state,2);
  if(state.mission===4)return finish(state,3);
  if(state.mission===5){if(state.stage===0){state.stage=1;return 'Dante: Good to meet you, Rae. Tide Union Bank. Let us move.';}if(state.stage===1){state.stage=2;state.vaultTime=0;state.wanted=Math.max(3,state.wanted);return 'Dante: Twenty seconds. Keep the engine warm and stay close.';}if(state.stage===3)return finish(state,4);}
  return null;
}
export function loadSave(storage) {
  try {
    const s=JSON.parse(storage.getItem(SAVE_KEY));
    if(!s||s.version!==1||![s.x,s.z,s.cash,s.mission,s.wanted].every(Number.isFinite))return null;
    const num=(n,f,min,max)=>clamp(Number.isFinite(s[n])?s[n]:f,min,max),mission=Math.floor(num('mission',0,0,6));
    const stage=Math.floor(num('stage',0,0,mission===2?4:mission===3?1:mission===5?3:0));
    return {x:num('x',0,-174,190),z:num('z',17,-174,174),y:num('y',0,0,60),yaw:num('yaw',Math.PI,-10000,10000),cash:Math.floor(num('cash',120,0,9999999)),mission,stage,timer:num('timer',90,.1,90),vaultTime:num('vaultTime',0,0,20),wanted:Math.floor(num('wanted',0,0,5)),health:num('health',100,1,100),ammo:Math.floor(num('ammo',24,0,24)),earnings:Math.floor(num('earnings',mission>=2?750:0,0,9999999)),repoDamage:num('repoDamage',0,0,59),storyComplete:mission===6};
  } catch {return null;}
}
export function saveGame(state,storage) {
  try {const p=state.car||state.player;storage.setItem(SAVE_KEY,JSON.stringify({version:1,x:p.x,z:p.z,y:state.car?0:p.y,yaw:p.yaw,cash:state.cash,mission:state.mission,stage:state.stage,timer:state.timer,vaultTime:state.vaultTime,wanted:state.wanted,health:state.health,ammo:state.ammo,earnings:state.earnings,repoDamage:state.world.cars.find(c=>c.id==='repo')?.damage||0}));return true;}catch{return false;}
}
