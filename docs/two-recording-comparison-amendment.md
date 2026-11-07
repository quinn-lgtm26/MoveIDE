# Two recordings, one comparison action

Status: implementation requirements and independent product audit. This amendment supplements LIVE-3 and FE-3; it does not mark two-recording acceptance complete. The reviewed root currently renders `Compare({report,clipSrc,onSeek})`: two reps from one report and one video. Existing rep comparison remains useful and must retain its honest **Compare reps** title.

## Smallest useful flow

Add a secondary **Compare examples** button to the existing recorded-source action row. Keep the current wordmark, Recorded clip/Live camera navigation, pill buttons, dark video surfaces and pale rounded panels. Do not add a new setup wizard or make people start each fixture manually.

1. One click loads `clear-squat.mp4` and `supported-squat.mp4`, snapshots the selected model/configuration and analyzes both. Show a reserved progress/status area with each named source. Scheduling may be sequential to avoid competing Heavy workers; “one action” does not require simultaneous inference.
2. Open **Compare two recordings** with two video cards labeled **Example A · Clear side recording** and **Example B · Supported side recording**. Each card owns its report, source identity, video clock, geometry and selected rep. Default to its first complete usable rep, rather than choosing the apparently best result after inference.
3. A prominent **Compare bottoms** control seeks each selected rep to its own measured bottom. Optional Start/Bottom/End phase controls use each report's corresponding anchors; a missing phase stays unavailable. Show both actual timestamps. Independent scrubbers remain available. “Synchronized phase” means equivalent phases, not identical file time or equal movement speed.
4. Show three first-line rows: projected knee flexion at bottom, torso lean at bottom and rep duration. Keep detailed hip/ankle/depth proxies under **More measurements**. Display measured differences descriptively, with source/view limits and missing values, rather than an overall grade. Evidence controls carry source and rep names in their accessible labels.
5. **Back to recorded review** restores a clear single-source context. A new source selection or model change cancels/replaces comparison work. Comparison must not leave a skeleton or coaching card from A drawn over B.

The initial compare action can be entirely local and must say **Local comparison**. It must not imply that two newly loaded recordings received AI review merely because the account is connected. If this increment also enables automatic comparison coaching, use the same disclosed Start authorization, bounded approved images and separate validated source bindings; no second Generate/Send action. Show which source each accepted AI observation cites. Automatic cross-recording AI is a separate acceptance slice until it is actually implemented and tested.

## Meaning of the examples and colors

Both recordings are real attributed dataset clips; their people/capture conditions differ. These examples demonstrate measurement and navigation, not a controlled before/after experiment. Link [fixture attribution](../fixtures/squat/README.md). Dataset “good/bad” labels are metadata, not MoveIDE clinical validation. `sample-squat.mp4` is a hard tracking case, not a bad-posture example.

Do not title these cards Good squat/Bad squat. Green means a disclosed selected target was met with usable phase evidence; amber means that same target was missed with usable evidence; gray means unavailable or uncertain. Without a target, keep a neutral overlay. Never color Example A green and B amber solely because of their filenames, different angles or larger/smaller metric values. A convincing good/needs-attention demonstration still needs a reviewed, independently annotated pair with the intended observable difference. Current clips do not close that requirement.

Use the same model ID, version, asset hash, protocol and metric definition for comparable values. View, anatomical side and units stay visible in details. A camera-plane difference across different people/cameras is not proof of technique improvement. If definitions/views are incompatible, withhold the delta and explain the mismatch; retain each valid source result. Unavailable is never zero.

## Engineering contract and lifecycle

Consume the shared comparison/report helper; do not reproduce geometry or rep segmentation in the UI. The transport agent owns the agreed synchronous API: `compareRecordings({report, source, repId?, sourceSha256?}, {report, source, repId?, sourceSha256?})`. It returns two slot-labeled sources with provenance/anchors, per-source metric values and exact timestamp references, delta and comparability/eligibility. Omitting `repId` selects the first complete rep. Confirm the final exported type before implementation; these are API semantics, not an invented UI-local geometry engine.

The helper treats the same URL/Blob or equal supplied source hashes as duplicate recordings. Different URLs without digests establish reference-only distinctness, not proven different content. Compute hashes from the actual loaded fixture bytes for the shipped examples. An imported report with only caller-supplied association remains unverified; a digest declaration alone does not prove the report was produced from those bytes. Different model/protocol definitions preserve individual values but withhold deltas.

- Comparison owns a generation and two explicit source slots. Bind each report to the actual source hash/identity. A repeated `rep-1` or measurement ID is unique only within its source; never key combined UI or citations by bare rep ID.
- Snapshot the chosen model/configuration at action start. Abort or reject obsolete results on replacement, model change, cancellation and unmount. Revoke owned object URLs and remove obsolete overlays. A delayed fetch or AI reply cannot overwrite the newer session.
- Match phase seeks by each selected rep's report timestamps. Wait for that source's seek completion before presenting evidence/overlay. Overlays use the decoded media clock and normal quality gates; never copy A's time/pose onto B.
- Loading, failed decode, no complete rep, unavailable metric and canceled analysis are distinct states. If one clip fails, preserve the valid other result with its identity; show a scoped retry for the failed source rather than fabricating a pair.
- Scrubbing, playback, phase navigation and changing selected reps use stored reports/responses. They make no provider calls and add no duplicate cards. If per-source AI is included, request count is bounded at analysis/session creation; a new inference action or changed authorization requires explicit policy rather than an incidental React effect.
- Mobile stacks A then B with source headings next to every control. Keep phase controls reachable, preserve focus, contain any wide table within its panel and avoid page-level horizontal scrolling. Buttons need source+rep+phase accessible names; keyboard users can choose either rep and seek either player. Do not announce every metric tick.

## Acceptance before marking LIVE-3 done

| Gate | Required evidence |
| --- | --- |
| One action, two actual sources | Click Compare examples once; both actual fixture hashes and separate reports are present, both Heavy analyses complete, each yields usable selected reps. No packet/copy action required. |
| Correct phase association | Compare bottoms reaches each report's own bottom within the existing source-frame tolerance. Select another rep and verify both labels/timestamps/overlays remain source-bound. Different rep timing must not be normalized into fake equal file time. |
| Comparison validity | Same model/protocol is recorded; three primary values come from their correct reports. Missing/incompatible values show unavailable or no delta. No invented good/bad labels or automatic “improved” verdict. |
| Lifecycle race | Replace source or change model during loading/analysis; old completion cannot replace the newer view. Cancel/unmount clears owned work and URLs. Reused rep IDs across sources do not collide. |
| Failure recovery | One corrupt/unsupported recording or no complete reps produces a source-specific explanation; the valid other source remains inspectable. |
| Navigation and cost | Multiple seeks, phase changes and rep changes cause zero additional interpretation requests and no duplicate accepted coaching cards. Local-only comparison is explicitly labeled. |
| Responsive and accessible | Check desktop and375/390px widths, keyboard focus/labels, expanded details and long source names. No body overflow, inaccessible evidence button or source confusion. |
| Optional AI comparison | Real connected request(s) use bounded authorized images; accepted citations bind to the correct source/report and remain visible as concise historical cards. Controlled-provider tests alone do not satisfy real-provider acceptance. |

Record exact revision, browser, model/configuration and mock/real provider scope. This feature's passing test is not a physical iPhone, independent angle-accuracy or final Wren verdict.

## Explicit requirements still open after local two-recording delivery

- Independently annotated goal-met versus needs-attention recordings and evidence-based color/cue precision; neither hard tracking nor dataset labels substitute for this.
- Physical iPhone/Mac rehearsal on venue Wi-Fi, including camera permission, foreground/lock, reconnect/Stop and measured end-to-end latency. Existing real public HTTPS/ChatGPT return used two Chrome contexts and a fixture camera.
- Reliable continuously moving/orbiting-camera tracking: person and left/right continuity, camera/view changes, bounded smoothing latency, baseline reacquisition and independently measured per-view metric/cue accuracy. Integrated heuristic guards and experimental3D outputs do not establish this.
- Reviewed frontal/oblique knee-inward projection, body-region emphasis and personalized/reference goals, with per-metric quality and persistence; no clinical valgus or injury claim.
- Full source-bound temporal interpretation beyond sparse approved phase JPEGs. Three images improve coverage but do not mean the model inspected every video frame.
- Final responsive/accessibility review, including zoom, reduced motion and cue-history focus/scroll behavior, on the complete combined interface.
- Two Wren core workflows rerun against the same final build, with debit reconciliation; Seldon remains held until the product is ready.
- An actual named subscription/workflow replacement for the hackathon pitch, supported by demonstrated behavior rather than invented savings or a promise of winning.

Native OpenCap inference and broad non-squat movement expansion remain explicitly deferred by the user; retain the existing imported-unverified adapter without presenting those deferred directions as completed capabilities.
