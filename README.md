# Solano Streets

[![Make GTA 6 bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Bounty rank](https://make.fun/badge/gta6-01/gavin-gu-oss/gta6-makefun/rank.svg)](https://make.fun/c/gta6-01)
[![Bounty reward](https://make.fun/badge/gta6-01/gavin-gu-oss/gta6-makefun/reward.svg)](https://make.fun/c/gta6-01)

Rae Vega takes a pickup job in Port Solano, a coastal city built in raw WebGL.

## Play

Open `game/index.html` in a desktop browser with WebGL enabled, or run `node serve.ts` with Node 22+ and open `http://localhost:8080`. All game assets and scripts are local.

Use WASD to move or drive, Shift to run, Space to jump or handbrake, and E to enter or exit a car. On foot, press F to punch or click to fire the pistol. Drag to orbit. Double-click the game view or use the crosshair button to lock the pointer. Press M to toggle audio and P or Esc to pause.

## Mara Quinn’s jobs

1. **First Pickup** — Collect Mara’s package and deliver it to the waterfront.
2. **Checkpoint Run** — Drive through five checkpoints. The first starts a 90-second timer.
3. **Repo Job** — Take the marina’s gold Falcon GT to the chop shop with light damage at most.
4. **Rooftop Drop** — Reach the Lantern Square rooftop on foot with two wanted stars.
5. **The Big Score** — Pick up Dante at the diner, stop at the bank, and stay nearby for 20 seconds while he opens the vault. Drive him to the safe house for $2,500.

Continue restores cash, ammo, the current objective, and any time left on a mission clock.

Screenshot presets are available at `?shot=start&seed=1`, `?shot=play&seed=1`, and `?shot=end&seed=1`.

## Build the submission

Run `MAKEFUN_OUTPUT_DIR=out node main.ts`. The dossier and copied game and screenshots appear in `out/`.
