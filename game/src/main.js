import { Renderer, Geometry } from './render.js';
import { createWorld, carGeometry, personGeometry } from './world.js';
import { createState, step, interact, notify, followCamera, resolveBody } from './simulation.js';
import { Input } from './input.js';
import { stageShot, releaseShot } from './shots.js';
import { marker, objective, loadSave, saveGame, introduce, missionIndex, MISSIONS, hasDante } from './missions.js';
import { signal } from './ai.js';
import { Sound } from './audio.js';
import { BLOCK, MIN, MAX, MODELS } from './config.js';
import { clamp, distance } from './random.js';

const $=id=>document.getElementById(id);
let game,input,renderer,storage;
function fail(error){$('error-message').textContent=error.message||String(error);$('error').hidden=false;console.error(error);}
try {
  try{storage=localStorage;}catch{storage=null;}
  const query=new URLSearchParams(location.search),seed=Number(query.get('seed')??1)>>>0;
  const world=createWorld(seed),actors=structuredClone({cars:world.cars,peds:world.peds});game=createState(world);
  const sound=new Sound();
  for(const gesture of ['pointerdown','keydown'])addEventListener(gesture,()=>sound.resume());
  document.addEventListener('click',event=>{if(event.target.closest('button'))sound.play('click');});
  renderer=new Renderer($('scene'),world.geometry);world.geometry=null;
  const saved=loadSave(storage);$('continue').hidden=!saved;
  stageShot(game,query.get('shot')||'start');
  if(!game.shot)stageShot(game,'start');
  function mute(){const muted=sound.toggle();$('mute').textContent=`M / SOUND ${muted?'OFF':'ON'}`;}
  input=new Input($('scene'),pause,()=>{release();interact(game);},()=>persist(),mute);
  input.yaw=game.car?.yaw||Math.PI;
  input.active=game.started;
  function release(){if(game.shot&&!game.shotReleased){releaseShot(game);input.yaw=game.car?.yaw||game.player.yaw;}}
  function persist(){if(!game.started||!game.shotReleased&&game.shot)return;const ok=saveGame(game,storage);notify(game,ok?'Progress saved. The city will be here.':'Saving is unavailable in this browser session.');$('save-result').textContent=ok?'PROGRESS SAVED':'STORAGE UNAVAILABLE — YOU CAN KEEP PLAYING';}
  function pause(force=false) {
    if(!game.started||game.storyScreen)return;
    game.paused=force===true?true:!game.paused;input.active=!game.paused;input.clear();$('pause').hidden=!game.paused;
    if(game.paused)sound.silence();
    if(game.paused&&document.pointerLockElement)document.exitPointerLock();
  }
  function begin(continuing=false) {
    Object.assign(world,structuredClone(actors));game=createState(world);game.shotReleased=true;game.started=true;game.dusk=.12;
    const hero=world.cars.find(c=>c.id==='hero');hero.speed=0;
    Object.assign(game.player,{x:hero.x-2.1,z:hero.z,y:0,vy:0,yaw:hero.yaw,moving:false});
    if(continuing) {
      const s=loadSave(storage);
      if(s){
        const progress=['cash','health','mission','wanted','stage','timer','vaultTime','ammo','earnings','storyComplete'];
        for(const key of progress)game[key]=s[key];
        Object.assign(game.player,{x:s.x,z:s.z,y:s.y,yaw:s.yaw});
        const repo=world.cars.find(c=>c.id==='repo');repo.damage=s.repoDamage;
        const restoredCar=s.mission===3&&s.stage===1?repo:s.mission===5&&s.stage>0?hero:null;
        if(restoredCar){Object.assign(restoredCar,{x:s.x,z:s.z,yaw:s.yaw,owned:true});game.car=restoredCar;}
        resolveBody(world,game.player,.34,.34,game.car);
      }
    }
    input.yaw=game.player.yaw;input.active=true;input.clear();game.camera=null;
    $('start').hidden=true;$('hud').hidden=false;$('pause').hidden=true;
    introduce(game);notify(game,continuing?'Welcome back, Rae.':'MARA QUINN  /  Take that Falcon. Your first pickup is at Mariner Market.',7);
    persist();
  }
  $('begin').onclick=()=>begin();$('continue').onclick=()=>begin(true);$('resume').onclick=()=>pause();$('save').onclick=()=>persist();
  $('free-roam').onclick=()=>{
    game.storyScreen=false;input.clear();input.active=true;$('story').hidden=true;
    notify(game,'You earned this morning, Rae. Port Solano is open.',6);persist();
  };
  $('menu').onclick=()=>{
    persist();game.started=false;game.paused=false;game.car=null;game.banner=0;stageShot(game,'start');input.active=false;input.clear();$('pause').hidden=true;$('start').hidden=false;$('hud').hidden=true;$('continue').hidden=!loadSave(storage);
  };
  addEventListener('keydown',e=>{if(input.active&&['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyF'].includes(e.code))release();});
  $('scene').addEventListener('pointerdown',()=>{if(input.active)release();});
  addEventListener('pagehide',()=>{if(game.started&&(!game.shot||game.shotReleased))saveGame(game,storage);});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){sound.silence();if(game.started){pause(true);if(!game.shot||game.shotReleased)saveGame(game,storage);}}});
  $('scene').addEventListener('webglcontextlost',e=>{e.preventDefault();fail(Error('The graphics context was lost. Reload to continue from your last save.'));});
  const map=$('minimap').getContext('2d');
  function minimap() {
    const w=250,h=220,scale=.57,px=x=>18+(x-MIN)*scale,pz=z=>12+(z-MIN)*scale;
    map.fillStyle='#476162';map.fillRect(0,0,w,h);map.fillStyle='#2c7581';map.fillRect(px(177),0,w,h);map.fillStyle='#b8ad7c';map.fillRect(px(173),0,11,h);
    map.fillStyle='#8d9b8a';map.fillRect(px(176),pz(81),62,5);
    map.strokeStyle='#213b42';map.lineWidth=7;
    for(let n=MIN;n<=MAX;n+=BLOCK){map.beginPath();map.moveTo(px(n),pz(MIN-6));map.lineTo(px(n),pz(MAX+6));map.stroke();map.beginPath();map.moveTo(px(MIN-6),pz(n));map.lineTo(px(MAX+6),pz(n));map.stroke();}
    map.fillStyle='#82918a';for(const b of world.buildings)map.fillRect(px(b.x-b.w/2),pz(b.z-b.l/2),b.w*scale,b.l*scale);
    for(const car of world.cars){map.fillStyle=car.police?'#9bcaff':car===game.car?'#fff3c6':'#d7d8bc';map.fillRect(px(car.x)-1.4,pz(car.z)-1.4,2.8,2.8);}
    const m=marker(game);if(m){const x=px(m.x),z=pz(m.z);map.strokeStyle='#f8ca77';map.lineWidth=1;map.beginPath();map.arc(x,z,6+Math.sin(game.time*3),0,Math.PI*2);map.stroke();map.fillStyle='#ffd78b';map.save();map.translate(x,z);map.rotate(Math.PI/4);map.fillRect(-2.5,-2.5,5,5);map.restore();}
    const p=game.car||game.player;map.save();map.translate(px(p.x),pz(p.z));map.rotate(-p.yaw);map.beginPath();map.moveTo(0,7);map.lineTo(-4,-5);map.lineTo(0,-2);map.lineTo(4,-5);map.closePath();map.fillStyle='#88f2db';map.strokeStyle='#16363e';map.lineWidth=1.5;map.fill();map.stroke();map.restore();
  }
  function missionGeometry(g) {
    const target=marker(game);if(!game.started||!target)return;
    const floor=target.y||0,top=Math.max(14,floor+3),teal=[.43,.88,.77];
    for(let segment=0;segment<12;segment++) {
      const angle=segment*Math.PI/6;
      g.box(target.x+3*Math.sin(angle),floor+.31,target.z+3*Math.cos(angle),.6,.1,.6,teal,angle);
    }
    for(const offset of [-1.5,1.5])g.box(target.x+offset,top/2,target.z,.15,top-.5,.15,teal);
    g.box(target.x,top+.3*Math.sin(game.time*2),target.z,1.3,1.3,1.3,[1,.76,.38],game.time*.7);
    if(game.mission===4&&world.rooftop) {
      const {stairX,stairStart}=world.rooftop;g.box(stairX,1.2,stairStart,1.4,.18,2,[1,.74,.32]);
    }
  }
  function signalGeometry(g) {
    const lenses=[['red',[1,.19,.10]],['yellow',[1,.78,.13]],['green',[.26,.98,.54]]];
    for(const junction of world.signals)for(const side of [-1,1]) {
      const active=signal(game.time,junction.x,junction.z,side>0?'z':'x');
      lenses.forEach(([name,color],index)=>g.box(junction.x+7*side,4.8-.45*index,junction.z+7*side+.28,.4,.3,.08,active===name?color:[.13,.19,.17]));
    }
  }
  function movingGeometry() {
    const geometry=new Geometry();
    for(const car of world.cars)carGeometry(geometry,car,game.time,game.dusk,hasDante(game,car));
    for(const person of world.peds)personGeometry(geometry,person,game.time);
    if(!game.car)personGeometry(geometry,game.player,game.time,true);
    missionGeometry(geometry);signalGeometry(geometry);
    if(game.tracer) {
      const {x,y,z,ex,ez}=game.tracer;
      geometry.quad([x-.025,y,z],[x+.025,y,z],[ex+.025,y,ez],[ex-.025,y,ez],[0,1,0],[1,.85,.4]);
    }
    return geometry;
  }
  function systemsHud() {
    $('health').style.width=`${game.health}%`;$('ammo').textContent=`PISTOL / ${String(game.ammo).padStart(2,'0')}`;
    const job=missionIndex(game);
    $('job-name').textContent=game.mission>=6?'FREE ROAM':`${String(job+1).padStart(2,'0')} / ${MISSIONS[job].name.toUpperCase()}`;
    $('outcome').hidden=game.outcomeTime<=0;$('outcome-title').textContent=game.outcome;
    $('arrest').hidden=game.arrest<=0;$('arrest').textContent=`DETENTION / ${Math.round(50*game.arrest)}% · MOVE AWAY`;
    $('dialogue').hidden=game.dialogueTime<=0;
    $('dialogue-line').textContent=game.dialogue[game.dialogueTime>5.5?0:1]||'';
    $('completion-name').textContent=game.lastMission;$('completion-reward').textContent=`+$${game.lastReward.toLocaleString('en-US')}`;
    $('story').hidden=!game.storyScreen;$('story-earnings').textContent=`$${game.earnings.toLocaleString('en-US')}`;
    if(game.storyScreen){input.clear();input.active=false;}
    const stars=Array.from({length:5},(_,index)=>`<span class="${index<game.wanted?'lit':''}">★</span>`);
    $('wanted').innerHTML=stars.join('');$('wanted').setAttribute('aria-label',`Wanted level ${game.wanted} of 5`);
  }
  function hud() {
    $('start').hidden=game.started;$('hud').hidden=!game.started;$('complete').hidden=!game.started||game.banner<=0;
    if(!game.started){$('outcome').hidden=true;$('story').hidden=true;}
    if(!game.started)return;
    const p=game.car||game.player,m=marker(game);
    $('cash').textContent='$'+game.cash.toLocaleString('en-US');systemsHud();
    $('objective').textContent=objective(game);$('district').textContent=p.x>120?'SOLANO COAST':p.z<-50?'MARINER DISTRICT':'OLD TOWN';$('clock').innerHTML=game.dusk>.5?'19:18 <small>◒</small>':'17:42 <small>☀</small>';
    $('speed').hidden=!game.car;
    if(game.car){$('car-model').textContent=MODELS[game.car.model].name.toUpperCase();$('speed-value').textContent=String(Math.round(Math.abs(game.car.speed)*3.6)).padStart(3,'0');$('gear').textContent=(game.car.speed<-.2?'R':Math.abs(game.car.speed)<.2?'N':Math.min(5,1+Math.floor(Math.abs(game.car.speed)/9)))+'  /  REAR WHEEL DRIVE';}
    const bindings=game.car?[['W/S','DRIVE'],['A/D','STEER'],['SPACE','BRAKE'],['E','EXIT'],['P','PAUSE']]:[['WASD','MOVE'],['E','CAR'],['SHIFT','RUN'],['SPACE','JUMP'],['F','PUNCH'],['CLICK','FIRE'],['P','PAUSE']];
    $('controls').innerHTML=bindings.map(([key,label])=>`<span><kbd>${key}</kbd> ${label}</span>`).join('');
    $('notice').hidden=game.noticeTime<=0;$('notice').textContent=game.notice;
    const near=!game.car?world.cars.find(c=>distance(p,c)<4&&Math.abs(c.speed)<12):null;
    $('interact').hidden=!near;$('interact').textContent=near?'E  /  DRIVE '+MODELS[near.model].name.toUpperCase():'';
    $('pickup-progress').style.display=game.pickupTime>0?'block':'none';$('pickup-progress').firstElementChild.style.width=clamp(game.pickupTime/1.1*100,0,100)+'%';
    $('map-target').textContent=m?'◆ '+Math.round(distance(p,m))+' m':'✓ FREE ROAM';
    const point=m?renderer.project(m.x,Math.max(14,(m.y||0)+3),m.z):null;
    $('beacon-label').hidden=!point||point.x<300||point.x>innerWidth-100||point.y<180||point.y>innerHeight-90;
    if(point){$('beacon-label').style.left=point.x+'px';$('beacon-label').style.top=point.y+'px';$('marker-name').textContent=m.name.toUpperCase();$('marker-distance').textContent=Math.round(distance(p,m))+' m';}
    minimap();
  }
  let last=performance.now(),acc=0,saveClock=0,frame=0,savedRevision=0;
  function loop(now) {
    try {
      const dt=Math.min((now-last)/1000,.08);last=now;acc+=dt;
      while(acc>=1/60){if(!game.storyScreen)step(game,input,1/60);acc-=1/60;}
      sound.update(game);
      const camera=game.stageCamera||followCamera(game,input,dt);
      renderer.render(camera,movingGeometry(),game.dusk||0);
      if(frame++%3===0)hud();
      if(game.missionRevision!==savedRevision){savedRevision=game.missionRevision;if(game.started&&(!game.shot||game.shotReleased))saveGame(game,storage);}
      saveClock+=dt;if(saveClock>12){saveClock=0;if(game.started&&!game.paused&&(!game.shot||game.shotReleased))saveGame(game,storage);}
      requestAnimationFrame(loop);
    }catch(error){fail(error);}
  }
  requestAnimationFrame(loop);
  // Read-only diagnostic snapshot for offline QA; simulation modules remain directly testable.
  globalThis.solano={snapshot:()=>({started:game.started,paused:game.paused,driving:game.car?.id||null,x:(game.car||game.player).x,z:(game.car||game.player).z,y:game.player.y,cash:game.cash,mission:game.mission,wanted:game.wanted,traffic:world.cars.filter(c=>c.traffic).length,pedestrians:world.peds.length,time:game.time,shot:game.shot,glError:renderer.gl.getError()})};
}catch(error){fail(error);}
