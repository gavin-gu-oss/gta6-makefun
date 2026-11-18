# Solano Streets

![make.fun competition](https://make.fun/badge/gta6-01.svg)
![Live rank](https://make.fun/badge/gta6-01/gavin-gu-oss/gta6-makefun/rank.svg)
![Live reward](https://make.fun/badge/gta6-01/gavin-gu-oss/gta6-makefun/reward.svg)

An original browser 3D open-world crime game for the [make.fun Make GTA 6 bounty](https://make.fun/c/gta6-01). Entry: `gavin-gu-oss/gta6-makefun`.

Welcome to **Port Solano**. You're **Rae Vega**, a getaway driver new in town. Fixer **Mara Quinn** offers five sequential jobs, from a first delivery to a bank escape with crew member **Dante**. Finish the story, then continue exploring the city, beach, rooftops, and pier.

## Run

With Node 22.18+ (or Node 24), run `node serve.ts` and open the local address it prints. No install or build step. Serve `game/` from any static host; all assets, code, textures, and rendering are local. The game makes no external requests. The README badges are live competition images and are outside the runtime.

- **WASD / arrows:** walk or drive. **Shift:** run. **Space:** jump on foot / handbrake in a car.
- **E:** enter any nearby slow-moving car / exit when slow. Taking someone else's car raises wanted level; Mara's starting Falcon is yours.
- **Mouse drag:** orbit / aim; a left click fires on foot and requests pointer lock. **F:** punch the nearest visible person less than 2.05 m away. **M:** master sound mute. **Esc / P:** pause. **K:** save.
- Drive slowly into each gold mission marker and stop briefly to collect or deliver. Race checkpoints only require driving through. The rooftop objective requires leaving the car and climbing the east exterior stairs of the low teal-roof building.
- Progress saves on mission stages, every 12 seconds, on leaving the page, and through the pause menu. Continue restores position, cash, health, ammo, mission stage/timers, earnings, and wanted level. Repo and bank-stage saves restore a usable mission vehicle. Storage failures leave gameplay available.

## Mara's jobs

| Mission | Objective | Reward |
| --- | --- | ---: |
| First Pickup | Collect the Mariner Market parcel; deliver to Sunset Pier. | $750 |
| Checkpoint Run | Drive through five street checkpoints within 90 seconds. The route resets on timeout. | $900 |
| Repo Job | Steal the specific gold Falcon GT at the marina; deliver it to Quinn Salvage above 40% condition. A damaged target is replaced for a retry. | $1,100 |
| Rooftop Drop | Collect the rooftop parcel on foot using the east stairs while wanted stays at least two stars. | $1,250 |
| The Big Score | Collect Dante at Nightjar Diner, reach Tide Union Bank, stay within 18 m for the 20-second vault opening, then escape to Quinn Safe House. Dante rides in the passenger seat until delivery. | $2,500 |

Each job has Mara's dialogue, a street-visible beacon, minimap target, completion banner, and ammo refill. Total job earnings: $6,500. Completing The Big Score opens the story ending and a free-roam continue button.

Three original models: **Comet S**, **Mule**, and **Falcon GT**. Seeded procedural city, raw WebGL, 12 traffic cars with lane routes, signal stops and following gaps; 24 pedestrians with crosswalks, separation and flight; collidable scenery and a live minimap. Braking lights, dusk headlights/windows, street furniture and original tourism billboards are procedural.

Theft, vehicle impacts, pedestrian impacts and gunfire raise wanted stars with per-crime cooldowns. Police send one patrol at 1–2 stars, two at 3–4, and three at five; they pursue, ram, and deploy officers near Rae on foot. Hide from police and avoid crimes for about 25 seconds to lose a star. Two seconds of police contact on foot causes **BUSTED**; zero health causes **WASTED**. Both cost 20% of current cash, restore health, clear wanted, and respawn at the precinct or hospital. The current job restarts after a short recovery delay. Health slowly regenerates after seven seconds without damage. Rae starts with 24 pistol rounds; police require three pistol hits. All sound is synthesized with WebAudio after the first gesture; no audio files or dependencies.

## Package and verify

`MAKEFUN_OUTPUT_DIR=out node main.ts` copies `game/` and the existing `screenshots/`, then creates the kit's deterministic `dossier.json` with competition caps. `out/` is ignored. The three screenshots are real 1280×720 JPEG browser renders of Solano Streets captured in Round 1 with headless Chromium: the title scene, a two-star Falcon GT chase, and the $750 mission completion at dusk. The coordinator preserved these captures for this Round 2 rebuild, which implements the same staged scenes. Their dimensions, byte sizes, color counts, and SHA-256 hashes were verified before replacing the starter images; these are preserved Round 1 captures, not new captures of the Round 2 build.

`node --test --test-isolation=none tests/core.test.mjs tests/systems.test.mjs tests/polish.test.mjs` checks movement, deterministic generation, crimes/police, recovery, combat, signals/pedestrians, all mission transitions, route feasibility, Dante, audio lifecycle, persistence, and shot projection. `node tests/chase-check.mjs` reports a deterministic 60-second pursuit with traffic. Police follow adjacent road junctions and reverse after two seconds stuck. `node tests/serve-check.mjs` checks the unmodified server and every module in-process without opening a port. `node tests/package-check.mjs` builds twice, compares bytes, and checks package limits and runtime network independence.

Sandbox limitation from prior verification: Chromium aborts before loading any page with `sandbox_host_linux.cc:41 — shutdown: Operation not permitted`; shader tooling also lacks `libEGL.so.1`. No browser attempt was made in the final session. Shot subject meshes pass mathematical viewport checks at 1280×720 and 1440×900. The preserved captures show the Round 1 scenes; actual Round 2 rendering, shader compilation, audio output, console behavior, HUD overlap, and interaction feel remain unverified in a browser. AI remains simple and pistol aim is horizontal. Route tests exclude traffic-light delays and police survival, so difficulty still needs browser playtesting.

Staged real game views: `?shot=start&seed=1`, `?shot=play&seed=1`, `?shot=end&seed=1`. Each runs the live game loop with a fixed composition and deterministic placement. Movement releases the play/end staging into normal gameplay. Start begins a fresh game; Continue loads saved progress. Shot staging itself never writes a save.

All city, story, vehicles, character designs, code, and visuals are original. No commercial game assets, music, names, maps, or libraries are used.
