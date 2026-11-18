// All voices are oscillators. No files, noise buffers, or context before a gesture.
export class Sound {
  constructor(){this.context=null;this.muted=false;this.engine=null;this.siren=null;this.master=null;}
  resume() {
    try {
      if(!this.context) {
        const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)return;
        const c=this.context=new Audio();this.master=c.createGain();this.master.gain.value=this.muted?0:.24;this.master.connect(c.destination);
        const voice=type=>{const o=c.createOscillator(),g=c.createGain();o.type=type;g.gain.value=0;o.connect(g);g.connect(this.master);o.start();return {o,g};};
        this.engine=voice('sawtooth');this.siren=voice('sine');
      }
      const promise=this.context.resume();if(promise?.catch)promise.catch(()=>{});
    } catch {this.context=null;}
  }
  toggle(){this.muted=!this.muted;if(this.master)this.master.gain.setTargetAtTime(this.muted?0:.24,this.context.currentTime,.04);return this.muted;}
  silence(){if(this.context)for(const v of [this.engine,this.siren])v?.g.gain.setTargetAtTime(0,this.context.currentTime,.02);}
  tone(frequency,duration=.12,type='sine',volume=.35,delay=0,end=frequency) {
    const c=this.context;if(!c||c.state!=='running'||this.muted)return;
    const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;o.type=type;o.frequency.setValueAtTime(frequency,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);
    g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(volume,t+.006);g.gain.exponentialRampToValueAtTime(.001,t+duration);
    o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration+.02);o.onended=()=>{o.disconnect();g.disconnect();};
  }
  play(name) {
    if(name==='pickup'){this.tone(660,.12);this.tone(990,.2,'sine',.35,.1);}
    if(name==='complete')[523,659,784,1047].forEach((f,i)=>this.tone(f,.28,'triangle',.4,i*.13));
    if(name==='gunshot'){this.tone(160,.095,'sawtooth',.8,0,25);this.tone(930,.04,'square',.12);}
    if(name==='punch')this.tone(100,.12,'triangle',.7,0,35);
    if(name==='crash')this.tone(75,.22,'sawtooth',.65,0,24);
    if(name==='click')this.tone(540,.055,'triangle',.2);
    if(name==='wanted'){this.tone(330,.21,'square',.17);this.tone(415,.3,'square',.17,.14);}
  }
  update(state) {
    const events=state.events.splice(0);
    if(!this.context)return;
    const c=this.context,t=c.currentTime,active=state.started&&!state.paused&&!state.storyScreen;
    this.engine.o.frequency.setTargetAtTime(38+Math.abs(state.car?.speed||0)*4,t,.08);
    this.engine.g.gain.setTargetAtTime(active&&state.car ? .12 : 0,t,.1);
    const target=state.car||state.player,near=state.world.cars.some(p=>p.police&&p.disabled<=0&&Math.hypot(p.x-target.x,p.z-target.z)<85);
    this.siren.o.frequency.setTargetAtTime(Math.floor(state.time*2)%2?660:880,t,.035);
    this.siren.g.gain.setTargetAtTime(active&&state.wanted&&near ? .15 : 0,t,.08);
    if(active)for(const name of events)this.play(name);
  }
}
