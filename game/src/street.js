'use strict';

const POLICE_STEPS = {x:-50,z:-88};
const HOSPITAL_STEPS = {x:94,z:0};

function signalColor(x,z,alongX,time) {
  const phase = (time+((x/ BLOCK+4)*3+(z/BLOCK+4)*2)%10)%20;
  const green = alongX ? phase : (phase+10)%20;
  return green<7.5 ? 'green' : green<9 ? 'yellow' : 'red';
}

function trafficUpdate(city,dt,time) {
  for (const path of city.traffic) {
    const car = path.actor;
    const [fx,fz] = forwardOf(car.yaw), [rx,rz] = rightOf(car.yaw);
    const alongX = Math.abs(fx)>.5;
    const position = alongX ? car.x : car.z;
    const sign = Math.sign(alongX ? fx : fz);
    const junction = Math.round((position+sign*BLOCK/2)/BLOCK)*BLOCK;
    const cross = Math.round((alongX ? car.z : car.x)/BLOCK)*BLOCK;
    const distance = (junction-position)*sign-9.3;
    let pace = path.cruise;
    if (distance>=-.25 && signalColor(alongX ? junction : cross,alongX ? cross : junction,alongX,time)!=='green') {
      pace = Math.min(pace,Math.max(0,distance*2.3));
    }
    for (const other of city.cars) {
      if (other===car) continue;
      const x = other.x-car.x, z = other.z-car.z;
      const gap = x*fx+z*fz, lateral = Math.abs(x*rx+z*rz);
      if (gap>0 && gap<13 && lateral<2.1) {
        const clearance = (MODELS[car.kind].length+MODELS[other.kind].length)/2+.85;
        pace = Math.min(pace,Math.max(0,(gap-clearance)*1.75));
      }
    }
    car.braking = pace<path.cruise-.25;
    car.speed = pace;
    path.pace = pace;
    advancePath(path,dt);
  }
}

function clearSight(city,from,to,radius=.08) {
  const dx = to.x-from.x, dz = to.z-from.z;
  const steps = Math.ceil(Math.hypot(dx,dz)/1.4);
  for (let i=1;i<steps;i++) {
    if (hitsWorld(city,from.x+dx*i/steps,from.z+dz*i/steps,radius)) return false;
  }
  return true;
}

function setWanted(stars) {
  if (stars>game.wanted) {
    game.lastSeen = game.time;
    playSound('wanted');
  }
  game.wanted = stars;
}

function crime(type) {
  if ((game.crimes[type] ?? -Infinity)>game.time) return;
  game.crimes[type] = game.time+6;
  game.lastSeen = game.time;
  setWanted(Math.min(game.chapter===3 ? 2 : 5,game.wanted+1));
}

function hurt(amount) {
  game.health = Math.max(0,game.health-amount);
  game.lastHurt = game.time;
}

function crash(car,againstCar) {
  const impact = Math.abs(car.speed);
  if (impact<2.5 || game.time<game.lastHurt+.4) return;
  if (againstCar) crime('traffic');
  car.damage = (car.damage || 0)+impact*.82;
  hurt(impact*.91);
  playSound('crash');
}

function fall(person,x,z,seconds) {
  const dx = person.x-x, dz = person.z-z, distance = Math.hypot(dx,dz) || 1;
  person.pushX = dx/distance*4;
  person.pushZ = dz/distance*4;
  person.downUntil = game.time+seconds;
  person.flash = game.time+.16;
}

function walkerUpdate(path,dt) {
  const {city,time,player} = game, person = path.actor;
  if (person.downUntil>time) {
    const x = person.x+person.pushX*dt, z = person.z+person.pushZ*dt;
    if (!hitsWorld(city,x,z,.3)) Object.assign(person,{x,z});
    person.pushX *= Math.exp(-dt*5);
    person.pushZ *= Math.exp(-dt*5);
    return;
  }
  let threat = game.wanted>=3 && Math.hypot(person.x-player.x,person.z-player.z)<16 ? player : null;
  for (const car of city.cars) {
    if (Math.abs(car.speed)<7) continue;
    const dx = person.x-car.x, dz = person.z-car.z;
    if (hitsCarBody(car,person.x,person.z,.27)) {
      fall(person,car.x,car.z,4);
      if (car===game.vehicle) {
        crime('pedestrian');
        hurt(3);
        playSound('crash');
      }
      return;
    }
    const [fx,fz] = forwardOf(car.yaw);
    const ahead = (dx*fx+dz*fz)*Math.sign(car.speed);
    if (ahead>0 && ahead<7 && Math.abs(dx*fz-dz*fx)<2.1) threat = car;
  }
  path.pace = path.cruise*(threat ? 2 : 1);
  advancePath(path,dt);
  let x = 0, z = 0;
  if (threat) {
    const dx = person.x-threat.x, dz = person.z-threat.z;
    const d = Math.hypot(dx,dz) || 1;
    x += dx/d*1.4;
    z += dz/d*1.4;
  }
  for (const other of city.walkers) {
    if (other===path) continue;
    const dx = person.x-other.actor.x, dz = person.z-other.actor.z, d = Math.hypot(dx,dz);
    if (d>0 && d<.9) {
      x += dx/d*(.9-d)*.8;
      z += dz/d*(.9-d)*.8;
    }
  }
  const blend = Math.min(1,dt*7);
  path.sideX = (path.sideX || 0)*(1-blend)+x*blend;
  path.sideZ = (path.sideZ || 0)*(1-blend)+z*blend;
  const nextX = person.x+path.sideX, nextZ = person.z+path.sideZ;
  if (!hitsWorld(city,nextX,nextZ,.28)) Object.assign(person,{x:nextX,z:nextZ});
}

function policeSee() {
  return game.city.police.some(car => {
    const observer = car.officer || car;
    return !(observer.downUntil>game.time) && game.player.y<3 &&
      Math.hypot(observer.x-game.player.x,observer.z-game.player.z)<33 &&
      clearSight(game.city,observer,game.player);
  });
}

function removePatrol(car) {
  const {city} = game;
  city.police.splice(city.police.indexOf(car),1);
  city.cars.splice(city.cars.indexOf(car),1);
}

function spawnPatrol() {
  const {player,city} = game;
  const roads = [];
  for (let x=-EDGE;x<=EDGE;x+=BLOCK) for (let z=-EDGE;z<=EDGE;z+=BLOCK) {
    const point = {x:x+2.6,z:z+10};
    const distance = Math.hypot(point.x-player.x,point.z-player.z);
    if (distance>32 && distance<105 && !hitsWorld(city,point.x,point.z,1.1) &&
      !hitsCar(city,point.x,point.z,2)) roads.push(point);
  }
  if (!roads.length) return;
  const point = roads[Math.floor(city.rng()*roads.length)];
  const car = carAt(point.x,point.z,Math.atan2(player.x-point.x,player.z-point.z),0,0x274464,true);
  car.hits = 0;
  city.police.push(car);
  city.cars.push(car);
}

function pursuitTarget(car,player) {
  const {city} = game;
  if (clearSight(city,car,player,1.15)) {
    car.junction = null;
    return player;
  }
  if (car.junction && Math.hypot(car.x-car.junction.x,car.z-car.junction.z)>4) return car.junction;
  const originX = Math.round(car.x/BLOCK), originZ = Math.round(car.z/BLOCK);
  let best = 0, choice = player;
  const distance = Math.hypot(car.x-player.x,car.z-player.z);
  for (let ix=originX-1;ix<=originX+1;ix++) for (let iz=originZ-1;iz<=originZ+1;iz++) {
    const junction = {x:ix*BLOCK,z:iz*BLOCK};
    if (Math.hypot(car.x-junction.x,car.z-junction.z)<5 || hitsWorld(city,junction.x,junction.z,1.2)) continue;
    const progress = distance-Math.hypot(player.x-junction.x,player.z-junction.z);
    if (progress<=best || !clearSight(city,car,junction,1.2)) continue;
    best = progress;
    choice = junction;
  }
  car.junction = choice===player ? null : choice;
  return choice;
}

function pursue(actor,target,dt,pace,radius) {
  const dx = target.x-actor.x, dz = target.z-actor.z;
  const direct = Math.atan2(dx,dz);
  const test = yaw => {
    const [fx,fz] = forwardOf(yaw);
    return ![1,2.4,4].some(distance => hitsWorld(game.city,actor.x+fx*distance,actor.z+fz*distance,radius));
  };
  const around = [0,.55,-.55,1.05,-1.05,1.57,-1.57,2.3,-2.3,Math.PI];
  const offset = around.find(angle => test(direct+angle));
  if (offset===undefined) return;
  const heading = direct+offset-actor.yaw;
  const turn = Math.atan2(Math.sin(heading),Math.cos(heading));
  actor.yaw += clamp(turn,-dt*3.9,dt*3.9);
  actor.speed = pace*(1-.72*Math.min(1,Math.abs(turn)));
  const [fx,fz] = forwardOf(actor.yaw);
  const x = actor.x+fx*actor.speed*dt, z = actor.z+fz*actor.speed*dt;
  if (!hitsWorld(game.city,x,z,radius)) Object.assign(actor,{x,z});
}

function policeUpdate(dt) {
  const {city,player,time,vehicle} = game;
  if (policeSee()) game.lastSeen = time;
  const wantedFloor = game.chapter===3 ? 2 : game.chapter===4 && game.stage===2 ? 3 : 0;
  if (game.wanted>wantedFloor && time-game.lastSeen>=25) {
    setWanted(game.wanted-1);
    game.lastSeen = time;
  }
  const count = Math.ceil(game.wanted/2);
  while (city.police.length>count) removePatrol(city.police.at(-1));
  if (city.police.length<count) spawnPatrol();
  let touching = false;
  for (const car of city.police) {
    const distance = Math.hypot(car.x-player.x,car.z-player.z);
    if (!vehicle && player.y<2 && distance<10 && !car.officer && clearSight(city,car,player)) {
      car.speed = 0;
      car.officer = {x:car.x,z:car.z,yaw:car.yaw,shirt:0x344a71,skin:0xc69571,hits:0};
    }
    if (car.officer && !vehicle && distance<42) {
      const officer = car.officer;
      if (officer.downUntil>time) continue;
      if (officer.hits>=3) {
        removePatrol(car);
        break;
      }
      if (Math.hypot(officer.x-player.x,officer.z-player.z)<1.25 && player.y<1) touching = true;
      else pursue(officer,player,dt,5.4,.27);
    } else {
      car.officer = null;
      pursue(car,pursuitTarget(car,player),dt,vehicle ? 24+game.wanted*2 : 17,1.18);
      if (vehicle && distance<3.6 && time>=game.lastHurt+.75) {
        const impact = 9+game.wanted*1.5;
        vehicle.damage = (vehicle.damage || 0)+impact;
        hurt(impact);
        vehicle.speed *= .68;
        car.speed *= -.15;
        playSound('crash');
      }
    }
  }
  game.contact = touching ? game.contact+dt : 0;
}

function resolveHealth(dt) {
  const busted = game.contact>=2;
  if (!busted && game.health>0) {
    if (game.time-game.lastHurt>5) game.health = Math.min(100,game.health+dt*2);
    return false;
  }
  game.vehicle = null;
  Object.assign(game.player,busted ? POLICE_STEPS : HOSPITAL_STEPS,{y:0,vy:0});
  game.cash = Math.floor(game.cash*.8);
  game.health = 100;
  game.contact = 0;
  setWanted(0);
  for (const car of [...game.city.police]) removePatrol(car);
  if (game.chapter>0) restartMission();
  if (game.chapter===3) game.wantedGrace = game.time+6;
  message(busted ? 'BUSTED' : 'WASTED',busted ? 'Port Solano Police · 20% cash lost' : 'Port Solano Hospital · 20% cash lost');
  saveGame();
  return true;
}

function attack(shooting) {
  if (game.mode!=='play' || game.shot || game.vehicle || (shooting && !game.ammo)) return;
  const {city,player} = game;
  const [fx,fz] = forwardOf(game.cameraYaw);
  let target, range = shooting ? 42 : 2;
  const people = [...city.walkers.map(path => path.actor),...city.police.map(car => car.officer).filter(Boolean)];
  if (shooting) {
    game.ammo--;
    playSound('shot');
  } else playSound('punch');
  for (const candidate of shooting ? [...people,...city.cars] : people) {
    if (candidate.downUntil>game.time) continue;
    const dx = candidate.x-player.x, dz = candidate.z-player.z;
    let distance = Math.hypot(dx,dz);
    if (shooting) {
      const forward = dx*fx+dz*fz, side = Math.abs(dx*fz-dz*fx);
      if (forward<0 || forward>range+3) continue;
      if (candidate.kind===undefined) {
        if (side>.54) continue;
        distance = Math.max(0,forward-Math.sqrt(.54**2-side**2));
      } else {
        distance = Math.max(0,forward-3);
        while (distance<forward+3 && !hitsCarBody(candidate,player.x+fx*distance,player.z+fz*distance,.04)) distance += .16;
        if (distance>=forward+3) continue;
      }
    }
    const impact = shooting ? {x:player.x+fx*distance,z:player.z+fz*distance} : candidate;
    if (distance>=range || !clearSight(city,player,impact)) continue;
    target = candidate;
    range = distance;
  }
  if (!target) return;
  const observed = policeSee();
  target.flash = game.time+.16;
  if (target.kind===undefined) {
    if (shooting && target.hits!==undefined) {
      if (++target.hits>=3) {
        const patrol = city.police.find(car => car.officer===target);
        fall(target,player.x,player.z,8);
        patrol.hits = 3;
      }
    } else fall(target,player.x,player.z,shooting ? 6 : 2.5);
  } else if (target.police && ++target.hits>=3) {
    removePatrol(target);
    game.lastSeen = game.time;
  } else target.damage = (target.damage || 0)+6;
  if (observed) crime(shooting ? 'gunfire' : 'punch');
}
