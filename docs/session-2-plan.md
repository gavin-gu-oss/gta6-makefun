# Session 2 clean re-record: systems implementation and handoff

The supplied session-2 request is the design and execution authority. All implementation is authored here in one session. No agents, previous implementations, history, credentials, downloads, browser runs, commits, remotes or pushes. The six designated files were deleted before their replacements were written. Existing files were read solely to establish interfaces and required behavior.

Architecture: keep seeded ES modules and batched raw WebGL. Simulation owns fixed steps and sound events; AI owns street routing, signals and pedestrians; justice owns crimes, pursuit, detention and recovery; combat owns horizontal targeting; audio owns gesture-created synthesized voices. Mission progression stays compatible with the version-1 save format.

## Work sequence

- [x] Replace systems tests with behavioral coverage for traffic, pedestrians, crimes, pursuit counts, recovery, combat, missions, saves, stairs, audio and cruiser takeover.
- [x] Write AI, justice, combat and audio afresh, preserving public exports and later patrol recovery behavior.
- [x] Re-author systems integration in input/simulation/missions, HUD/main, world/render, shots, markup/styles and core tests. Preserve passenger geometry, rooftop camera, mission traversal and staged frame margins.
- [x] Self-review against the request and unchanged polish/chase tests; fix blocking failures only.
- [x] Run syntax, 32-test suite, chase, in-process serving and packaging checks. Build twice, compare bytes, report sizes and scan runtime sources for networking.

Review focus: an occupied cruiser must relinquish AI ownership; detention/recovery must leave a retryable and saveable mission; repo delivery must require the exact target; timers must respect bank range; audio must not allocate or emit before a gesture. Patrols must preserve road waypoints, brake for turns and recover from obstruction without regressing the supplied chase metric.

Execution decisions: use the requested workspace directly and retain the raw renderer; no extra approval, worktree, commit or agent workflow. The user has supplied a detailed design and explicitly authorized implementation. Keep existing reward values ($750/$900/$1,100/$1,250/$2,500), eight-second crime cooldowns, seven-second retry grace and current shot cameras as compatibility requirements. Session-1 and session-3 handoff sections remain intact.

## Evidence

The replacement tests were written before the replacement modules. Their first run failed with ERR_MODULE_NOT_FOUND after the required deletions. The first integrated acceptance run passed 31/32 tests and exposed a real sampled-sight gap: a pistol could hit through a thin building between sample points. Combat now computes exact building-ray range before selecting a target; the same regression passes. This change leaves patrol sight/routing behavior alone.

Final code acceptance: all 13 game modules and both edited test modules pass node --check; full suite 32/32; standalone chase preserves 12.15 stuck patrol-seconds; serve-check passes 17/17 in-process routes; package-check passes with all 19 output files byte-identical across its two builds. Game is 15 files / 91,349 bytes, index.html 5,046 bytes. Runtime networking scan has no matches. Packaging is repeated after handoff edits; final dossier size is recorded in the session response.

Final review: author self-review, with no sub-agents per the user's explicit instruction. Checked exported interfaces, mission retry/save paths, vehicle ownership, sound lifecycle, collision events, exact-wall clipping and the unchanged polish checks. No unresolved blocking issue found. No browser or independent-review claim is made.

Known gameplay limits: grid/proximity AI still spends 12.15 patrol-seconds stopped in the scripted chase; horizontal assisted aiming and temporary civilian falls are intentionally simple. Browser rendering, console, shader compilation, actual audio, HUD overlap, pointer lock, performance, passenger visibility and practical mission difficulty require the later browser session. Protected files and supplied screenshots remain untouched. No commits, remotes or pushes.
