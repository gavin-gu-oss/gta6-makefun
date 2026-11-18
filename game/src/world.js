'use strict';

const BLOCK = 44;
const EDGE = BLOCK*4;
const ROAD = 12;
const MODELS = [
  {name:'Comet S', width:2.05, length:4.55, roof:.77, max:29},
  {name:'Mule', width:2.28, length:5.20, roof:1.02, max:25},
  {name:'Falcon GT', width:2.16, length:4.35, roof:.53, max:36},
];
const CAR_COLORS = [0x40a9a3,0xd4b369,0xf06543,0x457eb2,0xc4cdce,0x913d59,0x42535b];
const DAYLIGHT = {
  day:{fog:[.72,.82,.85],zenith:[.23,.61,.84],sun:[.55,.66,.076],light:[1,.98,.91]},
  gold:{fog:[.94,.70,.55],zenith:[.31,.55,.72],sun:[.61,.42,.093],light:[1.13,.92,.75]},
  dusk:{fog:[.79,.49,.53],zenith:[.23,.30,.58],sun:[.56,.35,.083],light:[.98,.75,.81]},
};

function mulberry32(seed) {
  return () => {
    seed = (seed+0x6D2B79F5)|0;
    let bits = Math.imul(seed^(seed>>>15),seed|1);
    bits ^= bits+Math.imul(bits^(bits>>>7),bits|61);
    return ((bits^(bits>>>14))>>>0)/4294967296;
  };
}

function carAt(x,z,yaw,kind,color,police = false) {
  return {x,z,yaw,kind,color,police,speed:0};
}

function palm(mesh,x,z,height,yaw) {
  mesh.box(x,.19,z,.38,height,.40,0x9d765b,yaw);
  for (let i=0;i<7;i++) {
    const angle = yaw+i*TAU/7;
    const [fx,fz] = forwardOf(angle), [rx,rz] = rightOf(angle);
    const base = [x,height+.38,z];
    const tip = [x+fx*3.1,height-.65,z+fz*3.1];
    const left = [x+fx*1.45-rx*.63,height+.25,z+fz*1.45-rz*.63];
    const right = [x+fx*1.45+rx*.63,height+.25,z+fz*1.45+rz*.63];
    const ridge = [x+fx*1.5,height+.69,z+fz*1.5];
    const green = tint(i%2 ? 0x52894d : 0x377c55);
    mesh.quad(base,left,tip,ridge,green,.83);
    mesh.quad(base,ridge,tip,right,green,1.13);
  }
}

function lamp(mesh,x,z,yaw) {
  const [dx,dz] = forwardOf(yaw);
  mesh.box(x,.18,z,.20,5.4,.20,0x465665);
  mesh.box(x+dx*.6,5.35,z+dz*.6,.18,.16,1.4,0x465665,yaw);
  mesh.box(x+dx*1.18,5.25,z+dz*1.18,.43,.15,.62,0xffe3a1,yaw);
}

function route(points, speed, phase, actor) {
  return {points,index:1,offset:0,cruise:speed,pace:speed,actor,phase};
}

function advancePath(path, dt) {
  const { points, actor } = path;
  let distance = dt*path.pace;
  while (true) {
    const from = points[(path.index+points.length-1)%points.length];
    const to = points[path.index];
    const dx = to[0]-from[0], dz = to[1]-from[1], length = Math.hypot(dx,dz);
    if (distance+path.offset < length) {
      path.offset += distance;
      actor.x = from[0]+dx*path.offset/length;
      actor.z = from[1]+dz*path.offset/length;
      actor.yaw = Math.atan2(dx,dz);
      return;
    }
    distance -= length-path.offset;
    path.offset = 0;
    path.index = (path.index+1)%points.length;
  }
}

function makeCity(seed) {
  const rng = mulberry32(seed);
  const pick = values => values[Math.floor(rng()*values.length)];
  const mesh = new Mesh(), solids = [], buildings = [], cars = [], traffic = [], walkers = [], signals = [];
  const box = (x,y,z,w,h,d,color,windows=false) => {
    mesh.box(x,y,z,w,h,d,color,0,windows);
    solids.push({x,z,hw:w/2,hd:d/2});
  };
  mesh.box(0,-.7,0,364,.66,364,0x4d5965);
  mesh.box(0,-1.1,196,434,1.05,31,0xdfbd83);
  mesh.box(0,-1,218,530,.92,15,0xdaca97);
  mesh.box(0,-1.9,440,1350,1.44,455,0x398d9e);
  for (let i=0;i<110;i++) {
    mesh.box(rng()*650-325,-.455,215+rng()*180,2+rng()*19,.018,.10, pick([0x89c9c3,0x55a6ad,0x6cb7bb]));
  }
  for (let i=-4;i<=4;i++) {
    const road = i*BLOCK;
    for (let j=-4;j<4;j++) {
      for (const offset of [10,17,24,31,37]) {
        const mark = j*BLOCK+offset;
        mesh.box(road,.003,mark,.10,.025,2.5,0xdab269);
        mesh.box(mark,.003,road,2.5,.025,.10,0xdab269);
      }
    }
    for (let j=-4;j<=4;j++) {
      const crossing = j*BLOCK;
      if (Math.abs(i)<4 && Math.abs(j)<4) {
        signals.push({x:road,z:crossing});
        for (const [dx,dz] of [[-6.5,-7.2],[6.5,7.2]]) {
          mesh.box(road+dx,.18,crossing+dz,.18,3.5,.18,0x33434c);
          mesh.box(road+dx,3.58,crossing+dz,.6,1.1,.6,0x24313b);
        }
      }
      for (let k=-4;k<=4;k++) {
        mesh.box(road+k*1.19,.009,crossing-6.15,.60,.019,1.75,0xe5e3d6);
        mesh.box(crossing-6.15,.009,road+k*1.19,1.75,.019,.60,0xe5e3d6);
        mesh.box(road+k*1.19,.009,crossing+6.15,.60,.019,1.75,0xe5e3d6);
      }
    }
  }
  const facades = [0xe6c0a4,0xf2d4a9,0xa3b5b5,0xd68872,0x9fbfac,0xc4c2bd,0xb0a7bd];
  for (let i=-4;i<4;i++) for (let j=-4;j<4;j++) {
    const x = (i+.5)*BLOCK, z = (j+.5)*BLOCK;
    mesh.box(x,-.05,z,32,.24,32,0xa7a8a0);
    mesh.box(x,.18,z,25,.055,25,0xbab2a1);
    const isPlaza = (i===0 && j===3) || (i===1 && j===3) || (i===-2 && j===1) || (i===1 && j===-2);
    if (isPlaza) {
      mesh.box(x,.24,z,19,.07,19,0x7b9c6f);
      for (const side of [-1,1]) {
        box(x+side*7,.26,z,1.45,.45,4.5,0x89715b);
        palm(mesh,x+side*7,z+6,5.9,side);
        solids.push({x:x+side*7,z:z+6,hw:.26,hd:.26});
      }
    } else {
      for (const side of [-1,1]) {
        const bx = x+side*6.5, bz = z+(rng()-.5)*5;
        const w = 8+rng()*3.5, d = 11+rng()*10;
        const downtown = Math.abs(i+.5)<2 && j<1;
        const h = 6+rng()*(downtown ? 37 : 17);
        const color = pick(facades);
        box(bx,.23,bz,w,h,d,color,true);
        buildings.push({x:bx,z:bz,w,d,h});
        mesh.box(bx,h+.22,bz,w+.23,.38,d+.23,color);
        if (h>20) mesh.box(bx,h+.6,bz,w*.58,1+rng()*2,d*.6,0xa7a7a1);
      }
    }
    const px = x-13.8, pz = z+11.3;
    palm(mesh,px,pz,5+rng()*3,rng()*TAU);
    solids.push({x:px,z:pz,hw:.22,hd:.22});
    lamp(mesh,x+14,z-12,Math.PI/2);
    solids.push({x:x+14,z:z-12,hw:.13,hd:.13});
    if ((i-j)%4===0) {
      mesh.box(x-14,.19,z-4,.42,.63,.42,0xd45e48);
      mesh.box(x-14,.79,z-4,.51,.16,.51,0xffaa70);
      mesh.box(x+8,.47,z-14,3.3,.12,.65,0xa87555);
      mesh.box(x+8,.59,z-14.31,3.3,.49,.11,0xa87555);
      for (const dx of [-1.2,1.2]) mesh.box(x+8+dx,.19,z-14,.12,.28,.50,0x465665);
    }
    if ((i+j)%6===0) {
      for (const dx of [-1.7,1.7]) mesh.box(x+dx,.18,z+14.5,.15,2.62,.15,0x345465);
      mesh.box(x,2.78,z+14,4.1,.16,1.65,0x43837d);
      mesh.box(x,.71,z+14.5,3.5,1.9,.10,0x6995a1);
    }
    if (rng()<.52 && !(i===0 && j>=2)) {
      cars.push(carAt(x-17.3,z,Math.PI,Math.floor(rng()*3),pick(CAR_COLORS)));
    }
    if (i>-4 && (i+j)%2===0) {
      const shirt = pick([0xb05f44,0xe7bc69,0x739f9f,0xa78ec0,0x405b7e]);
      walkers.push(route([[x-15,z-15.85],[x-15,z+15.85],[x-29,z+15.85],[x-29,z-15.85]],
        1.1+rng()*.7,rng()*60,{shirt,skin:pick([0xbd865e,0x83513d,0xebad86])}));
    }
  }
  mesh.box(0,-.06,184,363,.24,3.5,0xc6bfb0);
  for (let x=-171;x<=171;x+=14) {
    palm(mesh,x,190,6+rng()*2,rng()*TAU);
    solids.push({x,z:190,hw:.25,hd:.25});
    lamp(mesh,x+2,184,0);
    solids.push({x:x+2,z:184,hw:.13,hd:.13});
  }
  const pierX = 61;
  mesh.box(pierX,-.35,221,8,.45,61,0xa27b59);
  for (let z=193;z<=250;z+=1.2) mesh.box(pierX,.105,z,7.95,.04,.075,0x735f50);
  for (const side of [-1,1]) {
    box(pierX+side*3.9,.11,221,.16,1.04,61,0xdfc29b);
    for (let z=193;z<=250;z+=5) mesh.box(pierX+side*3.86,-.9,z,.27,2.30,.27,0x896c53);
  }
  box(pierX,.1,251,8,1,.18,0xdfc29b);
  for (let i=0;i<46;i++) {
    const x = rng()*540-270, z = -235-rng()*160;
    mesh.box(x,-1,z,9+rng()*16,12+rng()*62,8+rng()*16,pick([0x7e97a2,0x91a6ac,0x8498ad]));
  }
  mesh.box(0,-.8,-255,650,.7,224,0x818f87);

  cars.push(carAt(3.6,157,Math.PI,2,0xfa694b),carAt(-4.15,160,0,0,0x41a7a7),
    carAt(46.5,154,Math.PI,1,0xe9bd70));
  for (let i=0;i<12;i++) {
    const band = i%4, column = Math.floor(i/4);
    const left = (-4+column*3)*BLOCK, right = left+3*BLOCK;
    const top = (-4+band*2)*BLOCK, bottom = top+2*BLOCK;
    const points = [[left-2.6,top-2.6],[right+2.6,top-2.6],[right+2.6,bottom+2.6],[left-2.6,bottom+2.6]];
    const actor = carAt(0,0,0,i%3,pick(CAR_COLORS));
    traffic.push(route(points,8+rng()*5,3+rng()*20,actor));
    cars.push(actor);
  }
  const repo = carAt(68,195,Math.PI/2,2,0xe5ae46);
  repo.damage = 0;
  cars.push(repo);
  mesh.box(ROOFTOP.x,.18,ROOFTOP.z,ROOFTOP.w,ROOFTOP.h-.18,ROOFTOP.d,0xb98368);
  for (let step=0;step<15;step++) {
    const depth = (RAMP.top-RAMP.foot)/15;
    mesh.box(RAMP.x,.18,RAMP.foot+depth*(step+.5),3,ROOFTOP.h*(step+1)/15,depth+.02,0xc7ad8e);
  }
  for (const [x,z,label] of [[15,181,'VISIT PORT SOLANO'],[-51,-94,'POLICE'],[94,7,'HOSPITAL'],
    [94,61,'CHOP SHOP'],[50,-20,'DINER'],[-6,-65,'BANK'],[-94,-112,'SAFE HOUSE']]) {
    billboard(mesh,x,z,label);
  }
  for (const path of [...traffic,...walkers]) advancePath(path,path.phase);
  return {mesh,solids,buildings,cars,traffic,walkers,signals,repo,police:[],rng};
}

function carMesh(mesh,car,time,dusk=false,passenger=false) {
  const {x,z,yaw,kind,police} = car;
  const color = car.flash>time ? 0xffd595 : car.color;
  const {width:w,length:d,roof} = MODELS[kind];
  const [fx,fz] = forwardOf(yaw), [rx,rz] = rightOf(yaw);
  const part = (side,y,along,width,height,length,hex) =>
    mesh.box(x+rx*side+fx*along,y,z+rz*side+fz*along,width,height,length,hex,yaw);
  blob(mesh,x,.035,z,w*.67,d*.60,yaw);
  part(0,.40,0,w,.53,d,color);
  part(0,.33,0,w*.86,.19,d*1.01,0x263540);
  const cabin = kind===1 ? .28 : -.12;
  const cabinLength = kind===1 ? d*.39 : d*.47;
  if (passenger) {
    part(-w*.15,.90,cabin,w*.54,roof,cabinLength,0x2c4e60);
    part(w*.27,.90,cabin-cabinLength*.30,w*.30,roof,cabinLength*.40,0x2c4e60);
    const side = w*.28, along = cabin+cabinLength*.17;
    personMesh(mesh,{x:x+rx*side+fx*along,z:z+rz*side+fz*along,yaw,
      seatedRoof:roof,shirt:0xe7b153,skin:0x9b6047},time);
  } else part(0,.90,cabin,w*.84,roof,cabinLength,0x2c4e60);
  part(0,.89+roof,cabin,w*.87,.105,cabinLength+.07,color);
  if (kind===1) {
    for (const side of [-1,1]) part(side*w*.43,.91,-d*.33,.16,.21,d*.33,color);
    part(0,.91,-d*.47,w,.20,.15,color);
  }
  if (kind===2) part(0,.95,-d*.43,w*.92,.09,.33,0x572b33);
  for (const side of [-1,1]) {
    part(side*w*.32,.65,d*.5,.45,.17,.06,0xffe6ad);
    part(side*w*.32,.63,-d*.5,.43,.15,.055,car.braking ? 0xff351d : 0x9d3238);
    part(side*w*.48,.18,d*.32,.33,.59,.69,0x242b33);
    part(side*w*.48,.18,-d*.32,.33,.59,.69,0x242b33);
    part(side*w*.48,.36,d*.32,.36,.21,.31,0x969fa5);
    part(side*w*.48,.36,-d*.32,.36,.21,.31,0x969fa5);
    part(side*w*.43,.91,cabin,w*.045,roof*.82,.12,color);
  }
  if (dusk) for (const side of [-1,1]) {
    const beam = (offset,distance) => [x+rx*(side*w*.32+offset)+fx*distance,.038,z+rz*(side*w*.32+offset)+fz*distance];
    mesh.quad(beam(-.12,d/2),beam(.12,d/2),beam(.8,d/2+5),beam(-.8,d/2+5),tint(0xe5bd80),.82);
  }
  if (police) {
    part(0,.52,0,w*1.012,.28,d*.47,0xd5dfdf);
    part(-.31,.99+roof,cabin,.59,.19,.32,time% .48<.24 ? 0xff4947 : 0xa22d44);
    part(.31,.99+roof,cabin,.59,.19,.32,time% .48<.24 ? 0x375aa6 : 0x58bbff);
  }
}

function personMesh(mesh,person,time,hero=false,phaseOffset=0) {
  const {x,z,yaw} = person, y = (person.y || 0)+.20;
  const [fx,fz] = forwardOf(yaw), [rx,rz] = rightOf(yaw);
  const phase = Math.sin((time+phaseOffset)*(hero && person.running ? 12 : 8))*(hero && !person.walking ? 0 : .22);
  const shirt = person.flash>time ? 0xffda8a : hero ? 0xea6948 : person.shirt;
  const skin = hero ? 0xbc805e : person.skin;
  if (person.seatedRoof) {
    const roof = person.seatedRoof;
    mesh.oval(x,.90+roof*.23,z,.21,roof*.25,.15,shirt);
    mesh.oval(x,.90+roof*.69,z,.13,roof*.26,.13,skin);
    return;
  }
  blob(mesh,x,y-.008,z,.43,.36,yaw);
  if (person.downUntil>time) {
    mesh.box(x,.22,z,.59,.23,1.25,shirt,yaw);
    mesh.oval(x+fx*.76,.33,z+fz*.76,.17,.15,.17,skin);
    return;
  }
  mesh.oval(x,y+1.09,z,.30,.43,.20,shirt);
  mesh.oval(x,y+1.66,z,.166,.195,.157,skin);
  mesh.oval(x-fx*.045,y+1.75,z-fz*.045,.174,.14,.166,hero ? 0x2a2434 : 0x433437);
  for (const side of [-1,1]) {
    const step = phase*side, lx = x+rx*side*.127, lz = z+rz*side*.127;
    mesh.box(lx+fx*step*.5,y+.12+Math.max(0,step)*.35,lz+fz*step*.5,.19,.58,.20,0x283747,yaw);
    mesh.box(lx+fx*step,y+.015+Math.max(0,step)*.35,lz+fz*step,.22,.13,.32,0xe1d8bd,yaw);
    const ax = x+rx*side*.32-fx*step*.6, az = z+rz*side*.32-fz*step*.6;
    mesh.box(ax,y+.83,az,.15,.41,.15,shirt,yaw);
    mesh.box(ax,y+.73,az,.14,.15,.14,skin,yaw);
  }
}

function hitsWorld(city,x,z,radius) {
  const pier = x>57+radius && x<65-radius && z>190 && z<251-radius;
  if (x < -181+radius || x > 181-radius || z < -180+radius || (z > 215-radius && !pier)) return true;
  if (radius>.55 && Math.abs(x-ROOFTOP.x)<ROOFTOP.w/2+radius &&
    z>RAMP.foot-radius && z<ROOFTOP.z+ROOFTOP.d/2+radius) return true;
  return city.solids.some(s => Math.abs(x-s.x)<s.hw+radius && Math.abs(z-s.z)<s.hd+radius);
}

function hitsCarBody(car,x,z,radius) {
  const dx = x-car.x, dz = z-car.z;
  const [rx,rz] = rightOf(car.yaw), [fx,fz] = forwardOf(car.yaw);
  const {width,length} = MODELS[car.kind];
  return Math.abs(dx*rx+dz*rz)<width/2+radius && Math.abs(dx*fx+dz*fz)<length/2+radius;
}

function hitsCar(city,x,z,radius,ignored) {
  return city.cars.some(car => car!==ignored && hitsCarBody(car,x,z,radius));
}

function blob(mesh,x,y,z,width,length,yaw) {
  const rgb = tint(0x343d43);
  const [rx,rz] = rightOf(yaw), [fx,fz] = forwardOf(yaw);
  const point = angle => [
    x+rx*Math.cos(angle)*width+fx*Math.sin(angle)*length,y,
    z+rz*Math.cos(angle)*width+fz*Math.sin(angle)*length,
  ];
  for (let i=0;i<10;i++) {
    for (const vertex of [[x,y,z],point(i*TAU/10),point((i+1)*TAU/10)]) mesh.vertex(vertex,rgb,1);
  }
}

const SIGN_GLYPHS = {
  A:[2,5,7,5,5], B:[6,5,6,5,6], C:[3,4,4,4,3], D:[6,5,5,5,6], E:[7,4,6,4,7],
  F:[7,4,6,4,4], H:[5,5,7,5,5], I:[7,2,2,2,7], K:[5,5,6,5,5], L:[4,4,4,4,7],
  N:[5,7,7,7,5], O:[2,5,5,5,2], P:[6,5,6,4,4], R:[6,5,6,5,5], S:[3,4,2,1,6],
  T:[7,2,2,2,2], U:[5,5,5,5,7], V:[5,5,5,5,2],
};

function billboard(mesh,x,z,label) {
  const unit = label.length>12 ? .15 : .12;
  const width = unit*label.length*4+.6;
  mesh.box(x,.18,z,.23,4,.23,0x455967);
  mesh.box(x,3.55,z,width,unit*5+.38,.23,0x28676a);
  for (const side of [-1,1]) {
    for (let letter=0;letter<label.length;letter++) {
      const glyph = SIGN_GLYPHS[label[letter]];
      if (!glyph) continue;
      for (let row=0;row<5;row++) for (let column=0;column<3;column++) {
        if (!(glyph[row] & (4>>column))) continue;
        const px = x+side*(letter*4+column-label.length*2)*unit;
        mesh.box(px,3.73+(4-row)*unit,z+side*.12,unit*.94,unit*.94,.022,0xffe6ad);
      }
    }
  }
}

function streetLights(mesh,city,time) {
  for (const {x,z} of city.signals) {
    for (const [dx,dz] of [[-6.5,-7.2],[6.5,7.2]]) {
      const sign = Math.sign(dx);
      const horizontal = signalColor(x,z,true,time);
      const vertical = signalColor(x,z,false,time);
      for (const [index,name,color] of [[0,'green',0x55f391],[1,'yellow',0xffc254],[2,'red',0xff473e]]) {
        const y = 3.68+index*.3;
        mesh.box(x+dx+sign*.31,y,z+dz,.04,.18,.24,horizontal===name ? color : 0x485658);
        mesh.box(x+dx,y,z+dz+sign*.31,.24,.18,.04,vertical===name ? color : 0x485658);
      }
    }
  }
}

function duskWindows(mesh,city) {
  for (const [index,b] of city.buildings.entries()) {
    for (let row=1;row*3+1<b.h;row++) {
      if ((index+row*3)%5>1) continue;
      const x = b.x+((index+row)%3-1)*b.w*.27;
      mesh.box(x,row*3,b.z+b.d/2+.02,1.5,1.25,.04,0xffcd82);
      mesh.box(x,row*3,b.z-b.d/2-.02,1.5,1.25,.04,0xffcd82);
    }
  }
}
