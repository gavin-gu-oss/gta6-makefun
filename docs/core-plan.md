# Solano Streets — session 1

The user specification is the design authority. Implement directly in the supplied workspace, with no commits, external assets, dependencies, other game sources, or screenshot changes.

1. Replace index.html and all src files with original modules: seeded random and configuration; batched raw-WebGL renderer; procedural 8×8 coastal world; input; simulation; missions/save; shot staging; DOM HUD and minimap.
2. Use one shared static city mesh, procedural canvas windows, and batched moving car/character geometry. AABB push-out for bodies, cars, and props; fixed-step physics and deterministic world seed. Build an original coastal visual identity using warm concrete, teal water, and coral/gold interface accents.
3. Implement First Pickup with two destinations, proximity pickup/delivery while driving, $750 payout, and persistent state. Include walking, running, jumping, car entry/exit, traffic, pedestrians, camera, pause, and staged start/play/end renders.
4. Rewrite packaging main.ts with exact kit caps. Add exact live badges and owner metadata. Ignore out/.
5. Verify seeded generation, collisions, mission transitions, save sanitation, and shot placement. Build twice and compare all output bytes. Import serve.ts with a mocked node:http createServer to capture its unchanged request callback without listening. Check each requested URL. Use installed Chromium through a debugging pipe for actual WebGL and interaction checks if available. No network listener.

Review focus: camera visibility; high-speed collision tunneling; car exit beside a wall; restricted/corrupt localStorage; deterministic staged scenes and playable restart. Defer sound and richer AI to session 2; extended content/polish to session 3. Do only blocking fixes after verification.

## Session 1 handoff

Implementation complete; source review performed by a fresh reviewer. Review found global menu key suppression: reproduced with a failing test, fixed by capturing movement keys only during active gameplay. All 11 core tests now pass, including mission payout exactly once, all three car models, wall/car collisions, blocked-door exit, jump, deterministic geometry, traffic/pedestrian movement, saves, and staged scenes.

Verification commands:
- `node --test --test-isolation=none tests/core.test.mjs` — 11/11 pass.
- `node tests/serve-check.mjs` — HTTP 200 and correct content for `/`, `/src/main.js`, `/?shot=start&seed=1`, `/?shot=play&seed=1`, `/?shot=end&seed=1`. Captures the unmodified server's callback; never opens a port.
- `node tests/package-check.mjs` — full package byte-identical on repeat, game 54,517 bytes, dossier 142,186 bytes, no external URLs/request APIs/Math.random in game/.
- `node --check` for every game source module — pass.
- Actor and city geometry finite — pass (89,979 static vertices, 45,162 moving vertices).
- `node tests/browser-check.mjs` — BLOCKED before game loading: installed Chromium SIGABRT at `sandbox_host_linux.cc:41`, `shutdown: Operation not permitted`. No browser-render or console success is claimed. Do not mistake this launch error for a game console error. Browser test is retained for an environment allowing Chromium internal sockets.

No screenshots changed; no commits, remotes, pushes, external assets, or previous implementations used. Keep vendor kit and serve.ts unchanged.

Session 2: WebAudio and richer police/traffic/pedestrian behavior. Session 3: content expansion and playability/visual polish. Dedicated later session: run real-browser interaction/render checks and place verified start/play/end screenshots. Current shots run a live loop with fixed actor compositions; movement releases staging into gameplay. Do browser verification before visual rewrites. The world is batched; moving geometry currently rebuilds each render and is a candidate for optimization if browser measurements justify it.

## Session 2 handoff — systems and polish

The session-2 user specification supersedes the older future-work split above: all five missions and the requested systems are now implemented. Work stayed in this repository; no history, other builds, credentials, external assets, browser attempts, screenshot writes, commits, remotes, or pushes. See `docs/session-2-plan.md` for implementation decisions and review evidence.

New modules:
- `ai.js`: shared 24-second intersection signal cycle; right-lane traffic route updates with braking/gap checks; sidewalk/crosswalk pedestrians with waits, separation and flight; building sight checks.
- `justice.js`: per-crime eight-second cooldowns; capped wanted stars; unseen 25-second decay; 1/2/3 pursuit cars, simple street-grid pursuit/ramming and deployed officers; two-second detention; health regeneration/damage; precinct/hospital recovery, 20% cash loss and mission retry.
- `combat.js`: on-foot F punch and left-click horizontal pistol ray; target hit flash, temporary fallen actors, three pistol hits for police, ammo accounting, visual tracer and sound cues.
- `audio.js`: gesture-created WebAudio oscillators for engine, siren and all requested one-shot cues; M master mute; pause/hidden-tab silence. Headless lifecycle tests use an audio API stub; actual sound has not been heard here.

Existing modules remain ES modules. Simulation integrates crime/collision damage, AI, combat and mission events at the fixed step. The renderer is still the same batched raw-WebGL system, with one additional local procedural billboard texture and a simple dusk window-light shader branch. World geometry adds traffic signals, original tourism billboards, hydrants, benches, bus stops and a low teal rooftop with exterior east stairs and a landing. Cars have brighter brake lights and dusk ground headlight cones; existing car/ped blob shadows are retained. Police light bars flash. No new dependency or external file is used.

Mission state contract: 0 = First Pickup collection, 1 = its delivery, 2 = Checkpoint Run, 3 = Repo Job, 4 = Rooftop Drop, 5 = The Big Score, 6 = story complete/free roam. `stage` is 0–4 for checkpoints, 0/1 for repo theft/delivery, and 0/1/2/3 for diner/bank/vault/escape. Rewards are $750/$900/$1,100/$1,250/$2,500; total job earnings $6,500. Each completion restocks ammo to 24. Mara's two-line dialogue is nonblocking and timed. The vault timer advances only within 18 m of the bank. Repo delivery checks the exact car and requires damage below 60 (condition above 40%). Timeout resets the race; heavy damage replaces the repo target at the marina. Busted/wasted clears the current job stage and grants seven seconds before the job resumes; M4 forces two stars again afterward. M5's vault forces three stars until escape starts. Completion has a story screen and free-roam continue button.

Saves keep the existing storage key/version and validate extra stage, timer, vault time, y, ammo, repo damage, earnings and story fields. Legacy session-1 mission=2 saves now start Checkpoint Run, with $750 earnings inferred. Save on each mission revision and recovery as well as the existing periodic/pagehide/manual paths. Continue restores the specific repo car during delivery and the owned starting Falcon during bank stages so the chain stays playable. New game resets actors from the seeded initial population. Storage failure is still tolerated.

Controls: WASD/arrows move/drive; Shift run; Space jump/handbrake; E enter/exit slow cars; drag mouse orbit/aim; left click fires on foot and requests pointer lock; F punch within 2 m; M mute; P/Esc pause; K save. The starting Falcon is owned. Other first-time takeovers are theft; taking a cruiser transfers it fully to player control while a separate patrol replaces it.

Shot staging: start/end camera and actor coordinates retained. Play police moved to (-0.8,-15) behind the hero at (2.8,-23); camera widened and raised to eye (10.5,7.8,0), target (0.7,1.1,-24), FOV 1.10. Staged actors stay fixed until released, preserving repeatability. This is a source-level composition correction; actual framing still requires the dedicated browser session. Screenshots remain the kit starter images.

Acceptance run in session 2:
- `node --check` directly on all 13 `game/src/*.js` modules — PASS. A first child-process wrapper hit sandbox EPERM; direct shell invocations all succeeded.
- `node --test --test-isolation=none tests/core.test.mjs tests/systems.test.mjs` — 24/24 PASS. Required smoke items individually pass: movement, entering a car, crime raises wanted, police spawn/scaling, mission waypoint trigger, save/load. Additional coverage: complete mission chain and single payouts, retries, rooftop stair ascent, correct repo vehicle, wanted decay/recovery, actual two-second arrest, impact damage, combat ammo/hits, signal stops/gaps, pedestrian waiting/crossing/flight/separation, audio gesture/mute/pause, cruiser takeover.
- `node tests/serve-check.mjs` — five HTTP 200 responses for `/`, `/src/main.js`, and all three seeded shots. Captures the unchanged handler in-process; no listener.
- `node tests/package-check.mjs` — executes `MAKEFUN_OUTPUT_DIR=out node main.ts` twice; every packaged file byte-identical. `dossier.json` 172,890 bytes; `game/` 15 files, 84,562 bytes; `index.html` 4,894 bytes. Well below 993 files / 48 MiB / 1 MiB caps. Output is ignored; do not commit it.
- `rg -n 'http://|https://|fetch\s*\(|XMLHttpRequest' game` — no matches (expected exit 1). Package check also verifies no `Math.random`.
- Procedural mesh finiteness — PASS: 107,703 static and 46,440 actor vertices with dusk headlights. This does not prove shader compilation or rendered correctness.
- README updated with all missions/controls and all three existing make.fun live badges retained.
- Fresh read-only code review found one blocker, occupied cruiser AI ownership; reproduced and fixed, final suite green. No outstanding concrete review defects.

Session 3 priorities and honest limits: tune pursuit steering/cornering, traffic queues, pedestrian reactions, mission timing and police difficulty through playtesting when the environment permits it. AI uses simple grid routes and proximity steering; combat aims horizontally with broad target bounds rather than articulated hitboxes. Pedestrians fall temporarily and recover; this is intentionally lightweight. No browser rendering, console, shader compilation, audio output, pointer-lock interaction, HUD overlap, FPS or actual chase framing has been verified here. Keep shader changes simple until the later real-browser pass; missing EGL and Chromium SIGABRT restrictions still apply. Do not attempt browser tests in this sandbox. The dedicated post-session-3 pass must verify interaction, rendering/console, sound and all three shots, then replace screenshots. Do not claim the current starter screenshots prove the new build.

## Session 3 handoff — pursuit, passenger, final headless verification

Completed the requested economical blocker pass in order. No history, other implementations, credentials, network assets, browser attempts, screenshots writes, commits, remotes or pushes. All writes remained in this repository, including ignored `out/`. The three make.fun live badges remain in README. Screenshots are still the supplied Block Dodger starter images and must be replaced in the dedicated following session.

Pursuit baseline and fix: `tests/chase-check.mjs` runs a reproducible 60-second, seed-1, five-star chase with three patrols and normal traffic updates. The scripted target follows a street rectangle at 12 m/s; patrol steering, collisions, damage/ram logic and recovery run normally. It isolates pursuit from player driving skill and prevents health loss/wanted decay from terminating the measurement. Stuck means absolute patrol speed below 0.5 m/s, including initial acceleration. Before: patrols 15.00 / 10.05 / 16.85 seconds stuck, total 41.90 out of 180 patrol-seconds; at least one stuck during 33.63 of 60 seconds. After: 5.33 / 2.67 / 4.15 seconds, total 12.15 (71.0% reduction); at least one stuck during 8.28 seconds. Longest continuous stop fell from 9.07 to 4.10 seconds. Each patrol used reverse recovery once. Cars now traverse a breadth-first adjacent-junction road graph, preserve a waypoint until reached, brake before corners, and reverse for one second while changing heading after two seconds stuck. Local close-range interception remains. Sticking is reduced, not eliminated; do not claim sophisticated AI or browser chase quality.

Dante was missing. `hasDante` derives occupancy from M5 stage/current car, so pickup, car swaps, restored saves and final drop-off need no extra persisted flag. `carGeometry` reuses the pedestrian builder with a seated torso/head, only while aboard. Thin front/rear cabin panes and an open side window keep the figure exposed. Tests check pickup/drop-off state, finite meshes and all three models. Actual passenger visibility still needs browser inspection. Pistol targeting was left unchanged: a shot aimed at a nearby seeded sidewalk pedestrian registers a hit; police three-hit behavior and punch also pass. Horizontal aiming remains a known limitation.

Mission sanity: M2's complete street route from the previous delivery is 504 m, 84 seconds at the slowest normal traffic cruise of 6 m/s (6-second margin against 90); at mean cruise 7.8 m/s, 64.62 seconds (25.38-second margin). A headless car traverses that route with scenery/parked-car collision checks and completes every checkpoint. Those budgets exclude signals, queueing and driver errors. M4 has a continuous collision-tested walking route from salvage via the east stairs and landing to the roof: 67.23 seconds at 3.4 m/s, no mission deadline. This test isolates physical traversal from police survival, then checks on-foot/height and minimum-two-star completion conditions. M5's vault ignores out-of-range waiting and advances at 20 seconds plus at most one fixed tick in range; full sequential story completion/payout and save/load also pass.

Framing: new `tests/polish.test.mjs` uses the renderer's actual perspective/look-at matrix functions and projects every vertex of both subject meshes, requiring a 5% viewport margin at 1280×720 and 1440×900. All pass, so shot staging coordinates/cameras were retained. Center coordinates below use car y=0.85 and Rae y=0.95; origin is top-left, units are pixels.

| Scene / subject | 1280×720 (x, y) | 1440×900 (x, y) |
| --- | --- | --- |
| start / hero car | 726.52, 445.58 | 828.15, 556.97 |
| start / Rae | 689.88, 413.97 | 782.35, 517.47 |
| play / player car | 676.53, 375.68 | 765.66, 469.60 |
| play / nearest police | 494.39, 426.41 | 537.99, 533.01 |
| end / delivery car | 688.67, 429.77 | 780.83, 537.21 |
| end / Rae | 583.31, 433.27 | 649.14, 541.59 |

Cleanup removed unused sign metadata, grid/green palette exports and an unread pedestrian flight assignment; no TODO/FIXME markers remain. The first full acceptance run caught an accidentally removed, still-used palm trunk palette entry; restored it and reran the full suite successfully. README's mission list and controls match the final code, including M4's minimum wanted level and Dante's passenger representation. No shader or HUD layout rewrite was attempted without a browser.

Final acceptance commands:
- `for module in game/src/*.js; do node --check "$module" || exit 1; done` — all 13 modules pass.
- `node --test --test-isolation=none tests/core.test.mjs tests/systems.test.mjs tests/polish.test.mjs` — 32/32 pass, including movement, enter/exit, crimes, 1/2/3 patrol counts, chase/recovery, punch, pistol hit, every mission transition, vault wait, save/load and story completion.
- `node tests/serve-check.mjs` — in-process HTTP 200 for `/`, all 13 modules, all three seeded shot URLs (17/17); no socket/listener.
- `node tests/package-check.mjs` — PASS: runs `MAKEFUN_OUTPUT_DIR=out node main.ts` twice; all 19 packaged files byte-identical. Final dossier 174,385 bytes; game 15 files / 86,037 bytes; index 4,894 bytes. Under 1.5 MiB / 48 MiB / 1 MiB and fewer than 993 game files.
- `rg -n 'http://|https://|fetch\s*\(|XMLHttpRequest|TODO|FIXME|XXX|HACK' game` — no matches (exit 1 is expected).

The following session must launch in an environment with working WebGL/browser support, inspect real rendering and console output, sound, input/pointer lock, HUD overlap, frame rate, Dante's seat visibility, police/traffic behavior and practical mission difficulty. Inspect `?shot=start&seed=1`, `?shot=play&seed=1`, `?shot=end&seed=1` for occlusion and UI coverage; projection checks establish frame inclusion only. Then place real-browser screenshots and rebuild/reverify the dossier. No browser, shader compilation (prior missing `libEGL.so.1`), console, sound or visual success is claimed here. Do not run the retained browser test in this sandbox.
