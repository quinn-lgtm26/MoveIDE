# Demo and documentation handoff

Updated November 7, 2026 Pacific. The user accepted the demo and requested documentation only. Runtime `ab492c0` is unchanged by this handoff.

## Run on another computer

Clone [MoveIDE](https://github.com/quinn-lgtm26/MoveIDE), or safely update an existing checkout, then run `npm run demo`. Node.js 22.18+ and Chrome are prerequisites. The launcher installs dependencies and verifies model assets. Keep its terminal open. See [quickstart](quickstart.md) and [copy-paste AI setup instructions](AI-SETUP.md).

Choose **History → Open demo session**. This imports the approved 60.2-second recording under a fresh local ID, preserving seven detected reps, six AI notes, 75 evidence images, 198 archived measurements and 903 cached pose frames. It needs no ChatGPT connection or new AI request. Export session / Import session moves another recording and its saved analysis between devices. Local history does not synchronize automatically.

For new AI coaching, use the header's **Connect ChatGPT** and your own eligible account. Local measurements work without it. Stop saves the session and lets queued reviews finish while the original tab stays open. Starting again cancels unfinished reviews; closing the tab interrupts them.

## Show the demo

1. Open the saved demo, play it, and pause to inspect the pose overlay.
2. Select **Rep 5 → Why** for the cue about lowering hips and bending knees together; Rep 6 discusses bringing the chest up with the hips.
3. Inspect saved images and the movement graph. The example curve is a comparison, not a universal ideal squat.
4. Show **Export session** to explain moving the full saved run to another computer.

The camera tips in reps 1–4 are original accepted feedback: feet are clipped in the source evidence. They are not connection or inference failures. Seven detected reps with six notes reflects the six-review cap. Notes are preserved, not rewritten for the demo.

## Evidence and remaining issues

- Local suite: **150 passed**, typecheck/build passed; exact public preflight: **12 passed**.
- Published demo: **10 replay checks passed**, including original video hash, reload, paused overlay, reviewed/unreviewed navigation and no new AI request. [Evidence](../qa/published-demo-replay.json).
- Latest Wren run: **one reported failure, one case without a verdict** at this snapshot. [Partial report](../qa/wren-release-partial-results.json), [hosted run](https://app.seldon.com/experiments/f0047a86-ebfb-4918-924e-cec64026bdb6), [budget ledger](../qa/seldon-ledger.md).
- Wren reports a misleading session-unavailable error after reloading a renamed recorded session, despite the card remaining visible. It also flags download naming and scattered download controls. These remain open findings; this documentation update does not fix or independently reproduce them. If encountered, return to History and try reopening the listed session; do not delete browser storage.

The saved demo is verified for recording a presentation. **A clean final hosted QA pass is not established.** Earlier Wren passes apply only to their listed builds.

## Scope to describe honestly

AI receives bounded source-image sequences and measurements, not every frame of the entire video. Up to 32 images per reviewed rep are selected from eligible analyzed frames. Original live-note timestamps are approximately aligned; cached pose replay follows the encoded video's timestamps. Missing tracking remains missing.

Angles are single-camera estimates, not independently validated anatomical measurements. Reference bands are comparison aids, not validated error bounds or guaranteed good form. Native OpenCap inference, arbitrary-angle accuracy, cloud history sync and the proposed chat feature are outside this finished demo. Physical-phone and broader accuracy acceptance remain separate from automated fixture tests. See [tracker](../tracker.md) for the wider backlog.

## Developer evidence map

These are inspectable deliverables for the original harness scope, not a claim that every later product backlog item is finished.

| Requirement | Implementation and evidence | What it establishes |
| --- | --- | --- |
| Real AnalysisReport v1 | [Schema](../_bmad-output/specs/shared/analysis-report-v1.schema.json), [clear report](../harness/results/clear-squat.analysis-report.v1.json), [supported report](../harness/results/supported-squat.analysis-report.v1.json), [fixture verification](../harness/results/fixture-verification.json) | Heavy browser inference produced schema-valid source-bound outputs for the selected clips. |
| Labeled rep count and bottom timing | [Clear labels](../fixtures/squat/clear-squat.labels.json), [supported labels](../fixtures/squat/supported-squat.labels.json), [verification code](../harness/verify/fixtures.mjs) | Each selected clip has 2 detected / 2 labeled reps. Bottom errors are 0 and 67 ms in each clip, within the stated 150 ms tolerance. This is four bottom events, not a population accuracy estimate. |
| Failure visibility | Same fixture-verification artifact, `sample-squat.mp4` case | The older occluded clip has 0 detected / 2 labeled reps and a failed manual-label comparison. The verifier accepts the explicit intermittent-tracking warning for this challenge; a green suite does not mean this clip's reps were recovered. Three additional side-view cases are exploratory without reference labels. |
| Frontend API and examples | [Harness API](../harness/README.md), [motion module](../harness/motion/analyze.mjs), [frontend amendments](frontend-harness-amendments.md) | `analyzeSquat`, `getMotionTrace`, `getSquatProfile`, cancellation/progress, original-source binding, unavailable states and integration examples. |
| Versioned evidence and coaching | [Coaching exports](../harness/coaching/index.mjs), [example packet](../harness/results/clear-squat.coach-packet.v1.json), [source-image verifier](../harness/coaching/verify-fixture.mjs) | Packet/image validation, exact-source JPEG checks and `formatManualHandoff` remain available to developers. The user's later one-Start requirement supersedes a manual handoff in the normal product flow. |
| Optional connected ChatGPT | [Provider evidence](../qa/sequence-coaching-checkpoint.json), [provider client](../harness/provider/client.mjs) | Two real bounded-sequence requests returned valid citations, with 14 and 12 images and response times of 15.3 and 12.6 seconds. This does not certify full-video understanding or all live sessions. |
| Workflow, ownership and handoff | [Developer guide](DEVELOPMENT.md), [interactive workflow](../workflow.html), [global tracker](../tracker.md), [judge guide](JUDGES-START-HERE.md) | Stack, service boundaries, setup, verification commands, responsibilities, demo flow and outstanding work are documented. |
| External verification | [Seldon ledger](../qa/seldon-ledger.md), [partial final report](../qa/wren-release-partial-results.json) | Historical passes are revision-specific. The latest two-case run is not a clean pass; its remaining verdict and budget settlement are outstanding. |

There are no reference anatomical joint angles in the fixture labels. Geometry/schema checks and model outputs must not be described as measured anatomical-angle accuracy. Use `npm --prefix harness run verify:fixtures` to reproduce the fixture probe in an isolated environment; it prepares assets and writes result artifacts.
