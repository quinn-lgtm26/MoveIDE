# MoveIDE — one-button squat demo

Prepared 2026-11-07. This is a rehearsal/runbook, not a claim that live hardware or final Wren checks have passed. Implementation requirements and story acceptance are in the [product amendment](../_bmad-output/specs/live-squat-product.md).

## The promise

“Video form review should end with something you can try. MoveIDE turns one camera into a local movement trace, shows the evidence behind one coaching focus, and lets you compare your next attempt.”

Describe the paid workflow the team actually wants to replace. Use an actual subscription name/price only after confirming it. Do not claim to replace every service of a personal trainer, provide injury predictions, or save a made-up amount. The product must demonstrate capture → measurable observation → explanation → retry.

## Before the judges arrive

- Use an iPhone and MacBook on the venue network. Mount the rear camera for a stable full-body side view, with feet and head visible. Finish initial pairing, camera permission and optional connected-account sign-in before the timed demonstration; explain these setup steps honestly if asked.
- Confirm the primary **Start coached squat** disclosure: local tracking, bounded evidence sent only to the connected coach during the active session. Start is the session action; no repeated packet assembly or per-rep upload dialog.
- Verify a real live stream and several comfortable reps. Record model identity, usable updates/second, observed delay, connection loss/recovery and whether the AI reply resolves valid evidence. A visible green line alone is not a successful test.
- Select a named comparison goal and inspect its measurement definition. Do not call a default angle threshold a universally correct squat. Do not ask a demonstrator to perform risky movement to manufacture a failure.
- Load `clear-squat.mp4` and `bad-form-squat.mp4`, the same person's dataset-labeled good-form and bad-form squats. Keep attribution accessible from [fixture provenance](../fixtures/squat/README.md).
- For an actual target-met/target-missed showcase, prefer two consented same-person recordings at the same camera position with a comfortable, observable difference such as pace. Independently annotate the selected rep boundaries or target evidence before measuring. Keep file hashes/provenance. If this pair is unavailable, show the truthful two-recording comparison and explain the selected target.
- Verify the exact final commit with both Wren workflows and save the results. Do not spend the held simulations on cosmetic rehearsals.

## Three-minute demo

| Time | Action | What to say / prove |
| --- | --- | --- |
| 0:00–0:20 | Show the ready screen and paired phone | “This replaces the repeated record, upload, ask, and interpret loop. After camera/account setup, one button starts this session.” |
| 0:20–0:55 | Press Start; perform two comfortable reps | Show a readable body outline and rep count. Identify local tracking as local. If tracking is gray, adjust framing; do not narrate success over failure. |
| 0:55–1:25 | Show the completed-rep observation | “This cue refers to rep 2 and this measured goal.” Open its evidence timestamp. Distinguish immediate computed values from the arriving AI explanation. |
| 1:25–1:55 | Repeat, or compare the prepared real pair | Show the same metric/goal on both attempts. Green means target met; amber means measured target missed. Missing evidence stays gray. |
| 1:55–2:25 | Scrub to the relevant frame, then Stop | Show that the line and cue follow the correct evidence time, not a generic summary. Stop ends capture and automatic coaching. |
| 2:25–3:00 | Show final build QA and clear limits | Show two Wren case results for this build. “We validate the complete workflow and frame/rep timing. Independent joint-angle accuracy and clinical conclusions are outside what we have proven.” |

Do not wait silently for an AI request. The local measurement remains useful while a clearly labeled coach request is pending. If it fails, state that and continue with measured evidence; never substitute a canned sentence and call it the live model.

## Minimal visual direction

Let video dominate. Use a calm neutral surface, one high-contrast Start/Stop control, thin skeleton lines, small joints, a short angle arc only where useful, and one active cue. Put source, rep and evidence time beside the cue. Keep a compact legend: **Target met / Needs attention to selected target / Not enough evidence**. Use accessible text and icons with green/amber/gray. Do not label the entire person “bad.”

The secondary panel can show knee flexion, torso lean and rep duration with definitions. Additional trace detail belongs behind an inspect action. The first screen should answer “What should I look at?” before showing every available landmark or metric.

## Failure rehearsals and fallbacks

| Failure | Honest recovery |
| --- | --- |
| Camera denied | Explain permission recovery and offer the recorded demo without repeated permission loops |
| Subject partly outside frame / unsupported angle | Gray overlay/cue with one framing instruction; suspend target judgment |
| Phone locks, backgrounds or disconnects | Clear stale overlay, report stream loss, re-pair or reconnect with a new session generation |
| Venue peer networking blocked | Try a pre-tested relay/network configuration; otherwise switch to tested local camera or recording and label the route |
| Heavy cannot keep up | Show measured processing rate and drop old queued frames; use an explicitly labeled, pre-verified alternate model only if supported |
| AI slow/offline | Keep local measures live; label coach pending/unavailable; reconnect in setup if necessary. Do not divert the person to a manual packet handoff |
| Contrast pair labels | Use the source dataset's good/bad labels for one person's clips and say so in the UI |

Continuity Camera is an optional hardware fallback: Apple supports iPhone-as-Mac-webcam with compatible devices, same Apple Account and nearby Wi-Fi/Bluetooth, including a USB route ([Apple documentation](https://support.apple.com/en-au/102546)). Test the actual browser/device first. Its success must not be presented as verification of the QR/WebRTC feature.

## Evidence sheet to complete

| Gate | Required record | Current status in this runbook |
| --- | --- | --- |
| Build | Final commit, start command, model/configuration | Pending final integration |
| Two-clip comparison | Fixture hashes, target, selected reps, measured values, cue timestamps | Pending integrated check; source fixtures exist |
| Live phone | iPhone/Mac/OS/browser, network, orientation, permission path | Not physically verified here |
| Latency | Method, duration, sample count, p50/p95; achieved pose rate and dropped frames | Unmeasured here; do not quote proposed targets as results |
| Recovery | Stop, lock/background, disconnect, reconnect, stale-response rejection | Pending integrated/device check |
| Actual AI | Provider/model, bounded packet counts, returned valid evidence IDs, timestamps | Requires actual connected-provider check |
| Wren `measure-squat` | Final build SHA, experiment ID, verdict, summary, debit | Final rerun required |
| Wren `compare-and-handoff` | Same final build SHA, experiment ID, verdict, summary, debit | Final rerun required |

Wren allocation: 16 total; 2 earlier smoke simulations used; 14 held pending debit reconciliation. Preserve at least four for final two cases and a rerun. Run after the integrated build is locally ready, then rerun any affected workflow following final changes. An automated browser stream fixture is useful evidence, but does not replace the real iPhone/venue test.

## Judging case

Originality: one transparent loop from real motion to timestamped evidence to a repeat attempt. Usefulness: a person can understand and act on a single selected goal. Works: show actual live behavior, correct replay association, graceful failure, and the two final-build Wren results required for qualification. A polished, truthful squat loop is a stronger demonstration than claiming many movements or unsupported 3D accuracy. These are product priorities, not a prediction of winning.

Budget reconciliation amendment: the latest merged frontend ledger records an additional workbench run with debit pending.14 was the last confirmed balance;13 is expected if that run debited one. Check the account before any final dispatch. No new runs were started for this increment.
