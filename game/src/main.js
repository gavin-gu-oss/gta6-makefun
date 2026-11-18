'use strict';

const query = new URLSearchParams(location.search);
const seed = Number(query.get('seed') ?? 1) | 0;
const shot = ['start','play','end'].includes(query.get('shot')) ? query.get('shot') : null;
const ui = Object.fromEntries(
  [...document.querySelectorAll('[id]')].map(element => [element.id,element]),
);
const map = ui.map.getContext('2d');
const SAVE_KEY = 'solano-streets-core-v1';
const keys = new Set();
const freshPlayer = () => ({x:1.25,z:157,y:0,vy:0,yaw:Math.PI,walking:false,running:false});
let game, renderer, orbitDrag = false, previousFrame, saveClock = 0, interactHint;

function readSave() {
  try {
    const save = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (save?.seed===seed && [save.x,save.z,save.yaw,save.cash,save.wanted,save.stage,save.health].every(Number.isFinite)
      && Number.isInteger(save.stage) && save.stage>=0 && save.stage<=4 && save.wanted>=0 && save.wanted<=5 && Number.isInteger(save.wanted)
      && (save.chapter===undefined || Number.isInteger(save.chapter) && save.chapter>=0 && save.chapter<=STORY.length)) return save;
  } catch { /* Play also works in browsers with storage disabled. */ }
  return null;
}

function saveGame() {
  if (!game || game.shot || game.mode==='title') return;
  const {x,z,yaw} = game.player;
  const {cash,wanted,stage,health,chapter,earnings,ammo} = game;
  const {vehicle,city} = game;
  const parked = vehicle ? {index:city.cars.indexOf(vehicle),damage:vehicle.damage || 0} : null;
  const repo = {x:city.repo.x,z:city.repo.z,yaw:city.repo.yaw,damage:city.repo.damage,stolen:!!city.repo.stolen};
  const remaining = Math.max(0,game.deadline-game.time);
  try {
    localStorage.setItem(SAVE_KEY,JSON.stringify({seed,x,z,yaw,cash,wanted,stage,health,chapter,earnings,ammo,
      parked,repo,remaining,storyPending:Number.isFinite(game.storyAt) || game.mode==='story'}));
    ui.continue.hidden = false;
  } catch { /* Continue is unavailable if the browser blocks storage. */ }
}

function reset(mode, save=null, preset=null) {
  const city = makeCity(seed);
  game = {
    city,player:freshPlayer(),vehicle:null,mode,shot:preset,stage:0,cash:0,health:100,wanted:0,
    chapter:0,earnings:0,ammo:24,crimes:{},lastSeen:0,lastHurt:-Infinity,contact:0,
    dialogueUntil:0,deadline:0,wantedGrace:0,storyAt:Infinity,
    palette:DAYLIGHT.day,cameraYaw:Math.PI,pitch:.22,cameraNudge:0,time:0,banner:0,
    cinematic:mode==='title' ? {eye:[21,18,194],target:[-10,9,117]} : null,
  };
  if (save) {
    const {x,z,yaw,cash,health,wanted,stage} = save;
    if (!hitsWorld(city,x,z,.35) && !hitsCar(city,x,z,.35)) Object.assign(game.player,{x,z,yaw});
    else {
      for (const offset of [1.6,2.3,3.4]) {
        const point = exitPoint({x,z,yaw},offset);
        if (point) {
          Object.assign(game.player,point,{yaw});
          break;
        }
      }
    }
    const chapter = save.chapter ?? (stage>=STORY[0].stops.length ? 1 : 0);
    const parked = city.cars[save.parked?.index];
    if (save.repo && [save.repo.x,save.repo.z,save.repo.yaw,save.repo.damage].every(Number.isFinite)) {
      const {x,z,yaw,damage,stolen} = save.repo;
      Object.assign(city.repo,{x,z,yaw,damage,stolen:!!stolen});
    }
    if (parked && !hitsWorld(city,x,z,.95)) {
      Object.assign(parked,{x,z,yaw,speed:0,stolen:true,damage:Math.max(0,Number(save.parked.damage) || 0)});
      Object.assign(game.player,{x,z,yaw});
      city.traffic = city.traffic.filter(path => path.actor!==parked);
      game.vehicle = parked;
    }
    Object.assign(game,{cash,health,wanted,chapter,cameraYaw:yaw,
      stage:save.chapter===undefined && chapter ? 0 : Math.min(stage,(STORY[chapter]?.stops.length ?? 1)-1),
      deadline:Number.isFinite(save.remaining) ? clamp(save.remaining,0,90) : 0,
      storyAt:chapter===STORY.length && save.storyPending ? .1 : Infinity,
      earnings:Number.isFinite(save.earnings) ? save.earnings : chapter ? 750 : 0,
      ammo:Number.isInteger(save.ammo) ? clamp(save.ammo,0,24) : 24,
    });
  }
  if (preset) stageShot(game,preset);
  else if (mode==='play') introduceMission();
  renderer?.gl.deleteBuffer(renderer.cityBuffer);
  if (renderer) {
    renderer.cityBuffer = renderer.buffer(city.mesh.data,renderer.gl.STATIC_DRAW);
    renderer.cityCount = city.mesh.data.length/8;
  } else renderer = new Renderer(ui.view,city.mesh);
  city.mesh.data.length = 0;
  interactHint = null;
  saveClock = 0;
  keys.clear();
  syncScreens();
}

function syncScreens() {
  ui.title.hidden = game.mode!=='title';
  ui.pause.hidden = game.mode!=='pause';
  ui.hud.hidden = game.mode==='title' || game.mode==='story';
  ui.story.hidden = game.mode!=='story';
  ui.continue.hidden = !readSave();
}

function togglePause() {
  if (game.mode!=='play' && game.mode!=='pause') return;
  if (game.mode==='play') {
    game.mode = 'pause';
    keys.clear();
    if (document.pointerLockElement===ui.view) document.exitPointerLock();
    saveGame();
  } else game.mode = 'play';
  syncScreens();
}

function closestCar() {
  let nearest = null, distance = 3.45;
  for (const car of game.city.cars) {
    if (car.police || Math.abs(car.speed)>4) continue;
    const gap = Math.hypot(car.x-game.player.x,car.z-game.player.z);
    if (gap<distance) {
      nearest = car;
      distance = gap;
    }
  }
  return nearest;
}

function exitPoint(car, side) {
  const [rx,rz] = rightOf(car.yaw);
  for (const sign of [-1,1]) {
    const x = car.x+rx*side*sign, z = car.z+rz*side*sign;
    if (!hitsWorld(game.city,x,z,.34) && !hitsCar(game.city,x,z,.34)) return {x,z};
  }
  return null;
}

function useCar() {
  if (game.shot && game.mode==='play') return;
  if (game.vehicle) {
    const car = game.vehicle;
    if (Math.abs(car.speed)>3) return;
    const point = exitPoint(car,MODELS[car.kind].width/2+.50);
    if (!point) return;
    Object.assign(game.player,point,{yaw:car.yaw,y:0,vy:0});
    car.speed = 0;
    car.braking = false;
    playSound('click');
    game.vehicle = null;
  } else {
    const car = closestCar();
    if (!car || game.player.y>1) return;
    playSound('click');
    if (!car.stolen) {
      car.stolen = true;
      crime('theft');
    }
    game.city.traffic = game.city.traffic.filter(path => path.actor!==car);
    Object.assign(game.player,{x:car.x,z:car.z,y:0,vy:0});
    game.vehicle = car;
    game.cameraYaw = car.yaw;
    game.cameraNudge = 0;
  }
  saveGame();
}

function drive(dt) {
  const car = game.vehicle, model = MODELS[car.kind];
  const throttle = Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
  const steer = Number(keys.has('KeyA'))-Number(keys.has('KeyD'));
  const brake = keys.has('Space');
  const opposing = throttle*car.speed<0;
  car.braking = brake || opposing;
  if (throttle) car.speed += throttle*(opposing ? 21 : 12)*dt;
  const drag = brake ? 7.3 : throttle ? .25 : 1.05;
  car.speed = clamp(car.speed*Math.exp(-drag*dt),-9,model.max);
  if (Math.abs(car.speed)<.07) car.speed = 0;
  const steering = Math.min(Math.abs(car.speed)*.24,1)/(1+Math.abs(car.speed)*.025);
  car.yaw += steer*Math.sign(car.speed)*steering*(brake ? 2.8 : 2.06)*dt;
  const [dx,dz] = forwardOf(car.yaw);
  const radius = model.width*.45;
  const blocked = (x,z) => [-model.length*.31,0,model.length*.31].some(offset => {
    const px = x+dx*offset, pz = z+dz*offset;
    return hitsWorld(game.city,px,pz,radius) || hitsCar(game.city,px,pz,radius,car);
  });

  // Short steps keep even the fastest car from tunneling through props.
  const travel = car.speed*dt;
  const steps = Math.max(1,Math.ceil(Math.abs(travel)/.38));
  for (let i=0;i<steps;i++) {
    const x = car.x+dx*travel/steps, z = car.z+dz*travel/steps;
    if (!blocked(x,z)) {
      car.x = x;
      car.z = z;
      continue;
    }
    const struckCar = [-model.length*.31,0,model.length*.31].some(offset =>
      hitsCar(game.city,x+dx*offset,z+dz*offset,radius,car));
    crash(car,struckCar);
    if (!blocked(x,car.z)) car.x = x;
    else if (!blocked(car.x,z)) car.z = z;
    car.speed *= -.18;
    break;
  }
  Object.assign(game.player,{x:car.x,z:car.z,yaw:car.yaw});
}

function walk(dt) {
  const p = game.player;
  const [fx,fz] = forwardOf(game.cameraYaw), [rx,rz] = rightOf(game.cameraYaw);
  const ahead = Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
  const sideways = Number(keys.has('KeyA'))-Number(keys.has('KeyD'));
  const x = fx*ahead+rx*sideways, z = fz*ahead+rz*sideways;
  p.walking = !!(ahead || sideways);
  p.running = keys.has('ShiftLeft') || keys.has('ShiftRight');
  if (p.walking) {
    const stride = (p.running ? 8.4 : 4.5)*dt/Math.hypot(x,z);
    const nextX = p.x+x*stride, nextZ = p.z+z*stride;
    const blocked = (px,pz) => hitsWorld(game.city,px,pz,.34) || hitsCar(game.city,px,pz,.32);
    const canStep = (x,z) => !blocked(x,z) && roofHeight(x,z)<=Math.max(p.y,roofHeight(p.x,p.z))+.43;
    if (canStep(nextX,p.z)) p.x = nextX;
    if (canStep(p.x,nextZ)) p.z = nextZ;
    p.yaw = Math.atan2(x,z);
  }
  const floor = roofHeight(p.x,p.z);
  if (p.y>floor || p.vy>0) {
    p.vy -= 16*dt;
    p.y = Math.max(floor,p.y+p.vy*dt);
    if (p.y===floor) p.vy = 0;
  } else p.y = floor;
}

function cameraForGame(dt) {
  if (game.cinematic) return game.cinematic;
  const subject = game.vehicle || game.player;
  if (game.vehicle) {
    const desired = subject.yaw+game.cameraNudge;
    const difference = Math.atan2(Math.sin(desired-game.cameraYaw),Math.cos(desired-game.cameraYaw));
    game.cameraYaw += difference*Math.min(1,dt*5);
    if (!orbitDrag && !game.shot) game.cameraNudge *= Math.exp(-dt*.83);
  }
  const [fx,fz] = forwardOf(game.cameraYaw);
  const distance = game.vehicle ? 9.4 : 6.1;
  const groundHeight = game.vehicle ? 1.05 : 1.48+game.player.y;
  const lift = distance*Math.tan(game.pitch)+.75;
  let reach = distance;
  for (let step=.5;step<distance;step+=.5) {
    const x = subject.x-fx*step, z = subject.z-fz*step;
    if (game.city.buildings.some(b => Math.abs(x-b.x)<b.w/2+.26 && Math.abs(z-b.z)<b.d/2+.26)) {
      reach = Math.max(.75,step-.5);
      break;
    }
  }
  return {
    eye:[subject.x-fx*reach,groundHeight+lift*reach/distance,subject.z-fz*reach],
    target:[subject.x+fx*2.25,groundHeight,subject.z+fz*2.25],
  };
}

function renderMap(stop) {
  const size = ui.map.width, scale = size/390;
  const mx = x => size/2+x*scale;
  const mz = z => (z+185)*scale;
  map.fillStyle = '#2c626d';
  map.fillRect(0,0,size,size);
  map.fillStyle = '#3d4754';
  map.fillRect(mx(-182),mz(-182),364*scale,364*scale);
  map.fillStyle = '#be9b6a';
  map.fillRect(mx(-182),mz(182),364*scale,33*scale);
  map.fillRect(mx(57),mz(192),8*scale,60*scale);
  map.fillStyle = '#77827d';
  for (let x=-4;x<4;x++) for (let z=-4;z<4;z++) {
    map.fillRect(mx(x*BLOCK+ROAD/2),mz(z*BLOCK+ROAD/2),(BLOCK-ROAD)*scale,(BLOCK-ROAD)*scale);
  }
  map.fillStyle = '#414f57';
  for (const b of game.city.buildings) map.fillRect(mx(b.x-b.w/2),mz(b.z-b.d/2),b.w*scale,b.d*scale);
  for (const car of game.city.cars) {
    map.fillStyle = car.police ? '#7fb5ff' : '#e3eff2';
    map.fillRect(mx(car.x)-1,mz(car.z)-1,2,2);
  }
  if (stop) {
    map.beginPath();
    map.arc(mx(stop.x),mz(stop.z),4+Math.sin(game.time*4),0,TAU);
    map.strokeStyle = '#fff7d6';
    map.lineWidth = 2;
    map.stroke();
    map.fillStyle = '#ffab57';
    map.fill();
  }
  const p = game.vehicle || game.player;
  map.save();
  map.translate(mx(p.x),mz(p.z));
  map.rotate(-p.yaw);
  map.beginPath();
  map.moveTo(0,6);
  map.lineTo(-4,-4);
  map.lineTo(0,-2);
  map.lineTo(4,-4);
  map.closePath();
  map.strokeStyle = '#1b2c33';
  map.stroke();
  map.fillStyle = '#a3ffd4';
  map.fill();
  map.restore();
}

function drawHud(stop) {
  ui.cash.textContent = '$'+game.cash.toLocaleString('en-US');
  ui.health.value = game.health;
  ui.stars.textContent = '★'.repeat(game.wanted)+'☆'.repeat(5-game.wanted);
  ui.stars.setAttribute('aria-label',game.wanted+' of 5 wanted stars');
  const mission = STORY[game.chapter];
  ui.mission.textContent = stop ? mission.name : 'Free roam';
  let task = stop?.task ?? 'Explore Port Solano.';
  if (game.deadline>game.time && (game.chapter===1 || game.chapter===4 && game.stage===2)) {
    task += ' · '+Math.ceil(game.deadline-game.time)+' s';
  }
  ui.task.textContent = task;
  ui.ammo.textContent = 'Pistol · '+game.ammo;
  ui.mute.textContent = muted ? ' · Muted' : '';
  ui.dialogue.hidden = !mission || game.shot || game.mode!=='play' || game.dialogueUntil<=game.time;
  if (!ui.dialogue.hidden) ui.lines.textContent = mission.lines.join('\n');
  ui.bannerTitle.textContent = game.notice?.title ?? '';
  ui.bannerDetail.textContent = game.notice?.detail ?? '';
  ui.reticle.hidden = !!game.vehicle || !!game.shot || game.mode!=='play';
  ui.drive.hidden = !game.vehicle;
  if (game.vehicle) {
    ui.speed.textContent = Math.round(Math.abs(game.vehicle.speed)*3.6);
    ui.model.textContent = MODELS[game.vehicle.kind].name;
  }
  ui.near.hidden = !interactHint || game.mode!=='play';
  ui.near.textContent = interactHint ?? '';
  ui.banner.hidden = game.mode!=='play' || game.banner<=game.time;
  renderMap(stop);
}

function frame(timestamp) {
  const dt = previousFrame===undefined ? 0 : Math.min((timestamp-previousFrame)/1000,.045);
  previousFrame = timestamp;
  if (game.mode==='play' || game.mode==='title') {
    game.time += dt;
    trafficUpdate(game.city,dt,game.time);
    for (const path of game.city.walkers) walkerUpdate(path,dt);
  }
  if (game.mode==='play') {
    if (game.shotTraffic) tickShot(game);
    if (!game.shot) {
      if (game.vehicle) drive(dt);
      else {
        walk(dt);
        const p = game.player;
        const struck = p.y<1 && game.city.cars.find(car => Math.abs(car.speed)>5 &&
          Math.hypot(car.x-p.x,car.z-p.z)<2);
        if (struck && game.time>game.lastHurt+.65) {
          hurt(Math.abs(struck.speed)*1.15);
          playSound('crash');
        }
      }
      policeUpdate(dt);
      if (!resolveHealth(dt)) updateMission();
      if (game.time>=game.storyAt) {
        game.mode = 'story';
        game.storyAt = Infinity;
        keys.clear();
        if (document.pointerLockElement===ui.view) document.exitPointerLock();
        ui.earnings.textContent = 'Total mission earnings · $'+game.earnings.toLocaleString('en-US');
        syncScreens();
      }
      const nearest = !game.vehicle && closestCar();
      interactHint = nearest ? 'E · Enter '+MODELS[nearest.kind].name : null;
      saveClock += dt;
      if (saveClock>2) {
        saveClock = 0;
        saveGame();
      }
    }
  }
  const live = new Mesh();
  const dusk = game.palette===DAYLIGHT.dusk;
  updateAudio();
  for (const car of game.city.cars) carMesh(live,car,game.time,dusk,danteRidesIn(car));
  for (const path of game.city.walkers) personMesh(live,path.actor,game.time,false,path.phase);
  for (const car of game.city.police) if (car.officer) personMesh(live,car.officer,game.time);
  streetLights(live,game.city,game.time);
  if (dusk) duskWindows(live,game.city);
  if (!game.vehicle) personMesh(live,game.player,game.time,true);
  if (!game.shot && game.chapter===4 && (game.stage===0 || game.stage===2)) {
    const {x,z} = currentStop();
    personMesh(live,{x:x+5,z,yaw:-Math.PI/2,shirt:0xe7b153,skin:0x9b6047},game.time);
  }
  const stop = game.mode==='title' ? null : currentStop();
  if (stop) {
    const spin = game.time*1.3, y = stop.y+11+Math.sin(spin*2)*.55;
    for (let i=0;i<8;i++) {
      const [x,z] = forwardOf(i*TAU/8+spin);
      live.box(stop.x+x*3.7,.05,stop.z+z*3.7,.66,.08,.66,0xffbe52,spin);
    }
    live.box(stop.x,stop.y+.05,stop.z,.36,y-stop.y,.36,0xffbc57,spin);
    live.box(stop.x,y+.78,stop.z,1.24,1.24,.34,0xffd36f,spin);
    live.box(stop.x,y+.24,stop.z,.48,.70,.37,0xffd36f,spin);
  }
  renderer.draw(cameraForGame(game.mode==='pause' ? 0 : dt),live,game.palette);
  if (game.mode!=='title') drawHud(stop);
  else ui.banner.hidden = true;
  requestAnimationFrame(frame);
}

ui.start.onclick = () => {
  reset('play');
  saveGame();
};
ui.continue.onclick = () => reset('play',readSave());
ui.resume.onclick = togglePause;
ui.free.onclick = () => {
  game.mode = 'play';
  syncScreens();
  saveGame();
};
ui.menu.onclick = () => {
  saveGame();
  reset('title');
};

function lockPointer() {
  if (game.mode!=='play' || !ui.view.requestPointerLock) return;
  try { ui.view.requestPointerLock()?.catch(() => {}); } catch { /* Drag stays available. */ }
}

ui.lock.onclick = lockPointer;
for (const event of ['pointerdown','keydown']) window.addEventListener(event,unlockAudio,{capture:true});
document.addEventListener('click',event => {
  if (event.target.closest('button')) playSound('click');
});
ui.view.addEventListener('click',event => { if (event.button===0) attack(true); });
ui.view.addEventListener('dblclick',lockPointer);
ui.view.addEventListener('pointerdown',event => {
  if (game.mode!=='play' || event.button!==0) return;
  orbitDrag = true;
  ui.view.setPointerCapture(event.pointerId);
});
for (const event of ['pointerup','pointercancel','lostpointercapture']) {
  ui.view.addEventListener(event,() => { orbitDrag = false; });
}
document.addEventListener('mousemove',event => {
  if (game.mode!=='play' || (!orbitDrag && document.pointerLockElement!==ui.view)) return;
  const delta = -event.movementX*.006;
  if (game.vehicle) game.cameraNudge += delta;
  else game.cameraYaw += delta;
  game.pitch = clamp(game.pitch-event.movementY*.004,-.06,.75);
});
window.addEventListener('keydown',event => {
  if (event.code==='Space' && game.mode==='play') event.preventDefault();
  if (!event.repeat && (event.code==='KeyP' || event.code==='Escape')) togglePause();
  if (!event.repeat && event.code==='KeyM') toggleMute();
  if (game.mode!=='play') return;
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code==='KeyE') useCar();
  if (event.code==='KeyF') attack(false);
  if (event.code==='Space' && !game.vehicle && game.player.y===roofHeight(game.player.x,game.player.z)) game.player.vy = 6.3;
});
window.addEventListener('keyup',event => keys.delete(event.code));
window.addEventListener('blur',() => keys.clear());
window.addEventListener('pagehide',saveGame);

try {
  reset('title',null,shot);
  requestAnimationFrame(frame);
} catch (error) {
  console.error(error);
  ui.title.querySelector('p').textContent = error.message;
  ui.start.disabled = true;
  ui.continue.hidden = true;
}
