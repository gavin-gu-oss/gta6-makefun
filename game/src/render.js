'use strict';

const TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const rightOf = yaw => [Math.cos(yaw), -Math.sin(yaw)];
const forwardOf = yaw => [Math.sin(yaw), Math.cos(yaw)];
const tint = (hex) => [16, 8, 0].map(shift => ((hex >> shift) & 255) / 255);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = v => v.map(value => value / Math.hypot(...v));

class Mesh {
  constructor() {
    this.data = [];
  }

  quad(a, b, c, d, rgb, shade, uv = [[-1,-1],[-1,-1],[-1,-1],[-1,-1]]) {
    const points = [a,b,c,d];
    for (const index of [0,1,2,0,2,3]) {
      this.vertex(points[index], rgb, shade, uv[index]);
    }
  }

  vertex(position, rgb, shade, uv = [-1,-1]) {
    this.data.push(...position, ...rgb.map(value => value * shade), ...uv);
  }

  box(x, y, z, w, h, d, hex, yaw = 0, windows = false) {
    const [rx, rz] = rightOf(yaw);
    const [fx, fz] = forwardOf(yaw);
    const point = (u, v, t) => [x + rx*u + fx*t, y+v, z+rz*u+fz*t];
    const a = point(-w/2,0,-d/2), b = point(w/2,0,-d/2);
    const c = point(w/2,0,d/2), e = point(-w/2,0,d/2);
    const top = p => [p[0],p[1]+h,p[2]];
    const rgb = tint(hex);
    const uv = width => windows ? [[0,0],[width/6,0],[width/6,h/6],[0,h/6]] : undefined;
    this.quad(a,b,top(b),top(a),rgb,.82,uv(w));
    this.quad(b,c,top(c),top(b),rgb,.69,uv(d));
    this.quad(c,e,top(e),top(c),rgb,.91,uv(w));
    this.quad(e,a,top(a),top(e),rgb,.98,uv(d));
    this.quad(top(a),top(b),top(c),top(e),rgb,1);
    this.quad(e,c,b,a,rgb,.55);
  }

  oval(x, y, z, rx, ry, rz, hex) {
    const rgb = tint(hex);
    const ring = (latitude, angle) => {
      const phi = latitude * Math.PI/6;
      return [x+rx*Math.sin(phi)*Math.cos(angle), y+ry*Math.cos(phi), z+rz*Math.sin(phi)*Math.sin(angle)];
    };
    for (let lat=0; lat<6; lat++) {
      for (let slice=0; slice<8; slice++) {
        const angle = slice*TAU/8;
        const next = angle+TAU/8;
        this.quad(ring(lat,angle),ring(lat,next),ring(lat+1,next),ring(lat+1,angle),
          rgb,.73+.22*Math.cos(angle-2)+.09*Math.cos(lat*Math.PI/6));
      }
    }
  }
}

function viewProjection(eye, target, aspect) {
  const back = unit(eye.map((value,index) => value-target[index]));
  const right = unit(cross([0,1,0],back));
  const up = cross(back,right);
  const focal = 1 / Math.tan(Math.PI / 6);
  const near = .3, far = 950;
  const a = -(far+near)/(far-near), b = -2*far*near/(far-near);
  const rows = [
    [...right.map(value => value*focal/aspect), -dot(right,eye)*focal/aspect],
    [...up.map(value => value*focal), -dot(up,eye)*focal],
    [...back.map(value => value*a), -dot(back,eye)*a+b],
    [...back.map(value => -value), dot(back,eye)],
  ];
  return new Float32Array(rows.flatMap((_,column) => rows.map(row => row[column])));
}

class Renderer {
  constructor(canvas, city) {
    this.canvas = canvas;
    const gl = this.gl = canvas.getContext('webgl', { alpha: false, antialias: true });
    if (!gl) throw new Error('WebGL is required to play Solano Streets.');
    this.scene = this.program(
      `attribute vec3 p,c;
      attribute vec2 uv;
      uniform mat4 vp;
      uniform vec3 eye;
      varying vec3 color;
      varying vec2 tile;
      varying float distanceToEye;
      void main(){color=c;tile=uv;distanceToEye=length(p-eye);gl_Position=vp*vec4(p,1.);}`,
      `precision mediump float;
      varying vec3 color;
      varying vec2 tile;
      varying float distanceToEye;
      uniform sampler2D windows;
      uniform vec3 fog, light;
      void main(){
        vec3 surface=color;
        if(tile.x>=0.)surface*=texture2D(windows,tile).rgb;
        gl_FragColor=vec4(mix(surface*light,fog,smoothstep(68.,465.,distanceToEye)),1.);
      }`,
      ['p','c','uv'], ['vp','eye','fog','light']);
    this.sky = this.program(
      `attribute vec2 p; varying vec2 xy; void main(){xy=p;gl_Position=vec4(p,0.,1.);}`,
      `precision mediump float;
      varying vec2 xy;
      uniform vec3 fog, zenith, sun;
      uniform float horizon, aspect;
      void main(){
        vec3 sky=mix(fog,zenith,smoothstep(-.12,1.15,xy.y-horizon));
        float d=length(vec2((xy.x-sun.x)*aspect,xy.y-sun.y));
        sky+=vec3(1.,.52,.19)*.27*exp(-6.*d);
        sky=mix(sky,vec3(1.,.91,.64),1.-smoothstep(sun.z,sun.z+.007,d));
        gl_FragColor=vec4(sky,1.);
      }`, ['p'], ['fog','zenith','sun','horizon','aspect']);
    this.skyBuffer = this.buffer([-1,-1,3,-1,-1,3], gl.STATIC_DRAW);
    this.cityBuffer = this.buffer(city.data, gl.STATIC_DRAW);
    this.cityCount = city.data.length/8;
    this.liveBuffer = gl.createBuffer();

    const tile = document.createElement('canvas');
    tile.width = tile.height = 64;
    const ctx = tile.getContext('2d');
    ctx.fillStyle = '#f5f2eb';
    ctx.fillRect(0,0,64,64);
    for (const x of [7,36]) for (const y of [8,38]) {
      ctx.fillStyle = '#a5a8a4';
      ctx.fillRect(x-2,y-2,23,19);
      const glass = ctx.createLinearGradient(x,y,x+18,y+14);
      glass.addColorStop(0,'#496175');
      glass.addColorStop(.6,'#819da9');
      glass.addColorStop(1,'#394956');
      ctx.fillStyle = glass;
      ctx.fillRect(x,y,19,15);
      ctx.fillStyle = '#c6c6b8';
      ctx.fillRect(x+9,y,1,15);
    }
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,tile);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  }

  program(vertex, fragment, attributes, uniforms) {
    const gl = this.gl;
    const program = gl.createProgram();
    for (const [kind, source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
      const shader = gl.createShader(kind);
      gl.shaderSource(shader,source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program,shader);
      gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return {
      program,
      attributes: Object.fromEntries(attributes.map(name => [name,gl.getAttribLocation(program,name)])),
      uniforms: Object.fromEntries(uniforms.map(name => [name,gl.getUniformLocation(program,name)])),
    };
  }

  buffer(data, usage) {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),usage);
    return buffer;
  }

  draw(camera, live, palette) {
    const gl = this.gl, canvas = this.canvas;
    const pixelRatio = Math.min(devicePixelRatio,1.5);
    const width = Math.max(1,Math.round(canvas.clientWidth*pixelRatio));
    const height = Math.max(1,Math.round(canvas.clientHeight*pixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const aspect = width/height;
    gl.viewport(0,0,width,height);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.sky.program);
    const sky = this.sky.uniforms;
    gl.uniform3fv(sky.fog,palette.fog);
    gl.uniform3fv(sky.zenith,palette.zenith);
    gl.uniform3fv(sky.sun,palette.sun);
    gl.uniform1f(sky.aspect,aspect);
    const horizontal = Math.hypot(camera.eye[0]-camera.target[0],camera.eye[2]-camera.target[2]);
    gl.uniform1f(sky.horizon,clamp((camera.eye[1]-camera.target[1])/horizontal,-1,1)*1.73);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.skyBuffer);
    const skyPosition = this.sky.attributes.p;
    gl.enableVertexAttribArray(skyPosition);
    gl.vertexAttribPointer(skyPosition,2,gl.FLOAT,false,0,0);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.disableVertexAttribArray(skyPosition);

    gl.enable(gl.DEPTH_TEST);
    gl.useProgram(this.scene.program);
    const scene = this.scene.uniforms;
    gl.uniformMatrix4fv(scene.vp,false,viewProjection(camera.eye,camera.target,aspect));
    gl.uniform3fv(scene.eye,camera.eye);
    gl.uniform3fv(scene.fog,palette.fog);
    gl.uniform3fv(scene.light,palette.light);
    const drawMesh = (buffer,count) => {
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      for (const [name,size,offset] of [['p',3,0],['c',3,12],['uv',2,24]]) {
        const attribute = this.scene.attributes[name];
        gl.enableVertexAttribArray(attribute);
        gl.vertexAttribPointer(attribute,size,gl.FLOAT,false,32,offset);
      }
      gl.drawArrays(gl.TRIANGLES,0,count);
    };
    drawMesh(this.cityBuffer,this.cityCount);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.liveBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(live.data),gl.DYNAMIC_DRAW);
    drawMesh(this.liveBuffer,live.data.length/8);
    for (const attribute of Object.values(this.scene.attributes)) gl.disableVertexAttribArray(attribute);
  }
}
