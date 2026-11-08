# Frontend design amendment — one coached session

2026-11-07. **Implementation guidance, not a claim that the complete visual polish is shipped.** This supersedes the historical separate Preview/Interpret/Handoff journey in the original workbench specification. Use with [AI behavior](../AI-AMENDMENTS.md), [concrete shared APIs](frontend-harness-amendments.md), [product acceptance](../_bmad-output/specs/live-squat-product.md) and [delivery status](../tracker.md).

## Latest user correction: calm, actionable, full-body feedback

The user rejected flickering paragraphs and a shifting layout. The primary experience must be a stable video and a stack of concise timestamped coaching cards, with the newest emphasized and a clear highlighted body region. Full analysis remains available without occupying the live attention surface. Front and oblique views are a requested squat-analysis expansion, not permission to claim that arbitrary-angle metrics are already accurate. Track the full visible body, then explicitly gate which measurements and interpretations the view supports.

BMAD UX update mode is applied to these existing, assigned product contracts. User-provided direction controls visual choices; this update does not invent a new brand or create separate competing DESIGN/EXPERIENCE files. Numerical presentation timings below are implementation assumptions to test, not validated biomechanics thresholds.

## Screen sequence and information architecture

1. **Setup / ready:** remembered source, short account/camera status, selected comparison goal and Start. Put first-time camera/account connection on this surface; do not require setup on every rep or hide it inside packet tools.
2. **Phone connection when needed:** private QR/link, expiry, rear-camera permission instruction and connection state. The laptop automatically advances when the phone sends its stream. Native permission is an explicit first-use gesture, not a second Analyze operation.
3. **Session:** full-body video, reserved coaching-feed region, three primary metrics and Stop. No parallel packet, chat and raw-report panels. Local tracking begins immediately when a valid view is available; coaching does not block it.
4. **Inspect:** an evidence action opens the cited moment and an expandable explanation with measurements, uncertainty and affected body region. This is a detail state of the same session, not another upload flow.
5. **Review / compare:** select corresponding reps from independent source recordings, inspect the named goal, then Start a new attempt. Preserve source/view labels and do not compare incomparable angle definitions.

The climax of the intended journey is concrete: the person performs a rep, sees one actionable observation about that rep, opens its evidence if desired, and makes another attempt without moving data between tools.

## Stable stacked coaching feed — latest user correction

The user explicitly chose **“one after the other and stack them”** over observations that appear and disappear. Append concise, timestamped cards when eligible observations arrive; keep prior cards in the active session. The newest card has a quiet accent, not a flashing animation. Each card has origin, source/rep time, one action and **Why this cue?** for full reasoning and uncertainty.

- Aim for **12 words or fewer** for the action and one affected body region. Example capture actions: “Keep both feet in view.” / “Turn side-on for depth measurements.” Example goal action: “Match your selected pace on the next rep.” These are templates, not fabricated observations.
- Reserve a scrollable feed beside the player (below on narrow screens), with a stable outer height; card arrival must not move video or controls. Initial layout target: approximately 280–360 px feed height with visible concise cards; adapt for viewport and text zoom without clipping. Treat this as a design assumption to test.
- Append oldest-to-newest. If already reading the newest card, scroll only inside the feed to reveal the next; if reading an older card or explanation, preserve scroll/focus and show “New coaching”. Reduced-motion mode scrolls without animation. Never auto-scroll the whole page.
- Current bounded retention is up to 12 smoke cards and six live AI cards (matching the request cap); these replace the earlier proposed 20-card default. The designed root must declare its bound and expose when older cards are omitted. This is a presentation/memory policy, not a promise that every detection is a new coaching event. Raw sampled traces remain separate.
- Deduplicate on session/source, rule, body region, phase and rep/evidence event. Numeric jitter alone creates no new card. Local live candidates should persist for an initial proposed 500 ms before becoming an event; a validated completed-rep AI response appends once when ready. These display rules do not smooth or rewrite raw data.
- Previously accepted cards **do not disappear on phase change, playback leaving their interval, or tracking loss**. They remain historical evidence. Loss/view uncertainty clears current geometry and adds or updates a concise capture status; it does not erase valid past observations. A delayed model card says “AI · About rep N” and shows source time separately from arrival time.
- Seek, pause, reverse and replay select/highlight existing evidence; they never duplicate a card or send inference. Source replacement or a new Start session clears history and invalidates pending results. Stop preserves accepted history for review but rejects late arrivals and sends no more requests.
- A selected historical card can seek its exact evidence and highlight its supported region. Never pin that old highlight onto a different current moving frame. Live geometry remains frame-bound; history is not a current-frame diagnosis.
- Each card exposes full source measurements, rationale and uncertainty on demand. Do not cut a paragraph mid-sentence to fake a short action. If structured short AI output is unavailable, keep full AI prose in details and use an evidence-backed local template with an honest origin label.
- No typewriter effect, repeatedly announced frame values, growing paragraph transcript or unconditional auto-focus. Announce a new accepted short card once through a polite live region.

Acceptance: append three valid cues and retain all three after phase changes; replay/seek creates no fourth card or request; inject threshold jitter and produce no duplicate semantic cards. Exercise each configured card cap and verify bounded retention without duplicate insertion. While reading the first card, a new arrival preserves focus/scroll. The player/control bounding boxes remain fixed. Source reset clears the feed; Stop rejects late replies; tracking loss clears only current geometry, not historical cards. Verify narrow viewport, reduced motion and 200% text zoom with no clipped text.

## Body-region highlighting and view-aware capabilities

Keep the whole reliable skeleton visible in a quiet neutral style. Accent only the cited region: the appropriate hip–knee–ankle chain for a knee observation, shoulder–hip segment for torso lean, or foot/ankle region for a view-supported foot observation. Only the current reliable observation or explicitly selected historical evidence gets an active emphasis; retained history does not produce simultaneous flashing regions. Left/right refers to the tracked person's anatomy, with mirrored display handled consistently. If the highlighted points are occluded or confidence fails, remove the accent and show unknown; do not draw a guessed corrective arrow through missing landmarks.

| View / representation | What to show | What to withhold until verified |
| --- | --- | --- |
| Side view, stable camera | Current projected knee/hip/torso/shin metrics and rep timing where their quality gates pass | Frontal knee-inward classification, joint loading, true 3D angles |
| Front view, hips/knees/ankles visible | Full-body tracking; experimental left/right image-plane knee-path change against a person/view baseline | Side-view depth targets and a diagnosis of valgus or injury risk |
| Oblique view | Full-body tracking, view label and only specifically validated projected features; otherwise ask for a supported view | Reusing side-view thresholds unchanged or interpreting foreshortened limb angles as anatomical angles |
| Estimated world coordinates | Optional inspection labeled **Experimental 3D estimate** | A calibrated 3D accuracy claim or silently replacing projected 2D measurements |
| Uncertain/changing view or occlusion | Neutral/gray body points that remain reliable, one short capture instruction | Green/amber target judgments using unavailable geometry |

Google documents 33 pose landmarks and image/world-coordinate outputs ([Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)). The availability of these outputs does not, by itself, validate arbitrary-view joint measurements; that is a product inference requiring independent reference testing. Confidence represents tracker certainty, not a measured joint-angle error bound.

For a frontal knee-path experiment, label the quantity **Knee path in this camera view**. Show a person-specific baseline and the observed inward image-plane change, with units/normalization in details. Do not rename it clinical valgus. A baseline is a reference posture/trajectory, not proof that the reference was correct. Gate on relevant joints, foot visibility, stable body identity, stable camera/view, sufficient baseline samples and a minimum projected limb length; failed gates return unavailable rather than zero.

Calibration should be automatic inside the active session when enough stable frames exist, using “Hold your starting stance briefly.” A selected reference rep may establish the goal; display which rep/view supplied it. Do not silently learn a new reference while issuing a correction, after a camera move, or across people. A viewpoint change invalidates the view-dependent baseline and cues, then reacquires calibration. Temporal persistence must distinguish a sustained observed projection from one noisy frame. Thresholds for new projections remain experimental until their validation story passes.

## Whole-rep reasoning, not bottom-frame storytelling

The video remains the primary evidence surface. Replay highlights the supported phase—descent, bottom, ascent or return—using source timestamps and measured intervals. A depth observation may cite the bottom; a pace, sequencing or knee-path observation needs evidence across time. Do not claim movement direction, control or consistency from one bottom still.

Extend the bounded evidence contract deliberately: retain the local sampled trace; send a compact, source-bound temporal excerpt plus at most four selected phase images where the verified packet version permits. Prefer one rep with useful phase coverage to unrelated extra bottoms when the question concerns a trajectory. The existing packet mainly contains rep measurements/bottom evidence; its unmodified schema must not be described as full temporal understanding. Never substitute a screenshot captured later for an earlier phase. Preserve the six-call/8-second live budget policy and one request in flight.

UI details name the source, view, phase interval, metric/coordinate type, baseline/goal and exact cited evidence times. A concise cue can be simple because the deeper evidence is accessible, not because unsupported conclusions were hidden.

## The first screen

The person should understand three things immediately: where their video appears, how to start, and what will be sent to the coach. Give **Start coached squat** the only primary visual emphasis. Source selection and account setup are secondary. Start coordinates video, Heavy tracking, metrics and authorized AI automatically. It must not reveal a wizard of packet building or model plumbing.

Use the existing recorded, local-camera and phone-source capabilities. A unified primary-app source selector is remaining integration work, not an existing root component. Label choices plainly: **Sample recording**, **Your video**, **Mac camera**, **iPhone camera**. Preserve explicit File selection for a user recording. Show the configured pose model unobtrusively as **MediaPipe Heavy**; model switching is a setup option, not a competing CTA. Do not advertise a source before its working route is wired into this build.

Suggested short disclosure beside Start: “Tracking runs locally. With your coach connected, selected rep images and measurements are sent automatically. The full video is not uploaded.” For phone mode say “Video streams to your paired Mac” so “local” does not imply the picture never leaves the phone. Account connection and browser camera permission are unavoidable initial setup. A completed setup is followed by one routine session action, not a claim of zero permissions.

## Desktop composition

Use a restrained 1200–1280 px maximum-width layout with 24 px outer spacing and 16–24 px gaps. The video takes approximately two thirds of the work area; the remaining column holds the coaching feed and three readable measurements. Keep source, model and connection state on a quiet top row. Start becomes **Stop session** in the same action area; its position should not jump as results arrive.

| Region | Content | Avoid |
| --- | --- | --- |
| Video stage | Full uncropped source, minimal frame-bound skeleton, compact phase/rep label | Cropping feet/head to fill a wide card; stretching a portrait recording |
| Coaching feed | Stacked short timestamped observations; newest emphasized; each labeled **Local target feedback** or **AI · About rep 2** | A paragraph wall, mixed origins, or a delayed AI reply labeled as current-frame measurement |
| Measurements | Knee flexion, torso lean, rep count/duration with units and unavailable state | A global good-form score or unsupported clinical labels |
| Replay strip | Native playback, existing speed, previous/next analyzed sample, rep boundary navigation | Replacing video playback with a second unsynchronized timeline |
| Trace | Existing knee/torso trace, current-time line, visible tracking gaps | Drawing continuous data through missing samples |
| Explanation | Expandable full observations, uncertainty, and evidence-time actions | Hiding uncertainty while presenting conclusions as certain |
| Developer tools | Collapsed report/packet inspection and advanced manual controls | Requiring copy, download or Generate in the normal flow |

Fit the source with `object-fit: contain`. Calculate overlay coordinates from the same displayed content rectangle. Put the cue beside the video on wide screens; if using an overlay caption, keep it in a safe area away from the tracked knees/feet and use an opaque-enough background. Long explanations belong below or in the expandable panel, not across the body. Keep the player and current cue in view together at laptop sizes.

## Narrow screens and the phone sender

Below roughly 800 px, stack video → newest card/feed → primary controls → concise measurements → replay/trace → details. Do not retain a squeezed side column. Allow the portrait video to use its natural proportions with a sensible viewport-height cap, preserving all source pixels. Keep text at a readable system-font size; controls should have at least 44×44 px touch targets. A sticky Stop bar may be used only if it does not cover video controls, evidence text or the device safe area.

The phone is primarily a camera, not a miniature analytics dashboard. The existing sender has **Start camera**, **Stop camera**, camera preview and connection status. Preserve the explicit user gesture needed for camera permission. Show “Rear camera · microphone off” where accurate. Keep the screen awake only through supported, tested behavior; if lock/background ends the stream, state that and offer reconnect. Do not promise background capture.

The laptop phone-pairing panel has a private session link and expiry status in the current implementation. A QR code is a required presentation improvement over that same link, not a new backend contract or an already-delivered control. Generate it locally; do not submit the capability-bearing URL to an external QR service. Keep **Copy link** as the accessible fallback, and explain that the link is private and temporary. Pairing permission is setup; once the stream arrives, tracking starts automatically without another Analyze action.

Phone setup copy: “Open this private link on your iPhone, tap Start camera, then allow the rear camera. Your Mac will start tracking automatically.” If trusted HTTPS is not configured, show “Phone camera setup is unavailable on this address. Use the Mac camera or finish secure pairing setup.” Keep tunnel ports, environment variables and credential architecture in developer setup details. Actual iPhone/venue testing remains mandatory; a QR image alone proves nothing about the stream.

## Color and drawing language

Use a system sans font, quiet off-white or dark charcoal surfaces, generous spacing, modest corner radii, and a single high-contrast primary action. Suggested light tokens: background `#F5F7F5`, surface `#FFFFFF`, main text `#17352A`, secondary text `#52665C`, border `#D8E2DA`. Suggested semantic accents: green `#23744B`, amber `#8A5200`, unknown `#65716B`. These are design starting points; verify contrast against actual composited surfaces before claiming accessibility compliance.

Draw the reliable skeleton with thin rounded lines (approximately 2–3 CSS px), small joints, and at most one useful angle arc near the active measurement. Start neutral. Green means **selected target met with usable evidence**; amber means **selected target missed at its valid phase**; gray means unknown, stale, unsupported or not yet assessable. Use text/icon equivalents with every state. Do not turn the whole body green simply because pose detection succeeded.

The current illustrative 110° projected knee target is a disclosed demo goal, not a universal definition of a good squat. Assess it at a completed rep bottom; standing and descent do not fail a bottom target. Keep the underlying angle numbers unchanged when smoothing presentation. Never relabel the hard tracking or frontal fixtures as bad posture. Two-video views must retain distinct source names, report identities, evidence times and the selected comparison goal.

## State and recovery matrix

| State | Primary presentation | Action / behavior |
| --- | --- | --- |
| Ready | Source, short disclosure, Start | No capture or model transmission before Start |
| Pairing | Private QR/link, expiry, waiting status | Phone Start camera + permission; laptop advances automatically on stream arrival |
| Permission denied | Specific camera-access message | Explain browser recovery; allow another source without a retry loop |
| Analyzing recording | Determinate shared progress when available | Keep Stop available; no fake instant report |
| Framing | One concrete instruction, such as keep feet in view | Gray/neutral geometry; withhold unsupported target judgment |
| Tracking | Full picture, current local metrics, phase and rep count | Worker runs independently from AI requests |
| Coach pending | “AI coach reviewing rep 2…” | Continue playback/tracking; no blocking full-screen loader |
| Coach ready | Append a short cited rep card; retain earlier cards and per-card Why | Replay highlights stored evidence without duplicating cards or sending requests |
| Coach disconnected/failed | “Local tracking only” plus plain reason | Setup connection/retry only when appropriate; do not fabricate a reply |
| Tracking stale/lost | Clear stale geometry/numbers; gray guidance | Existing live age gate applies; reconnect/new source resets generation |
| Coaching cap reached | Local feedback continues; explain session limit | Do not silently restart or queue calls; current cap is six/session with ≥8 s dispatch spacing |
| Stopped | Stable session results and Start for a new session | Capture/transport/pending requests stop; accepted recorded evidence can remain inspectable |
| No complete reps | Measured samples remain available, clear explanation | Do not invent rep count or send unrelated evidence |

## Accessibility and motion

Give source, speed and goal controls visible labels. Use semantic buttons and preserve keyboard focus after Start/Stop and evidence navigation. Keep existing sample-step keyboard support; also provide visible previous/next buttons. The clickable trace needs an equivalent keyboard-operable seek control; its SVG image alone is not keyboard navigation.

Announce meaningful status changes through a polite live region, not every frame, angle or progress tick. Keep urgent errors in an alert region. Do not auto-focus arriving AI text or interrupt the person's current control. Respect reduced-motion preferences: no pulsing skeleton, repeated celebratory animation, automatic scrolling or flashing state changes. Prefer stable captions and gentle state transitions. Provide clear paused/stopped states and avoid unexpected audible coaching until a separate explicit audio preference exists.

## Frontend completion checklist

- One Start reaches useful local metrics and, when connected, automatic cited AI without visible handoff tasks.
- Video, cue and controls remain readable together at laptop and narrow widths; all source pixels remain visible.
- Rep cues, evidence navigation, trace and skeleton follow the same timeline; playback speed/seek do not trigger more requests.
- Missing or stale evidence cannot retain old green/amber geometry. Local feedback and AI interpretation remain distinctly labeled.
- Phone pairing has a usable private link; QR is added without an external disclosure of that link. Permission, timeout, disconnect and unsupported HTTPS states are designed and tested.
- Full explanation and developer artifacts are available on demand; they do not dominate the first screen.
- Keyboard, touch, focus, reduced motion and contrast are checked on the actual rendered layout. Physical phone tests and final Wren results are recorded separately.

Use the [global tracker](../tracker.md) to mark each completed slice with evidence. This amendment defines the desired finish; writing it is not equivalent to finishing frontend implementation or polish.

## Continuous moving-camera / orbit goal

The requested product ambition includes a camera moving continuously around the squatting person. Full-body visibility is necessary for many features, **not sufficient** for accurate measurements: camera motion, foreshortening, self-occlusion and inferred depth still matter. Arbitrary-angle accuracy is unverified. Preserve this goal in the roadmap rather than quietly restricting the desired final product to a fixed side view.

During orbit, keep the person identity and anatomical left/right stable, estimate view and camera-motion changes continuously, and report quality per metric. Screen-space landmark pinning must follow the current source frame; bounded temporal filtering may reduce jitter only within a measured latency budget. Reset on identity loss, timestamp discontinuity or large unexplained motion. Do not smooth a swapped limb into a plausible-looking but wrong trajectory.

Separate **camera-relative projected measurements** from **experimental body-canonical 3D estimates**. A world-coordinate model output is not automatically a validated body-canonical orientation or camera-motion solution. Detect or explicitly abstain during yaw transitions, invalidate view-dependent baseline/targets, and reacquire each measurement independently. Keep previously accepted cards in the feed; announce “View changing; reacquiring measurements” as current status without pretending old metrics remain valid.

Acceptance requires a real side→oblique→front→oblique orbit capture, including camera roll/translation, limb self-occlusion, bystanders, identity interruption and return to the starting view. Measure identity swaps, left/right swaps, landmark drift/jitter, filter delay, recovery time, per-view metric error and cue precision against independent annotations/reference motion. A full-body-visible frame that fails metric validity must abstain. No fixed-camera or synthetic test alone qualifies this moving-camera claim. See VIEW-4 through VIEW-6 and R-2 in the backlog.

Implementation checkpoint: root retained feed passes fifteen controlled-provider development checks; smoke feed (up to12 cards) and live AI feed (up to6) also have browser passes. Whole-body overlay and integrated experimental view/metric gates are implemented. Combined live browser QA passed adaptive-resolution recovery, historical prior-view AI retention, fresh reps after reacquisition, three-phase evidence and real WebRTC feedback/QR cleanup. These are browser/runtime checks, not independent anatomical accuracy or physical iPhone acceptance. Public real-provider return still needs its rerun.

Layout implementation check: [seven development-layout checks](../qa/live-layout.json) pass. Desktop1400×900 and1280×800 reserve a390px feed beside a stable520px video. At390×844, compact active video remains405.11px high through empty/two-card/expanded-Why states; the first retained card ends at834.20px, inside the first viewport. No horizontal overflow or page errors. [Desktop](../qa/live-layout-desktop.png) and [mobile](../qa/live-layout-mobile.png) screenshots use fixture playback and inserted representative cards, explicitly not live camera/model verification. Physical device, zoom, contrast and wider accessibility acceptance remain separate gates.

## Saved sessions and review

The user confirmed local history/recordings for this demo. Add a History navigation destination and a visible default-on save preference near Start. Retain the current one-action analysis flow; saving is automatic and a failure does not block playback. Show concise saving/saved/error states with retry and a direct Open saved session action. History provides search, meaningful date/source/duration/rep labels, rename, review, downloads and session-specific delete confirmation. Reopening uses stored data with no new inference. Live recordings and analysis clocks are explicitly approximate; show exact saved evidence images separately. See [HISTORY.md](HISTORY.md) for full behavior, data limits and acceptance.
