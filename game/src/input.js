export class Input {
  constructor(canvas,onPause,onInteract,onSave,onMute=()=>{}) {
    Object.assign(this,{keys:new Set(),yaw:Math.PI,pitch:.32,orbitTime:0,jump:false,punch:false,fire:false,drag:false,active:false});
    addEventListener('keydown',event=>{
      const code=event.code;
      if(this.active&&['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code))event.preventDefault();
      if(event.repeat)return;
      if(code==='KeyM'){onMute();return;}
      if(code==='Escape'||code==='KeyP'){onPause();return;}
      if(!this.active)return;
      this.keys.add(code);
      switch(code) {
        case 'KeyE':onInteract();break;
        case 'KeyK':onSave();break;
        case 'KeyF':this.punch=true;break;
        case 'Space':this.jump=true;break;
      }
    });
    addEventListener('keyup',event=>this.keys.delete(event.code));
    addEventListener('blur',()=>{this.clear();if(this.active)onPause(true);});
    canvas.addEventListener('pointerdown',event=>{
      if(!this.active)return;
      this.drag=true;this.downX=event.clientX;this.downY=event.clientY;
    });
    addEventListener('pointerup',event=>{
      const click=this.drag&&this.active&&Math.hypot(event.clientX-this.downX,event.clientY-this.downY)<4;
      this.drag=false;if(!click)return;
      if(event.button===0)this.fire=true;
      if(!document.pointerLockElement) {
        try{canvas.requestPointerLock?.()?.catch?.(()=>{});}catch{}
      }
    });
    addEventListener('mousemove',event=>{
      if(!this.active||(!this.drag&&document.pointerLockElement!==canvas))return;
      this.yaw-=event.movementX*.004;
      this.pitch=Math.max(.08,Math.min(.85,this.pitch+event.movementY*.003));this.orbitTime=2.5;
    });
  }
  down(...codes){return codes.some(code=>this.keys.has(code));}
  clear(){this.keys.clear();this.jump=false;this.punch=false;this.fire=false;this.drag=false;}
}
