export class Input {
  constructor(canvas,onPause,onInteract,onSave,onMute=()=>{}) {
    this.keys=new Set();this.yaw=Math.PI;this.pitch=.32;this.drag=false;this.orbitTime=0;this.jump=false;this.active=false;
    addEventListener('keydown',e=>{
      if(this.active&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      if(e.repeat)return;
      if(e.code==='KeyM'){onMute();return;}
      if(e.code==='Escape'||e.code==='KeyP'){onPause();return;}
      if(!this.active)return;
      this.keys.add(e.code);
      if(e.code==='KeyE')onInteract();
      if(e.code==='Space')this.jump=true;
      if(e.code==='KeyK')onSave();
      if(e.code==='KeyF')this.punch=true;
    });
    addEventListener('keyup',e=>this.keys.delete(e.code));
    addEventListener('blur',()=>{this.clear();if(this.active)onPause(true);});
    canvas.addEventListener('pointerdown',e=>{if(this.active){this.drag=true;this.downX=e.clientX;this.downY=e.clientY;}});
    addEventListener('pointerup',e=>{
      if(this.drag&&Math.hypot(e.clientX-this.downX,e.clientY-this.downY)<4&&this.active){
        if(e.button===0)this.fire=true;
        if(!document.pointerLockElement)try{const p=canvas.requestPointerLock?.();if(p?.catch)p.catch(()=>{});}catch{}
      }this.drag=false;
    });
    addEventListener('mousemove',e=>{if(this.active&&(this.drag||document.pointerLockElement===canvas)){this.yaw-=e.movementX*.004;this.pitch=Math.max(.08,Math.min(.85,this.pitch+e.movementY*.003));this.orbitTime=2.5;}});
  }
  down(...codes){return codes.some(c=>this.keys.has(c));}
  clear(){this.keys.clear();this.jump=false;this.punch=false;this.fire=false;this.drag=false;}
}
