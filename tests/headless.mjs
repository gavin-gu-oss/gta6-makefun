import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../game/index.html', import.meta.url), 'utf8');
const elements = [...html.matchAll(/id="([^"]+)"/g)].map(([,id]) => ({
  id, width:188, getContext: () => new Proxy({}, {get: () => () => {}}),
  addEventListener() {}, setAttribute() {}, querySelector: () => ({}),
}));
let saved;
const context = vm.createContext({
  console, URLSearchParams, location:{search:''},
  document:{querySelectorAll:() => elements,addEventListener() {}},
  window:{addEventListener() {}}, requestAnimationFrame() {},
  localStorage:{getItem:() => saved,setItem:(_, value) => { saved = value; }},
});
const run = code => vm.runInContext(code,context);
for (const [,src] of html.matchAll(/<script defer src="([^"]+)"/g)) {
  run(readFileSync(new URL('../game/'+src,import.meta.url),'utf8'));
  if (src==='src/render.js') run(`Renderer = class {
    gl = {deleteBuffer(){},STATIC_DRAW:0};
    buffer() {}
    draw() {}
  }`);
}
run(`
  reset('play');
  game.vehicle = game.city.cars.find(car => car.x===3.6 && car.z===157);
  setWanted(5);
`);
const chase = run(`(() => {
  const stuck = new Map(), actual = new Map(), nearest = [];
  const loop = [[44,132],[44,44],[-44,44],[-44,132]];
  for (let step=0;step<1800;step++) {
    game.time += 1/30;
    game.lastSeen = game.time;
    const segment = step/150;
    const a = loop[Math.floor(segment)%4], b = loop[(Math.floor(segment)+1)%4];
    const mix = segment%1;
    const position = {x:a[0]+(b[0]-a[0])*mix,z:a[1]+(b[1]-a[1])*mix};
    Object.assign(game.player,position);
    Object.assign(game.vehicle,position);
    const prior = new Map(game.city.police.map(car => [car,[car.x,car.z]]));
    policeUpdate(1/30);
    nearest.push(Math.min(...game.city.police.map(car => Math.hypot(car.x-game.player.x,car.z-game.player.z))));
    for (const car of game.city.police) {
      if (!stuck.has(car)) { stuck.set(car,0); actual.set(car,0); }
      if (Math.abs(car.speed)<.5) stuck.set(car,stuck.get(car)+1/30);
      const point = prior.get(car);
      if (point && Math.hypot(car.x-point[0],car.z-point[1])*30<.5) actual.set(car,actual.get(car)+1/30);
    }
  }
  return {stuck:[...stuck.values()],actual:[...actual.values()],within10:nearest.filter(d=>d<10).length/30};
})()`);
console.log('60 s chase',chase);
assert.equal(chase.stuck.length,3);
assert.ok([...chase.stuck,...chase.actual].every(seconds => seconds<5));

for (const shot of ['start','play','end']) {
  const projected = run(`(() => {
    reset('title',null,'${shot}');
    const {city,player,vehicle,cinematic} = game;
    const hero = vehicle || city.cars.find(car => car.color===0xfa694b);
    const matrix = viewProjection(cinematic.eye,cinematic.target,1280/720);
    const patrol = city.cars.filter(car => car.police).sort((a,b) =>
      Math.hypot(a.x-hero.x,a.z-hero.z)-Math.hypot(b.x-hero.x,b.z-hero.z))[0];
    const project = (x,y,z) => {
      const p = [x,y,z,1];
      const component = row => p.reduce((sum,value,col) => sum+matrix[col*4+row]*value,0);
      const w = component(3);
      return [(1+component(0)/w)*640,(1-component(1)/w)*360,w,component(2)/w];
    };
    const subject = (actor,y) => {
      const model = MODELS[actor.kind];
      const halfWidth = model ? model.width*.57 : .45;
      const halfLength = model ? model.length*.53 : .42;
      const top = model ? .90+model.roof+(actor.police ? .29 : .11) : 2.12;
      const [rx,rz] = rightOf(actor.yaw), [fx,fz] = forwardOf(actor.yaw);
      const corners = [];
      for (const side of [-halfWidth,halfWidth]) {
        for (const front of [-halfLength,halfLength]) {
          for (const height of [0,top]) {
            corners.push(project(actor.x+rx*side+fx*front,height,actor.z+rz*side+fz*front));
          }
        }
      }
      return {center:project(actor.x,y,actor.z),corners};
    };
    const samples = [];
    for (const time of vehicle ? [0,Math.PI/1.3,3*Math.PI/1.3] : [0]) {
      game.time = time;
      if (vehicle) tickShot(game);
      const actors = [[vehicle ? 'player car' : '${shot}'==='start' ? 'hero car' : 'delivery car',hero,.8],
                       [vehicle ? 'nearest patrol' : 'Rae',patrol || player,vehicle ? .95 : 1]];
      samples.push(Object.fromEntries(actors.map(([name,actor,y]) => [name,subject(actor,y)])));
    }
    return samples;
  })()`);
  for (const sample of projected) {
    for (const [name,{corners}] of Object.entries(sample)) {
      for (const [x,y,w,depth] of corners) {
        assert.ok(w>0 && depth>-1 && depth<1 && x>=48 && x<=1232 && y>=48 && y<=672,
          `${shot} ${name} out of frame at ${x}, ${y}`);
      }
    }
  }
  console.log(shot,projected.map(sample => Object.fromEntries(Object.entries(sample)
    .map(([name,{center:[x,y]}]) => [name,[Math.round(x),Math.round(y)]]))));
}

assert.ok(run(`(() => {
  reset('play');
  game.city.walkers = [{actor:{x:game.player.x,z:game.player.z-8}}];
  attack(true);
  return game.ammo===23 && game.city.walkers[0].actor.downUntil>game.time;
})()`),'aimed pistol shot');

assert.ok(run(`(() => {
  reset('play');
  game.chapter = 4;
  const car = game.city.cars[0];
  const seen = [];
  const draw = () => {
    const mesh = {box(){},quad(){},vertex(){},oval(x,y,z,rx,ry,rz,color){ seen.push(color); }};
    carMesh(mesh,car,game.time,false,danteRidesIn(car));
    return seen.splice(0).includes(0x9b6047);
  };
  const advance = (x,z) => {
    game.vehicle = car;
    Object.assign(game.player,{x,z});
    updateMission();
  };
  if (draw()) return false;
  advance(44,-19);
  if (!draw()) return false;
  advance(0,-66);
  if (draw()) return false;
  game.time = 20;
  updateMission();
  if (!draw()) return false;
  advance(-88,-113);
  return !draw();
})()`),'Dante appears in the car only while riding');

const missionResults = run(`(() => {
  const require = (condition,message) => { if (!condition) throw Error(message); };
  const at = (x,z) => {
    Object.assign(game.player,{x,z});
    if (game.vehicle) Object.assign(game.vehicle,{x,z});
  };
  reset('play');
  const initialZ = game.player.z;
  keys.add('KeyW');
  walk(.1);
  keys.clear();
  require(game.player.z<initialZ,'walking');
  game.city.walkers = [{actor:{x:game.player.x,z:game.player.z-1}}];
  attack(false);
  require(game.city.walkers[0].actor.downUntil>game.time,'punch');
  useCar();
  require(game.vehicle && game.wanted===1,'entry and theft');
  policeUpdate(1/30);
  require(game.city.police.length===1,'one-star patrol count');
  setWanted(3);
  policeUpdate(1/30);
  require(game.city.police.length===2,'three-star patrol count');
  setWanted(0);
  policeUpdate(1/30);
  require(game.city.police.length===0,'clear patrol count');
  useCar();
  require(!game.vehicle,'exit');
  useCar();
  const beforeDrive = game.player.z;
  keys.add('KeyW');
  for (let i=0;i<30;i++) drive(1/30);
  keys.clear();
  require(game.player.z<beforeDrive-1,'driving');
  game.vehicle.speed = 0;
  const objective = () => {
    const {x,z} = currentStop();
    at(x,z);
    updateMission();
  };
  objective();
  require(game.stage===1 && game.chapter===0,'M1 pickup');
  objective();
  require(game.chapter===1,'M1 delivery');

  objective();
  const route = [[44,140],[44,83],[44,44],[40,44],[-31,44],[-44,44],[-44,1]];
  const speed = 8;
  let distance = 0;
  for (let i=1;i<route.length;i++) {
    const [x,z] = route[i-1], [endX,endZ] = route[i];
    const length = Math.hypot(endX-x,endZ-z);
    const steps = Math.ceil(length);
    for (let step=1;step<=steps;step++) {
      const nextX = x+(endX-x)*step/steps, nextZ = z+(endZ-z)*step/steps;
      require(!hitsWorld(game.city,nextX,nextZ,1.2),'M2 world clearance');
      at(nextX,nextZ);
      game.time += length/steps/speed;
      updateMission();
    }
    distance += length;
  }
  require(game.chapter===2,'M2 checkpoint route');
  const checkpoint = {distance,speed,seconds:distance/speed,margin:90-distance/speed};

  objective();
  require(game.stage===0,'M3 requires the repo car');
  game.vehicle = game.city.repo;
  objective();
  require(game.stage===1,'M3 repossession');
  objective();
  require(game.chapter===3,'M3 delivery');
  game.vehicle.yaw = Math.PI;
  useCar();
  require(!game.vehicle,'M4 exit at chop shop');
  const roofStart = game.time;
  const start = [game.player.x,game.player.z];
  let maxPressure = 0;
  for (const [x,z] of [[start[0],44],[-66,44],[-66,66]]) {
    let steps = 0;
    while (Math.hypot(x-game.player.x,z-game.player.z)>.30 && steps++<2000) {
      game.cameraYaw = Math.atan2(x-game.player.x,z-game.player.z);
      keys.add('KeyW');
      keys.add('ShiftLeft');
      game.time += 1/30;
      walk(1/30);
      trafficUpdate(game.city,1/30,game.time);
      policeUpdate(1/30);
      const pressure = [game.player.x,game.player.z,game.health,game.contact];
      require(!resolveHealth(1/30),'M4 survives police approach at '+pressure.join(','));
      updateMission();
      maxPressure = Math.max(maxPressure,game.wanted);
    }
    require(steps<2000,'M4 walkable route near '+x+','+z+' from '+game.player.x+','+game.player.z);
  }
  keys.clear();
  require(game.chapter===4 && game.player.y===4 && maxPressure===2,'M4 roof with active police');
  const roof = {seconds:game.time-roofStart,health:game.health,wanted:maxPressure};

  game.vehicle = game.city.repo;
  objective();
  require(game.stage===1,'M5 diner');
  game.vehicle.speed = 4;
  objective();
  require(game.stage===1,'M5 requires stopping at bank');
  game.vehicle.speed = 0;
  objective();
  require(game.stage===2 && game.wanted>=3,'M5 starts vault wait');
  at(0,-38);
  game.time += 1;
  updateMission();
  require(game.deadline===game.time+20,'M5 leaving bank restarts wait');
  at(0,-66);
  game.time += 5;
  saveGame();
  reset('play',readSave());
  require(game.chapter===4 && game.stage===2 && game.vehicle===game.city.repo &&
    game.deadline===15 && game.cash===4350,'save/load vehicle, mission, cash and time');
  game.time = 14.99;
  updateMission();
  require(game.stage===2,'M5 vault waits until deadline');
  game.time = 15;
  updateMission();
  require(game.stage===3,'M5 vault opens');
  objective();
  require(game.chapter===STORY.length && game.earnings===6850,'M5 delivery and story earnings');
  game.time = game.storyAt;
  frame(0);
  require(game.mode==='story' && !ui.story.hidden,'story completion screen');
  ui.free.onclick();
  require(game.mode==='play' && game.chapter===STORY.length,'continue free roam');
  return {checkpoint,roof};
})()`);
console.log('Movement, car entry/exit, crime, patrol counts, punch, pistol, five missions, save/load, and story passed');
console.log('Route measurements',missionResults);
