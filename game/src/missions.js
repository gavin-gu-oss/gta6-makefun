import { JOB, SAVE_KEY } from './config.js';
import { clamp, distance } from './random.js';

export const MISSIONS=[
  {name:'First Pickup',reward:750,lines:['Mara Quinn: Rae Vega? Welcome to Port Solano. Take my Falcon for a spin.','A parcel is waiting at Mariner Market. Bring it to Sunset Pier.']},
  {name:'Checkpoint Run',reward:900,lines:['Mara Quinn: You will need to learn this city before we talk bigger jobs.','Pass all five gates in ninety seconds. Start along the coast.']},
  {name:'Repo Job',reward:1100,lines:['Mara Quinn: There is a gold Falcon GT at the marina with an overdue account.','Bring that car to Quinn Salvage. I need more than forty percent condition left.']},
  {name:'Rooftop Drop',reward:1250,lines:['Mara Quinn: The precinct is watching. This delivery needs a quieter approach.','Go on foot. Climb the east stairs of the teal roof and collect the parcel.']},
  {name:'The Big Score',reward:2500,lines:['Mara Quinn: Dante is waiting at Nightjar Diner. He knows the bank vault.','Take him there, hold for twenty seconds, then bring the score to our safe house.']},
];
export const CHECKPOINTS=[
  {x:126,z:42,name:'Coast gate'},{x:126,z:-84,name:'Market turn'},
  {x:0,z:-84,name:'Old town sprint'},{x:0,z:42,name:'Civic straight'},{x:84,z:42,name:'Finish line'},
];
const CHOP={x:-126,z:42,name:'Quinn Salvage'},DINER={x:42,z:0,name:'Nightjar Diner · Dante'};
const BANK={x:-84,z:-84,name:'Tide Union Bank'},SAFE={x:84,z:126,name:'Quinn Safe House'};
const REPO={x:164,z:58,name:'Gold Falcon · marina'};
export function missionIndex(state){return clamp(state.mission-1,0,4);}
export function hasDante(state,car){return state.mission===5&&state.stage>0&&!!car&&state.car===car;}
export function introduce(state) {
  if(state.mission>=6)return;
  state.dialogue=MISSIONS[missionIndex(state)].lines;state.dialogueTime=11;
}
export function marker(state) {
  switch(state.mission) {
    case 0:return JOB.pickup;
    case 1:return JOB.delivery;
    case 2:return CHECKPOINTS[state.stage||0];
    case 3:return state.stage?CHOP:REPO;
    case 4:{const roof=state.world.rooftop;return roof?{x:roof.x,z:roof.z,y:roof.y,name:'Rooftop parcel · east stairs'}:null;}
    case 5:return state.stage===0?DINER:state.stage<3?BANK:SAFE;
    default:return null;
  }
}
export function objective(state) {
  if(state.retryDelay>0)return `Mara will call again in ${Math.ceil(state.retryDelay)} s. Find your footing.`;
  const {mission,stage,car}=state;
  if(mission<2) {
    if(!car)return mission===0?'Find a ride. Press E beside a car.':'Return to a car and deliver the package.';
    return mission===0?'FIRST PICKUP / Collect the package at Mariner Market.':'PACKAGE ON BOARD / Deliver to Sunset Pier.';
  }
  if(mission===2)return `CHECKPOINT RUN / ${stage+1}/5 · ${Math.ceil(state.timer)} s · Pass the gold gates.`;
  if(mission===3) {
    const condition=Math.max(0,Math.round(100-(state.world.cars.find(c=>c.id==='repo')?.damage||0)));
    return stage?`REPO JOB / Gold Falcon to Quinn Salvage · ${condition}% condition.`:'REPO JOB / Take the gold Falcon parked at the marina.';
  }
  if(mission===4)return 'ROOFTOP DROP / On foot, take the marked east stairs. Two stars. Avoid detention.';
  if(mission===5)return [
    'THE BIG SCORE / Collect Dante at Nightjar Diner in a car.',
    'THE BIG SCORE / Take Dante to Tide Union Bank.',
    `HOLD THE BANK / Remain within 18 m · Vault opens in ${Math.ceil(Math.max(0,20-state.vaultTime))} s.`,
    'THE BIG SCORE / Drive the score to the safe house.',
  ][stage];
  return 'STORY COMPLETE / Free roam. Explore Port Solano.';
}
function revision(state,sound='pickup'){state.missionRevision++;state.events.push(sound);}
function complete(state,index) {
  const job=MISSIONS[index];
  state.cash+=job.reward;state.earnings+=job.reward;state.lastMission=job.name;state.lastReward=job.reward;
  Object.assign(state,{banner:7,ammo:24,mission:state.mission+1,stage:0,timer:90,vaultTime:0,pickupTime:0});
  revision(state,'complete');
  if(state.mission===6){state.storyComplete=true;state.storyScreen=true;}else introduce(state);
  return `${job.name.toUpperCase()} COMPLETE · +$${job.reward.toLocaleString('en-US')}`;
}
function runCheckpoints(state,dt) {
  state.timer-=dt;
  if(state.timer<=0){state.stage=0;state.timer=90;state.missionRevision++;return 'Time is up. The checkpoint route is ready for another attempt.';}
  if(state.car&&distance(state.car,marker(state))<7) {
    state.stage++;revision(state);
    if(state.stage===CHECKPOINTS.length)return complete(state,1);
  }
  return null;
}
export function advanceMission(state,dt) {
  if(state.retryDelay>0||state.mission>=6)return null;
  if(state.mission===2)return runCheckpoints(state,dt);
  const car=state.car;
  if(state.mission===3) {
    const target=state.world.cars.find(c=>c.id==='repo');
    if(!target)return null;
    if(target.damage>=60) {
      if(car===target)state.car=null;
      Object.assign(target,{x:REPO.x,z:REPO.z,yaw:Math.PI,damage:0,speed:0});
      state.stage=0;state.pickupTime=0;state.missionRevision++;
      return 'Too much damage. A replacement gold Falcon is waiting at the marina.';
    }
    if(state.stage===0) {
      if(car!==target)return null;
      state.stage=1;revision(state);return 'Gold Falcon acquired. Keep it intact on the way to Quinn Salvage.';
    }
    if(car!==target){state.pickupTime=0;return null;}
  }
  if(state.mission===4)state.wanted=Math.max(state.wanted,2);
  if(state.mission===5&&state.stage===2) {
    state.wanted=Math.max(state.wanted,3);
    if(distance(car||state.player,BANK)<18)state.vaultTime+=dt;
    if(state.vaultTime>=20){state.stage=3;revision(state);return 'Dante: The vault is open. Take us to the safe house!';}
    return null;
  }
  const target=marker(state);if(!target)return null;
  const onRoof=!car&&Math.abs(state.player.y-target.y)<1.2;
  const ready=state.mission===4?onRoof:!!car&&Math.abs(car.speed)<3;
  if(!ready||distance(car||state.player,target)>6){state.pickupTime=0;return null;}
  state.pickupTime+=dt;if(state.pickupTime<1.1)return null;
  state.pickupTime=0;revision(state);
  switch(state.mission) {
    case 0:state.mission=1;return 'Package secured. Mara: Sunset Pier, Rae. Take care on the way.';
    case 1:return complete(state,0);
    case 3:return complete(state,2);
    case 4:return complete(state,3);
    case 5:
      if(state.stage===0){state.stage=1;return 'Dante: Glad you made it. Tide Union Bank is our next stop.';}
      if(state.stage===1){state.stage=2;state.vaultTime=0;state.wanted=Math.max(state.wanted,3);return 'Dante: Give me twenty seconds. Stay close to the bank.';}
      if(state.stage===3)return complete(state,4);
  }
  return null;
}
export function loadSave(storage) {
  try {
    const record=JSON.parse(storage.getItem(SAVE_KEY));
    if(record?.version!==1||!['x','z','cash','mission','wanted'].every(key=>Number.isFinite(record[key])))return null;
    const number=(key,fallback,low,high)=>clamp(Number.isFinite(record[key])?record[key]:fallback,low,high);
    const mission=Math.floor(number('mission',0,0,6)),stageLimit=({2:4,3:1,5:3})[mission]||0;
    return {
      x:number('x',0,-174,190),z:number('z',17,-174,174),y:number('y',0,0,60),yaw:number('yaw',Math.PI,-10000,10000),
      cash:Math.floor(number('cash',120,0,9999999)),health:number('health',100,1,100),wanted:Math.floor(number('wanted',0,0,5)),
      mission,stage:Math.floor(number('stage',0,0,stageLimit)),timer:number('timer',90,.1,90),vaultTime:number('vaultTime',0,0,20),
      ammo:Math.floor(number('ammo',24,0,24)),earnings:Math.floor(number('earnings',mission>=2?750:0,0,9999999)),
      repoDamage:number('repoDamage',0,0,59),storyComplete:mission===6,
    };
  } catch {return null;}
}
export function saveGame(state,storage) {
  try {
    const actor=state.car||state.player,record={version:1,x:actor.x,z:actor.z,y:state.car?0:actor.y,yaw:actor.yaw};
    for(const field of ['cash','health','wanted','mission','stage','timer','vaultTime','ammo','earnings'])record[field]=state[field];
    record.repoDamage=state.world.cars.find(car=>car.id==='repo')?.damage||0;
    storage.setItem(SAVE_KEY,JSON.stringify(record));return true;
  } catch {return false;}
}
