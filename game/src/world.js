import { Geometry } from './render.js';
import { mulberry32 } from './random.js';
import { BLOCK, MIN, MAX, ROAD, MODELS, PALETTE as P } from './config.js';

export function makeCar(id,x,z,model=0,yaw=0,color=null) {return {id,x,z,model,yaw,speed:0,color:color||MODELS[model].color,traffic:false,police:false,damage:0,disabled:0};}
export function createWorld(seed=1) {
  const rng=mulberry32(seed),g=new Geometry(),colliders=[],buildings=[],cars=[],peds=[],signals=[];let rooftop=null;
  const box=(x,y,z,w,h,l,c,tex=0)=>g.box(x,y,z,w,h,l,c,0,tex);
  const solid=(x,z,w,l,y=0,h=1,kind='building')=>colliders.push({x,z,w,l,y,h,kind});
  box(0,-0.55,0,430,1,410,P.sand);box(287,-0.38,0,190,0.4,1000,P.water);
  box(188,-0.01,0,37,0.12,390,P.sand);box(173,0.04,0,7,0.14,355,[0.66,0.59,0.45]);
  box(232,0.11,84,110,0.45,10,[0.51,0.41,0.28]);
  for(let x=182;x<285;x+=5)box(x,0.36,84,0.13,0.05,9.8,[0.33,0.28,0.21]);
  for(let x=187;x<285;x+=10)for(const z of [79,89]){box(x,0.8,z,.2,1.4,.2,[0.65,0.58,0.44]);box(x+4.5,1.15,z,9,.15,.12,[0.71,0.62,0.43]);}
  for(let z=-175;z<=175;z+=12){box(207,-0.12,z,1.5,.06,7,[0.64,0.80,0.72]);box(220,-0.15,z+6,.7,.04,5,[0.38,0.69,0.68]);}
  for(let i=0;i<=8;i++) {
    const n=MIN+i*BLOCK;
    box(n,0,0,ROAD,.10,352,P.road);box(0,.004,n,352,.10,ROAD,P.road);
    for(const side of [-1,1]){box(n+side*7.8,.12,0,3.6,.22,350,P.curb);box(0,.12,n+side*7.8,350,.22,3.6,P.curb);}
    for(let k=MIN+10;k<MAX;k+=9){box(n,.065,k,.17,.018,3.4,[.88,.74,.38]);box(k,.065,n,3.4,.018,.17,[.88,.74,.38]);}
    for(let j=0;j<=8;j++) {
      const m=MIN+j*BLOCK;
      box(n,.245,m,12.2,.025,12.2,P.road);
      for(let stripe=-4;stripe<=4;stripe+=2){box(n+stripe,.265,m+8,1,.022,3,[.84,.83,.68]);box(n+8,.265,m+stripe,3,.022,1,[.84,.83,.68]);}
      const junction={x:n,z:m};signals.push(junction);
      for(const offset of [-7,7]) {
        box(junction.x+offset,2.2,junction.z+offset,.15,4,.15,[.21,.27,.27]);
        box(junction.x+offset,4.3,junction.z+offset,.7,1.5,.5,[.12,.19,.21]);
      }
    }
  }
  const colors=[[.79,.67,.50],[.67,.75,.70],[.84,.57,.43],[.78,.77,.64],[.62,.68,.69],[.88,.79,.59]];
  for(let ix=0;ix<8;ix++)for(let iz=0;iz<8;iz++) {
    const cx=MIN+ix*BLOCK+21,cz=MIN+iz*BLOCK+21;
    if((ix===4&&iz===4)||(ix===7&&iz===5)) {
      box(cx,.28,cz,24,.2,24,[.69,.64,.49]);g.cylinder(cx,.72,cz,3.3,.85,[.72,.69,.57]);g.cylinder(cx,1.18,cz,2.7,.12,[.22,.64,.62]);solid(cx,cz,6.6,6.6,0,1.3,'fountain');
      for(const dx of [-8,8]){palm(g,cx+dx,cz+7,6);solid(cx+dx,cz+7,.7,.7,0,6,'palm');}continue;
    }
    const w=19+rng()*6,l=18+rng()*7,generatedHeight=7+rng()*23+(ix<3? rng()*19:0),h=ix===2&&iz===3?5:generatedHeight,color=colors[Math.floor(rng()*colors.length)];
    g.quad([cx-w/2,.25,cz-l/2],[cx+w/2,.25,cz-l/2],[cx+w/2+h*.47,.25,cz+l/2+h*.28],[cx-w/2+h*.47,.25,cz+l/2+h*.28],[0,1,0],[.40,.41,.35]);
    box(cx,h/2+.2,cz,w,h,l,color,1);solid(cx,cz,w,l,0,h);buildings.push({x:cx,z:cz,w,l,h});
    box(cx,h+.38,cz,w+.5,.6,l+.5,color.map(v=>v*.88));box(cx+2,h+1.1,cz-2,3.2,1.3,4,[.48,.53,.51]);
    if(ix===2&&iz===3) {
      const east=cx+w*.5+1.6,start=cz-l*.5-1,end=cz+l*.5;
      rooftop={x:cx,z:cz,w,l,y:h+.76,stairX:east,stairStart:start,stairEnd:end};
      const depth=(end-start)/28;
      for(let step=1;step<=28;step++) {
        const rise=rooftop.y*step/28;
        box(east,rise*.5,start+(step-.5)*depth,2.7,rise,depth,[.56,.68,.61]);
      }
      box((cx+east)*.5,rooftop.y-.1,end,east-cx+3,.2,3.8,[.23,.54,.49]);
      for(const z of [start,end])box(east+1.5,2.4,z,.2,4.4,.2,[.94,.69,.29]);
      box(cx,h+.75,cz,w-.3,.08,l-.3,[.22,.50,.46]);
    }
    box(cx,2.5,cz-l/2-.22,w+.4,.7,.7,[.17,.47,.45]);box(cx,1.3,cz-l/2-.25,2.1,2.4,.14,[.16,.29,.31]);
    if((ix+iz)%4===0)tourismSign(g,cx,cz-l/2);
  }
  for(let i=0;i<9;i++)for(let j=0;j<8;j++) {
    const x=MIN+i*BLOCK+8.2,z=MIN+j*BLOCK+20;
    if((i+j)%2===0){palm(g,x,z,6+rng()*2);solid(x,z,.65,.65,0,8,'palm');}
    box(x,3,z+10,.13,5.6,.13,[.22,.29,.28]);box(x-1.1,5.6,z+10,2.3,.16,.25,[.29,.33,.30]);box(x-2.1,5.5,z+10,.7,.14,.5,[1,.83,.47]);solid(x,z+10,.35,.35,0,5,'lamp');
    const furnishing=(i+j);
    if(furnishing%3===0) {
      box(x,.62,z-5,.45,.8,.45,[.84,.28,.17]);box(x,1.1,z-5,.6,.2,.6,[.97,.65,.32]);
      solid(x,z-5,.6,.6,0,1.2,'hydrant');
    }
    if(furnishing%4===0) {
      box(x,.7,z+4,1.5,.15,3,[.57,.42,.29]);box(x+.6,1.1,z+4,.15,.9,3,[.45,.36,.26]);
      solid(x,z+4,1.5,3,0,1.5,'bench');
    }
    if(i%3===0&&j%3===0) {
      const stopZ=z+2;box(x,2.7,stopZ,2.8,.18,5,[.21,.52,.50]);
      for(const end of [-2,2])box(x+1,1.5,stopZ+end,.12,2.6,.12,[.55,.65,.62]);
      box(x+1,1.4,stopZ,.1,2.3,4,[.33,.54,.57]);
    }
  }
  for(let z=-160;z<170;z+=18){palm(g,184,z,7+rng()*2);solid(184,z,.7,.7,0,9,'palm');}
  for(let z=-135;z<150;z+=30){box(193,.85,z,3.4,.12,1.6,[.87,.74,.49]);box(193,.4,z,2,.8,.16,[.50,.42,.31]);solid(193,z,3.4,1.6,0,1,'bench');}
  for(let i=0;i<24;i++){const h=18+rng()*65;box(-205-i%3*17,h/2,-220+i*19,12+rng()*10,h,12,[.40,.51,.53]);}
  cars.push(makeCar('hero',-3.1,17,2,Math.PI));
  const repo=makeCar('repo',164,58,2,Math.PI,[.98,.70,.19]);cars.push(repo);
  for(let i=0;i<20;i++) {
    const road=MIN+(1+Math.floor(rng()*7))*BLOCK,x=road+(i%2?4.15:-4.15),z=MIN+Math.floor(rng()*8)*BLOCK+16+rng()*11;
    cars.push(makeCar('park-'+i,x,z,i%3,i%2?0:Math.PI,colors[i%colors.length].map(v=>v*.75)));
  }
  for(let index=0;index<12;index++) {
    const lane=2.7,west=MIN+index%3*BLOCK+lane,east=MIN+(5+index%3)*BLOCK-lane;
    const north=MIN+index%2*BLOCK+lane,south=MIN+(5+index%3)*BLOCK-lane;
    const route=[{x:west,z:north},{x:east,z:north},{x:east,z:south},{x:west,z:south}];
    const next=(index%4+1)%4,from=route[index%4],to=route[next],fraction=.12+index%3*.27;
    const car=makeCar(`traffic-${index}`,from.x+(to.x-from.x)*fraction,from.z+(to.z-from.z)*fraction,index%3,Math.atan2(to.x-from.x,to.z-from.z));
    Object.assign(car,{route,next,traffic:true,cruise:6+index%4*1.2,speed:6});cars.push(car);
  }
  for(let i=0;i<24;i++) {
    const ix=2+i%5,iz=1+Math.floor(i/5),x=MIN+ix*BLOCK+8.2,z=MIN+iz*BLOCK+8.2;
    const route=[[0,0],[0,BLOCK],[BLOCK,BLOCK],[BLOCK,0]].map(([dx,dz])=>({x:x+dx,z:z+dz}));
    const phase=rng()*6.28,speed=1.1+rng()*.65,skin=[.65+rng()*.2,.43+rng()*.18,.29+rng()*.18];
    peds.push({x,z,yaw:0,phase,speed,route,next:1,color:colors[i%colors.length],skin});
  }
  return {seed,geometry:g,colliders,buildings,cars,peds,signals,rooftop};
}
function tourismSign(g,x,z) {
  g.box(x,7,z-1.2,10,3.2,.3,[.14,.35,.37]);
  const face=z-1.4;
  g.quad([x+4.8,5.5,face],[x-4.8,5.5,face],[x-4.8,8.5,face],[x+4.8,8.5,face],[0,0,-1],[1,1,1],2);
}
function palm(g,x,z,h) {
  g.cylinder(x,h/2,z,.23,h,P.trunk,7);
  for(let i=0;i<7;i++) {
    const a=i/7*Math.PI*2,dx=Math.sin(a),dz=Math.cos(a),tx=Math.cos(a)*.6,tz=-Math.sin(a)*.6;
    const c=[x,h,z],m=[x+dx*2.3,h+.5,z+dz*2.3],tip=[x+dx*4.6,h-.65,z+dz*4.6];
    g.quad(c,[m[0]+tx,m[1],m[2]+tz],tip,[m[0]-tx,m[1],m[2]-tz],[0,1,0],i%2?[.19,.42,.25]:[.27,.49,.25]);
  }
}
export function carGeometry(g, car, time=0,dusk=0,passenger=false) {
  const m=MODELS[car.model],c=car.flash>0?[1,.87,.57]:car.color,a=car.yaw,s=Math.sin(a),co=Math.cos(a),w=m.width,l=m.length;
  const box=(x,y,z,bw,bh,bl,color)=>g.box(car.x+x*co+z*s,y,car.z-x*s+z*co,bw,bh,bl,color,a);
  const shadow=[.15,.20,.20];g.disc(car.x,.28,car.z,.8*w,.61*l,shadow);
  box(0,.70,0,w,.62,l,c);box(0,.43,0,w*.94,.18,l*.97,[.12,.17,.19]);
  const cabinZ=car.model===1?.63:-.20,cabinL=car.model===1?1.8:2.05;
  if(passenger) {
    // Thin front/rear panes leave the side window open so the seated figure is visible.
    for(const end of [-1,1])box(0,1.21,cabinZ+end*cabinL*.5,w*.83,.63,.045,[.15,.29,.34]);
    personGeometry(g,{x:car.x+w*.24*co+cabinZ*s,z:car.z-w*.24*s+cabinZ*co,yaw:a,seated:true,color:[.72,.66,.42],skin:[.56,.36,.25]},time);
  } else box(0,1.21,cabinZ,w*.83,.63,cabinL,[.15,.29,.34]);
  box(0,1.56,cabinZ,w*.87,.13,cabinL*.88,c);
  box(0,1.24,cabinZ-.09,.10,.65,cabinL+.05,c);
  box(-w*.425,1.23,cabinZ+.30,.09,.64,.09,c);box(w*.425,1.23,cabinZ+.30,.09,.64,.09,c);
  if(car.model===1){box(0,1.03,-1.5,w*.82,.12,1.55,[.18,.23,.22]);box(-w*.45,1.05,-1.4,.13,.45,1.7,c);box(w*.45,1.05,-1.4,.13,.45,1.7,c);}
  if(car.model===2){box(0,.98,-l*.43,w*.98,.09,.34,[.13,.20,.21]);box(0,.92,l*.36,w*.75,.07,.9,c);}
  for(const side of [-1,1])for(const end of [-1,1]){box(side*w*.47,.43,end*l*.30,.24,.65,.67,[.075,.095,.10]);box(side*w*.535,.44,end*l*.30,.025,.34,.35,[.57,.63,.63]);}
  for(const side of [-1,1]) {
    box(side*w*.30,.78,l*.505,.48,.20,.035,[1,.88,.56]);
    const brakeColor=car.braking?[1,.09,.03]:[.56,.12,.08];
    box(side*w*.32,.81,-l*.505,.46,car.braking?.27:.17,.035,brakeColor);
    if(dusk>.5) {
      const ground=(x,z)=>[car.x+co*x+s*z,.29,car.z-s*x+co*z],center=side*w*.3,front=l*.5;
      g.quad(ground(center-.15,front),ground(center+.15,front),ground(center+1.1,front+7),ground(center-1.1,front+7),[0,1,0],[.74,.70,.40]);
    }
  }
  box(0,.58,l*.51,w*.83,.12,.1,[.23,.28,.28]);box(0,.59,-l*.51,.45,.16,.04,[.90,.86,.66]);
  if(car.police||car.cruiser) {
    const blue=Math.sin(time*12)>0;
    box(0,.77,0,w*1.015,.28,l*.48,[.86,.89,.84]);box(0,1.70,0,1.2,.17,.40,[.16,.22,.25]);
    box(-.36,1.81,0,.46,.16,.32,blue?[.2,.5,1]:[.12,.23,.5]);
    box(.36,1.81,0,.46,.16,.32,blue?[.5,.13,.12]:[1,.24,.18]);
  }
}
export function personGeometry(g,p,time,hero=false) {
  if(p.down>0) {
    const color=p.flash>0?[1,.7,.4]:(p.color||[.20,.32,.36]);
    g.disc(p.x,.28,p.z,.95,.45,[.18,.22,.21]);g.box(p.x,.47,p.z,1.5,.35,.55,color,p.yaw||0);
    g.box(p.x+.7,.47,p.z,.35,.36,.35,p.skin||[.7,.47,.33]);return;
  }
  const a=p.yaw||0,s=Math.sin(a),c=Math.cos(a),y=p.seated?-.35:p.y||0,walk=Math.sin((p.phase||0)+time*8)*Math.min(1,p.moving?1:0);
  const box=(x,b,z,w,h,l,col)=>g.box(p.x+x*c+z*s,y+b,p.z-x*s+z*c,w,h,l,col,a);
  const skin=p.skin||[.72,.46,.31],shirt=p.flash>0?[1,.84,.48]:hero?[.93,.47,.30]:p.color||[.15,.28,.35],pants=hero?[.17,.29,.35]:[.22,.29,.30];
  if(!p.seated){
    g.disc(p.x,.29,p.z,.5,.35,[.22,.25,.22]);
    box(-.16,.45,walk*.16,.24,.75,.27,pants);box(.16,.45,-walk*.16,.24,.75,.27,pants);
    box(-.16,.12,.09+walk*.16,.27,.17,.42,[.84,.78,.59]);box(.16,.12,.09-walk*.16,.27,.17,.42,[.84,.78,.59]);
  }
  g.capsule(p.x,y+1.02,p.z,.30,.70,shirt);box(-.41,.97,-walk*.17,.19,.62,.22,skin);box(.41,.97,walk*.17,.19,.62,.22,skin);
  box(0,1.58,0,.37,.42,.36,skin);box(0,1.80,-.035,.41,.12,.39,[.15,.13,.12]);box(0,1.56,-.16,.40,.34,.11,[.15,.13,.12]);
  if(hero){box(0,1.63,.187,.39,.08,.025,[.12,.20,.22]);box(.24,1.08,-.03,.09,.6,.39,[.16,.25,.29]);}
}
