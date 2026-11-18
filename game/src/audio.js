const CUES={
  pickup:[[660,.12],[990,.2,'sine',.35,.1]],
  complete:[523,659,784,1047].map((note,index)=>[note,.28,'triangle',.4,index*.13]),
  gunshot:[[160,.095,'sawtooth',.8,0,25],[930,.04,'square',.12]],
  punch:[[100,.12,'triangle',.7,0,35]],crash:[[75,.22,'sawtooth',.65,0,24]],
  click:[[540,.055,'triangle',.2]],wanted:[[330,.21,'square',.17],[415,.3,'square',.17,.14]],
};
export class Sound {
  constructor(){this.context=null;this.master=null;this.engine=null;this.siren=null;this.muted=false;}
  resume() {
    try {
      if(!this.context) {
        const Constructor=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Constructor)return;
        const context=new Constructor(),master=context.createGain();
        master.gain.value=this.muted?0:.24;master.connect(context.destination);
        const continuous=type=>{
          const o=context.createOscillator(),g=context.createGain();o.type=type;g.gain.value=0;
          o.connect(g);g.connect(master);o.start();return {o,g};
        };
        this.context=context;this.master=master;this.engine=continuous('sawtooth');this.siren=continuous('sine');
      }
      this.context.resume()?.catch?.(()=>{});
    } catch {this.context=null;this.master=null;this.engine=null;this.siren=null;}
  }
  toggle() {
    this.muted=!this.muted;
    if(this.master)this.master.gain.setTargetAtTime(this.muted?0:.24,this.context.currentTime,.04);
    return this.muted;
  }
  silence() {
    if(!this.context)return;
    for(const voice of [this.engine,this.siren])voice.g.gain.setTargetAtTime(0,this.context.currentTime,.02);
  }
  tone(frequency,duration=.12,type='sine',volume=.35,delay=0,end=frequency) {
    const context=this.context;if(!context||context.state!=='running'||this.muted)return;
    const oscillator=context.createOscillator(),envelope=context.createGain(),start=context.currentTime+delay;
    oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,end),start+duration);
    envelope.gain.setValueAtTime(.001,start);envelope.gain.linearRampToValueAtTime(volume,start+.006);
    envelope.gain.exponentialRampToValueAtTime(.001,start+duration);
    oscillator.connect(envelope);envelope.connect(this.master);oscillator.start(start);oscillator.stop(start+duration+.02);
    oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};
  }
  play(name){for(const notes of CUES[name]||[])this.tone(...notes);}
  update(state) {
    const pending=state.events.splice(0),context=this.context;if(!context)return;
    const active=state.started&&!state.paused&&!state.storyScreen,time=context.currentTime;
    this.engine.o.frequency.setTargetAtTime(38+4*Math.abs(state.car?.speed||0),time,.08);
    this.engine.g.gain.setTargetAtTime(active&&state.car ? .12 : 0,time,.1);
    const target=state.car||state.player;
    const audible=state.world.cars.some(car=>car.police&&car.disabled<=0&&Math.hypot(car.x-target.x,car.z-target.z)<85);
    this.siren.o.frequency.setTargetAtTime(Math.floor(state.time*2)%2?660:880,time,.035);
    this.siren.g.gain.setTargetAtTime(active&&state.wanted>0&&audible ? .15 : 0,time,.08);
    if(active)for(const name of pending)this.play(name);
  }
}
