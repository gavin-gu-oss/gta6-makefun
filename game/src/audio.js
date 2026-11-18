'use strict';

let sound, master, engine, siren, muted = false;
const effects = {
  pickup:[[440,.09],[660,.13]],
  complete:[[392,.12],[523,.12],[659,.12],[784,.26]],
  shot:[[165,.09,'sawtooth',42]],
  punch:[[100,.12,'triangle',38]],
  crash:[[61,.24,'sawtooth',24]],
  click:[[740,.055]],
  wanted:[[280,.16,'square'],[195,.24,'triangle']],
};

function unlockAudio() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  if (!sound) {
    sound = new Context();
    master = sound.createGain();
    master.gain.value = muted ? 0 : .48;
    master.connect(sound.destination);
    const voice = (type,frequency) => {
      const oscillator = sound.createOscillator(), gain = sound.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.value = 0;
      oscillator.connect(gain).connect(master);
      oscillator.start();
      return {oscillator,gain};
    };
    engine = voice('triangle',42);
    siren = voice('triangle',510);
  }
  if (sound.state==='suspended') sound.resume().catch(() => {});
}

function playSound(name) {
  if (sound?.state!=='running' || muted) return;
  let now = sound.currentTime;
  for (const [frequency,length,type='sine',end=frequency] of effects[name]) {
    const oscillator = sound.createOscillator(), gain = sound.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency,now);
    oscillator.frequency.exponentialRampToValueAtTime(end,now+length);
    gain.gain.setValueAtTime(.001,now);
    gain.gain.exponentialRampToValueAtTime(.18,now+.012);
    gain.gain.exponentialRampToValueAtTime(.001,now+length);
    oscillator.connect(gain).connect(master);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(now);
    oscillator.stop(now+length);
    now += length;
  }
}

function updateAudio() {
  if (!sound) return;
  const now = sound.currentTime, active = game.mode==='play' && !game.shot;
  const distance = game.city.police.reduce((nearest,car) =>
    Math.min(nearest,Math.hypot(car.x-game.player.x,car.z-game.player.z)),60);
  engine.oscillator.frequency.setTargetAtTime(39+Math.abs(game.vehicle?.speed || 0)*3,now,.07);
  engine.gain.gain.setTargetAtTime(active && game.vehicle ? .105 : 0,now,.09);
  siren.oscillator.frequency.setTargetAtTime(game.time% .8<.4 ? 540 : 730,now,.035);
  siren.gain.gain.setTargetAtTime(active && game.wanted ? .12*(1-distance/60) : 0,now,.09);
}

function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : .48,sound.currentTime,.04);
}
