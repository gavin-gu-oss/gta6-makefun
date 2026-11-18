import { mix } from './random.js';

export class Geometry {
  constructor() { this.data = []; }
  vertex(p, n, uv, c, tex = 0) { this.data.push(...p, ...n, ...uv, ...c, tex); }
  quad(a, b, c, d, normal, color, tex = 0, u = 1, v = 1) {
    const points = [a, b, c, a, c, d], uv = [[0, 0], [u, 0], [u, v], [0, 0], [u, v], [0, v]];
    points.forEach((p, i) => this.vertex(p, normal, uv[i], color, tex));
  }
  box(x, y, z, w, h, l, color, yaw = 0, tex = 0) {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    const p = (a, b, d) => [x + a*c + d*s, y+b, z-a*s+d*c];
    const n = (a, b, d) => [a*c+d*s, b, -a*s+d*c];
    const a = -w/2, b = w/2, f = -l/2, r = l/2, t = h/2, q = -h/2;
    this.quad(p(a,q,r),p(b,q,r),p(b,t,r),p(a,t,r),n(0,0,1),color,tex,w/4,h/4);
    this.quad(p(b,q,f),p(a,q,f),p(a,t,f),p(b,t,f),n(0,0,-1),color,tex,w/4,h/4);
    this.quad(p(b,q,r),p(b,q,f),p(b,t,f),p(b,t,r),n(1,0,0),color,tex,l/4,h/4);
    this.quad(p(a,q,f),p(a,q,r),p(a,t,r),p(a,t,f),n(-1,0,0),color,tex,l/4,h/4);
    this.quad(p(a,t,r),p(b,t,r),p(b,t,f),p(a,t,f),[0,1,0],color);
    this.quad(p(a,q,f),p(b,q,f),p(b,q,r),p(a,q,r),[0,-1,0],color);
  }
  cylinder(x,y,z,r,h,color,segments=8) {
    for(let i=0;i<segments;i++) {
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
      const p=[x+Math.sin(a)*r,y-h/2,z+Math.cos(a)*r],q=[x+Math.sin(b)*r,y-h/2,z+Math.cos(b)*r];
      this.quad(p,q,[q[0],y+h/2,q[2]],[p[0],y+h/2,p[2]],[Math.sin((a+b)/2),0,Math.cos((a+b)/2)],color);
      this.vertex([x,y+h/2,z],[0,1,0],[0,0],color);
      this.vertex([p[0],y+h/2,p[2]],[0,1,0],[0,0],color);
      this.vertex([q[0],y+h/2,q[2]],[0,1,0],[0,0],color);
    }
  }
  disc(x,y,z,rx,rz,color,segments=14) {
    for(let i=0;i<segments;i++) {
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
      this.vertex([x,y,z],[0,1,0],[0,0],color);
      this.vertex([x+Math.cos(a)*rx,y,z+Math.sin(a)*rz],[0,1,0],[0,0],color);
      this.vertex([x+Math.cos(b)*rx,y,z+Math.sin(b)*rz],[0,1,0],[0,0],color);
    }
  }
  capsule(x,y,z,r,h,color) {
    const rings=[],straight=Math.max(0,h/2-r);
    for(let half=0;half<2;half++)for(let j=0;j<=3;j++) {
      const a=(half*3+j)*Math.PI/6;
      rings.push({r:Math.sin(a)*r,y:(half?-straight:straight)+Math.cos(a)*r,ny:Math.cos(a)});
    }
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<8;i++) {
      const a=i*Math.PI/4,b=(i+1)*Math.PI/4,p=rings[j],q=rings[j+1];
      const point=(ring,angle)=>[x+Math.sin(angle)*ring.r,y+ring.y,z+Math.cos(angle)*ring.r];
      this.quad(point(p,a),point(p,b),point(q,b),point(q,a),[Math.sin((a+b)/2), (p.ny+q.ny)/2, Math.cos((a+b)/2)],color);
    }
  }
}
export function perspective(fov, aspect, near, far) {
  const f=1/Math.tan(fov/2),nf=1/(near-far);
  return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
}
const normalize = v => {const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function lookAt(eye, target) {
  const z=normalize(eye.map((v,i)=>v-target[i])),x=normalize(cross([0,1,0],z)),y=cross(z,x);
  const dot=a=>-(a[0]*eye[0]+a[1]*eye[1]+a[2]*eye[2]);
  return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,dot(x),dot(y),dot(z),1]);
}
export function multiply(a,b) {
  const o=new Float32Array(16);
  for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return o;
}
function program(gl, vs, fs) {
  const compile=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,vs));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;
}
const vertex = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec2 aUV; attribute vec3 aColor; attribute float aTex;
uniform mat4 uVP; varying vec3 vPos; varying vec3 vNormal; varying vec2 vUV; varying vec3 vColor; varying float vTex;
void main(){vPos=aPos;vNormal=aNormal;vUV=aUV;vColor=aColor;vTex=aTex;gl_Position=uVP*vec4(aPos,1.0);}`;
const fragment = `precision mediump float;
varying vec3 vPos; varying vec3 vNormal; varying vec2 vUV; varying vec3 vColor; varying float vTex;
uniform sampler2D uWindows; uniform sampler2D uSigns; uniform vec3 uEye; uniform vec3 uFog; uniform float uDusk;
void main(){
 vec3 light=normalize(vec3(-0.6,0.9,-0.35)); float diffuse=max(dot(normalize(vNormal),light),0.0);
 vec3 albedo=vColor;
 if(vTex>1.5){albedo*=texture2D(uSigns,vUV).rgb;}
 else if(vTex>0.5){vec3 w=texture2D(uWindows,vUV).rgb;albedo*=w;
   float pane=step(0.16,fract(vUV.x))*step(fract(vUV.x),0.80)*step(0.18,fract(vUV.y))*step(fract(vUV.y),0.78);
   float selected=step(0.55,fract(sin(dot(floor(vUV),vec2(12.9898,78.233)))*437.1));
   albedo=mix(albedo,vec3(1.0,0.76,0.35),pane*selected*uDusk*0.8);}
 vec3 lit=albedo*(vec3(0.48,0.53,0.57)+diffuse*vec3(0.62,0.49,0.32));
 lit=mix(lit,lit*vec3(0.76,0.72,0.96),uDusk*0.38);
 float fog=1.0-exp(-pow(distance(vPos,uEye)*0.0035,1.5));
 gl_FragColor=vec4(mix(lit,uFog,clamp(fog,0.0,0.93)),1.0);
}`;
const skyVertex=`attribute vec2 aPoint; varying vec2 vUV;void main(){vUV=aPoint*0.5+0.5;gl_Position=vec4(aPoint,0.9999,1.0);}`;
const skyFragment=`precision mediump float;varying vec2 vUV;uniform float uDusk;uniform float uAspect;
void main(){vec3 low=mix(vec3(0.97,0.79,0.55),vec3(0.88,0.45,0.36),uDusk);
vec3 high=mix(vec3(0.24,0.59,0.69),vec3(0.16,0.24,0.40),uDusk);vec3 col=mix(low,high,pow(vUV.y,0.68));
vec2 p=(vUV-vec2(0.72,0.68))*vec2(uAspect,1.0);float d=length(p);
col+=vec3(0.20,0.11,0.03)*exp(-d*9.0);col=mix(col,vec3(1.0,0.91,0.64),1.0-smoothstep(0.030,0.033,d));
gl_FragColor=vec4(col,1.0);}`;
export class Renderer {
  constructor(canvas, staticGeometry) {
    this.canvas=canvas;const gl=this.gl=canvas.getContext('webgl',{antialias:true,alpha:false,preserveDrawingBuffer:true});
    if(!gl)throw Error('WebGL is unavailable. Enable hardware acceleration and reload.');
    this.p=program(gl,vertex,fragment);this.sky=program(gl,skyVertex,skyFragment);
    this.locations={};for(const n of ['uVP','uEye','uFog','uDusk','uWindows','uSigns'])this.locations[n]=gl.getUniformLocation(this.p,n);
    this.attributes=[['aPos',3,0],['aNormal',3,12],['aUV',2,24],['aColor',3,32],['aTex',1,44]].map(([name,size,offset])=>({loc:gl.getAttribLocation(this.p,name),size,offset}));
    this.static=this.upload(staticGeometry);this.dynamic={buffer:gl.createBuffer(),count:0};
    this.skyBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#d3d2bd';ctx.fillRect(0,0,128,128);
    ctx.fillStyle='#405d65';ctx.fillRect(21,13,84,93);ctx.fillStyle='#73969a';ctx.fillRect(24,16,78,6);
    ctx.fillStyle='#bed5cc';ctx.fillRect(28,25,7,64);ctx.fillStyle='#234752';ctx.fillRect(63,16,4,88);ctx.fillRect(23,55,80,4);
    ctx.fillStyle='#ebe2be';ctx.fillRect(15,107,98,8);
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
    const sign=document.createElement('canvas');sign.width=512;sign.height=128;const sc=sign.getContext('2d');
    sc.fillStyle='#173f44';sc.fillRect(0,0,512,128);sc.fillStyle='#ffbd6b';sc.fillRect(12,12,488,4);sc.textAlign='center';sc.fillStyle='#fff0cf';sc.font='bold 38px Arial';sc.fillText('VISIT PORT SOLANO',256,65);sc.font='18px Arial';sc.fillStyle='#86d7c2';sc.fillText('YOUR NEXT CHAPTER STARTS HERE',256,100);
    gl.activeTexture(gl.TEXTURE1);const signTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,signTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sign);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.activeTexture(gl.TEXTURE0);
    gl.enable(gl.DEPTH_TEST);this.vp=null;
  }
  upload(geometry) {const gl=this.gl,buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(geometry.data),gl.STATIC_DRAW);return {buffer,count:geometry.data.length/12};}
  draw(mesh) {const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);for(const a of this.attributes){gl.enableVertexAttribArray(a.loc);gl.vertexAttribPointer(a.loc,a.size,gl.FLOAT,false,48,a.offset);}gl.drawArrays(gl.TRIANGLES,0,mesh.count);}
  render(camera, moving, dusk=0) {
    const gl=this.gl,ratio=Math.min(devicePixelRatio||1,1.5),w=Math.floor(innerWidth*ratio),h=Math.floor(innerHeight*ratio);
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);
    for(const a of this.attributes)gl.disableVertexAttribArray(a.loc);
    gl.useProgram(this.sky);gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);const point=gl.getAttribLocation(this.sky,'aPoint');gl.enableVertexAttribArray(point);gl.vertexAttribPointer(point,2,gl.FLOAT,false,0,0);
    gl.uniform1f(gl.getUniformLocation(this.sky,'uDusk'),dusk);gl.uniform1f(gl.getUniformLocation(this.sky,'uAspect'),w/h);gl.drawArrays(gl.TRIANGLES,0,6);gl.disableVertexAttribArray(point);
    gl.enable(gl.DEPTH_TEST);gl.useProgram(this.p);
    this.vp=multiply(perspective(camera.fov||Math.PI/3,w/h,0.15,1100),lookAt(camera.eye,camera.target));
    gl.uniformMatrix4fv(this.locations.uVP,false,this.vp);gl.uniform3fv(this.locations.uEye,camera.eye);gl.uniform3fv(this.locations.uFog,[mix(0.86,0.64,dusk),mix(0.77,0.45,dusk),mix(0.61,0.47,dusk)]);gl.uniform1f(this.locations.uDusk,dusk);gl.uniform1i(this.locations.uWindows,0);
    gl.uniform1i(this.locations.uSigns,1);
    this.draw(this.static);gl.bindBuffer(gl.ARRAY_BUFFER,this.dynamic.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(moving.data),gl.DYNAMIC_DRAW);this.dynamic.count=moving.data.length/12;this.draw(this.dynamic);
  }
  project(x,y,z) {
    if(!this.vp)return null;const m=this.vp,w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0)return null;
    return {x:((m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5)*innerWidth,y:(.5-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*.5)*innerHeight};
  }
}
