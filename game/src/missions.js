'use strict';

const missionStop = (x,z,task,y=0) => ({x,z,task,y});
const CHECKPOINTS = [
  missionStop(44,140,'Reach the first checkpoint to start the clock.'),
  missionStop(44,83,'Follow the checkpoint route.'),
  missionStop(40,44,'Follow the checkpoint route.'),
  missionStop(-31,44,'Follow the checkpoint route.'),
  missionStop(-44,1,'Reach the final checkpoint.'),
];
const ROOFTOP = {x:-66,z:66,w:8,d:8,h:4};
const RAMP = {x:-66,foot:57,top:62};
const STORY = [
  {
    name:'First Pickup',reward:750,
    lines:['Rae, it’s Mara Quinn. I left a package on Anchor Avenue.','Take a car, pick it up and deliver it to the waterfront.'],
    stops:[missionStop(0,48,'Drive to the pickup and collect Mara’s package.'),
      missionStop(44,178,'Deliver the package to the waterfront.')],
  },
  {
    name:'Checkpoint Run',reward:900,
    lines:['Let’s see how well you know these streets.','Hit five checkpoints. The first one starts your 90 seconds.'],
    stops:CHECKPOINTS,
  },
  {
    name:'Repo Job',reward:1200,
    lines:['A gold Falcon GT is parked by the marina.','Bring it to the chop shop. I need it in one piece.'],
    stops:[missionStop(68,195,'Take the gold Falcon GT at the marina.'),
      missionStop(88,66,'Deliver the gold Falcon GT to the chop shop.')],
  },
  {
    name:'Rooftop Drop',reward:1500,
    lines:['Police are already looking for you. Go on foot.','Take the north ramp up to the rooftop drop on Lantern Square.'],
    stops:[missionStop(ROOFTOP.x,ROOFTOP.z,'Reach the rooftop on foot. Ramp on the north side.',ROOFTOP.h)],
  },
  {
    name:'The Big Score',reward:2500,
    lines:['Pick up Dante at the diner and drive him to the bank.','Give him twenty seconds inside, then get to the safe house.'],
    stops:[missionStop(44,-19,'Drive to the diner to pick up Dante.'),
      missionStop(0,-66,'Drive Dante to the bank and stop.'),
      missionStop(0,-66,'Stay near the bank while Dante opens the vault.'),
      missionStop(-88,-113,'Get Dante and the score to the safe house.')],
  },
];

function roofHeight(x,z) {
  if (Math.abs(x-ROOFTOP.x)>ROOFTOP.w/2) return 0;
  if (z>=ROOFTOP.z-ROOFTOP.d/2 && z<=ROOFTOP.z+ROOFTOP.d/2) return ROOFTOP.h;
  if (Math.abs(x-RAMP.x)<1.5 && z>=RAMP.foot && z<RAMP.top) {
    return ROOFTOP.h*(z-RAMP.foot)/(RAMP.top-RAMP.foot);
  }
  return 0;
}

function currentStop() {
  return STORY[game.chapter]?.stops[game.stage];
}

function danteRidesIn(car) {
  return game.chapter===4 && (game.stage===1 || game.stage===3) && game.vehicle===car;
}

function message(title, detail, seconds=5) {
  game.notice = {title,detail};
  game.banner = game.time+seconds;
}

function introduceMission() {
  game.dialogueUntil = game.time+9;
}

function restartMission() {
  game.stage = 0;
  game.deadline = 0;
  if (game.chapter===2) {
    if (game.vehicle===game.city.repo) game.vehicle = null;
    Object.assign(game.city.repo,{x:68,z:195,yaw:Math.PI/2,speed:0,damage:0,stolen:false});
  }
}

function updateMission() {
  const mission = STORY[game.chapter], stop = currentStop();
  if (!stop) return;
  const {player,vehicle,chapter,stage,time} = game;
  const radius = chapter===4 && stage===2 ? 23 : 6.5;
  const atStop = Math.hypot(player.x-stop.x,player.z-stop.z)<radius;
  if (chapter===1 && game.deadline && time>=game.deadline) {
    restartMission();
    message('TIME EXPIRED','Return to the first checkpoint.');
    saveGame();
    return;
  }
  if (chapter===2 && game.city.repo.damage>=45) {
    restartMission();
    message('REPO FAILED','A replacement Falcon GT is at the marina.');
    saveGame();
    return;
  }
  if (chapter===3 && time>=game.wantedGrace && game.wanted!==2) setWanted(2);
  if (chapter===4 && stage===2) {
    if (game.wanted<3) setWanted(3);
    if (!game.deadline) game.deadline = time+20;
    if (!atStop) {
      game.deadline = time+20;
      return;
    }
    if (time<game.deadline) return;
  } else if (!atStop && !(chapter===2 && stage===0 && vehicle===game.city.repo)) return;

  if (chapter===3 ? vehicle || player.y<ROOFTOP.h-.2 : !vehicle && !(chapter===4 && stage===2)) return;
  if (chapter===2 && vehicle!==game.city.repo) return;
  if (chapter===4 && stage===1 && Math.abs(vehicle.speed)>2) return;
  if (chapter===1 && stage===0) game.deadline = time+90;
  if (chapter===4 && stage===1) {
    game.deadline = time+20;
    setWanted(Math.max(3,game.wanted));
  }
  game.stage++;
  playSound('pickup');
  if (game.stage===mission.stops.length) {
    game.cash += mission.reward;
    game.earnings += mission.reward;
    game.ammo = 24;
    game.chapter++;
    game.stage = 0;
    game.deadline = 0;
    message('MISSION COMPLETE',mission.name+' · +$'+mission.reward.toLocaleString('en-US'));
    playSound('complete');
    introduceMission();
    if (game.chapter===STORY.length) game.storyAt = time+4;
  }
  saveGame();
}
