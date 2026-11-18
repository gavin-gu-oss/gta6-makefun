# Session 2 implementation plan and ledger

The user's session-2 specification is the design authority. Extend the existing ES modules and batched raw-WebGL renderer in this directory only. No history, other implementations, credentials, network assets, browser launch, screenshot changes, commits, or remotes.

Architecture: add focused AI, justice/combat, and synthesized-audio modules. Simulation owns fixed-step updates and event cues. Preserve mission states 0/1 for First Pickup; state 2 begins Checkpoint Run. Save explicit stage/timer fields with validated version-1 compatibility. Rooftop access uses a visible exterior stairway with a walkable ramp surface.

- [x] Write focused failing headless tests for crimes/police, recovery, traffic signals/gaps, combat, mission chain/retries, rooftop access, and persistence.
- [x] Implement AI and justice/combat; integrate movement, collisions, and event cues.
- [x] Implement missions 2–5, save sanitation, dialogue, timers, rewards, and free roam.
- [x] Add synthesized sound, HUD/input, street props, lights, and chase shot composition.
- [x] Run source checks, core/system tests, in-process serving, repeat packaging, and runtime-network scan once; fix blockers only. Update README and handoff with evidence and limitations.

Review focus: failed missions remain retryable; police cannot bust during staging or menus; save recovery restores required mission vehicles; rooftop is physically reachable; audio remains silent until a gesture and respects mute/pause.

Ruling: use the supplied workspace and execute inline; the user explicitly requires all work here, no commits, and an economical acceptance pass. Do not create worktrees or run workflow helpers that inspect history. The detailed specification authorizes implementation without an additional design approval loop.

Implementation evidence: initial focused suite failed on missing new system modules; implementation brought core + systems to 18/18. Review regressions then reproduced wrong-car repo delivery, delayed recovery saves, and low rooftop camera targeting; fixed at their owning modules, suite 21/21. Added coverage for actual red-light stops, pedestrian crossing/flight/separation and gesture/mute/pause audio lifecycle; focused systems suite 12/12. Existing driving test now uses the owned hero so police pursuit does not confound its control assertions. First Pickup completion now expects the next checkpoint marker.

Ruling: mission 2–4 rewards are $900/$1,100/$1,250; the request leaves these amounts open. Total story earnings are $6,500. Timed routes reset immediately; damaged repo targets are replaced; busted/wasted retries get seven seconds of breathing room. These choices need browser difficulty tuning if too easy or hard.

Final review: one fresh read-only reviewer inspected current files without history or other implementations. Sole important finding: a stolen police car remained AI-controlled and saw itself. Regression failed first; takeover now clears police AI ownership, retains cruiser visuals, and spawns an independent pursuit car. Full suite 24/24.

Acceptance: syntax PASS (13 modules); core/systems PASS 24/24; in-process HTTP PASS 5/5; repeat package bytes identical; dossier 172,890 bytes; game 15 files / 84,562 bytes; index 4,894 bytes; runtime request scan empty; all three README live badges retained; static/actor geometry finite (107,703 / 46,440 vertices). The initial Node child-process syntax wrapper encountered EPERM; rerunning each actual `node --check` directly from the shell succeeded. No game changes after acceptance. No browser attempt, screenshots, commit, remote, or push. No deferred concrete review defects; browser-only behavior remains unverified as described in the handoff.
