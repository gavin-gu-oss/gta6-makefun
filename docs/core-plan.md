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

## Session 2 handoff — clean systems re-record

This session re-authored systems in one Codex thread. The designated AI/audio/combat/justice modules, systems tests and session-2 plan were deleted first and written anew. Current repository files were used only as interface and behavior specifications; no history, other implementations, agents, credentials, downloads or browser runs were used. All writes stayed in the requested repository. No commit, remote or push was attempted. The session-1 and session-3 sections of this document are retained intact.

The raw-WebGL renderer, seeded world and ES-module structure remain. `ai.js` provides a shared 24-second signal cycle, lane-following traffic with queue braking, sidewalk routes, crossing waits, pedestrian flight/separation, road graph routing and sight checks. `justice.js` handles independent eight-second crime cooldowns, five-star cap, unseen 25-second decay, one/two/three patrols, ramming, deployed officers, two-second detention, health damage/regeneration, and precinct/hospital recovery with 20% cash loss. Recovery increments the save revision, resets the current job stage and grants seven seconds before retry. Taking a cruiser clears police/traffic control, retains its light bar and allows an independent patrol to replace it.

Patrol behavior from the later polish pass is preserved in the fresh implementation: breadth-first adjacent-junction routes, retained waypoints, corner braking, close interception and one-second reverse recovery after two seconds obstructed. The unchanged 60-second chase reports exactly the supplied 12.15 stuck patrol-seconds: 5.33 / 2.67 / 4.15 per car, longest stop 4.10 seconds, one reverse recovery each. This is a repeatable headless scenario, not a claim that cars never stick.

`combat.js` supplies the on-foot nearest-person punch, horizontal pistol targeting with broad hit widths, ammo, tracers, flashes and temporary falls; officers survive two pistol hits and fall on the third. A newly authored test exposed a thin-wall defect in sampled sight checks. Pistol range now clips against exact rectangular building intersections before choosing an actor; the regression changed from failing to passing. Police visibility/routing behavior remains unchanged. `audio.js` lazily creates WebAudio voices on a user gesture: speed-linked engine, alternating siren, pickup/completion, gun/punch/crash, click and wanted cues. M mutes the master; pause, hidden tabs and the story screen silence continuous voices. There are no audio files or network assets.

Mission states remain 0/1 = First Pickup collection/delivery, 2 = Checkpoint Run, 3 = Repo Job, 4 = Rooftop Drop, 5 = The Big Score and 6 = free roam. Stages track five checkpoints, exact gold Falcon theft/delivery, or diner/bank/vault/escape. Rewards remain $750/$900/$1,100/$1,250/$2,500 (total earnings $6,500); every completion restocks 24 bullets. The race has 90 seconds; repo damage of 60 or more resets its target; M4 requires foot travel and roof height while forcing two stars; the bank vault requires 20 seconds within 18 m and forces three stars. Completion pays once, opens the story screen and offers free roam. Dialogue, objectives, beacons, minimap targets, reward and recovery banners are integrated in the DOM HUD.

Version-1 saves retain position/height, health, ammo, earnings, mission stage/timers and repo condition with finite-number checks and bounds. Continuing a repo delivery restores the target car; continuing M5 after pickup restores a car and derives Dante occupancy from stage/current car. Mission revisions and recovery trigger saves alongside manual, periodic and page lifecycle paths. Restricted or malformed storage remains nonfatal. The seated passenger model and rooftop follow-camera target are preserved.

World/render integration was re-authored for signal housings/lenses, billboards reading VISIT PORT SOLANO, hydrants, benches, bus shelters, exterior roof stairs and landing, brake lights, dusk headlight cones, temporary fallen bodies, blob shadows and selected dusk window lights. The renderer remains batched and dependency-free. Start/end staging is retained; play staging keeps the patrol behind the hero with the tested raised/wide camera. All subject vertices still meet the unchanged five-percent viewport-margin checks at both tested resolutions. These mathematical checks do not establish visibility through occlusion or HUD coverage.

Acceptance in this re-record:
- Direct syntax checks on all 13 game modules and both changed test files passed.
- Full core/systems/polish suite passed 32/32 after the thin-wall fix; the unchanged eight polish tests passed, including passenger, aim assist, roof traversal, vault timing and framing.
- Standalone chase check passed with 12.15 stuck patrol-seconds, preserving the supplied result.
- In-process serve check passed HTTP 200/content checks on all 17 routes without opening a listener.
- Package check ran MAKEFUN_OUTPUT_DIR=out node main.ts twice and compared every output: byte-identical, 19 package files. Final packaging is repeated after this handoff refresh; exact dossier size is reported in the session response.
- Game size: 15 files / 91,349 bytes; index.html: 5,046 bytes. Both are far below the file/48 MiB/1 MiB limits.
- Runtime scan for http://, https://, fetch calls and XMLHttpRequest found no matches. Package check also rejects Math.random.
- Author self-review only, as explicitly required by the no-agent instruction. No outstanding blocking defect was found in the reviewed systems contracts.

Known limits: traffic and pursuit remain simple proximity/grid systems; patrols can still pause or reverse. Pistol aim is horizontal with assisted target widths, pedestrians recover after falling, and mission difficulty still needs actual playtesting. Browser rendering, shader compilation, console, sound output, pointer lock, HUD layout, frame rate, passenger visibility and real chase framing remain unverified. Screenshots, vendor, protected files and README were not changed. Do not attempt browser-check in this sandbox; a later session must perform that verification.

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
