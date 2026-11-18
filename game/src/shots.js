'use strict';

function stageShot(game, name) {
  const {city,player} = game;
  const hero = city.cars.find(car => car.x===3.6 && car.z===157);
  if (name==='start') {
    Object.assign(player,{x:5.35,z:157.4,yaw:2.45});
    game.palette = DAYLIGHT.gold;
    game.cinematic = {eye:[7.8,4.7,168.5],target:[-.2,3.7,147]};
  } else if (name==='play') {
    Object.assign(hero,{x:2.65,z:100,yaw:Math.PI,speed:15});
    const patrol = carAt(-.7,106,Math.PI,0,0x274464,true);
    const crossTraffic = carAt(-9,86.6,Math.PI/2,1,0xe8ba76);
    city.cars.push(patrol,crossTraffic);
    game.shotTraffic = [patrol,crossTraffic];
    game.vehicle = hero;
    game.wanted = 2;
    game.mode = 'play';
    game.cinematic = {eye:[9.8,6.5,115],target:[.4,1.05,99.5]};
  } else if (name==='end') {
    Object.assign(hero,{x:42,z:177,yaw:-1.2});
    Object.assign(player,{x:44,z:178.8,yaw:2.4});
    game.chapter = STORY.length;
    game.notice = {title:'MISSION COMPLETE',detail:'First Pickup · +$750'};
    game.cash = 750;
    game.banner = Infinity;
    game.mode = 'play';
    game.palette = DAYLIGHT.dusk;
    game.cinematic = {eye:[48.3,3.7,189],target:[40.5,3.55,167]};
  }
}

function tickShot(game) {
  const [patrol, crossTraffic] = game.shotTraffic;
  // The staged cars circulate locally so the composition remains available for capture.
  const drift = Math.sin(game.time*.65);
  game.vehicle.z = 100-2.5*drift;
  patrol.z = game.vehicle.z+6;
  crossTraffic.x = -8+4*Math.sin(game.time*.82);
}
