import { useHostTheme, useState } from "cursor/canvas";

const project = "https://github.com/quinn-lgtm26/MoveIDE/blob/main";
const tabs = ["Workflow", "Story status", "System", "Verification", "Squat methodology", "Frontend handoff"] as const;

const milestones = [
  {
    "id": "01",
    "title": "One Start, one coached session",
    "owner": "Shared · contracts established",
    "work": "Start coordinates local Heavy tracking, timestamped measurements, exact source JPEGs, coaching principles and asynchronous interpretation. Evidence packets remain internal, with optional developer exports. The session amendment replaces the old manual preview/send workflow.",
    "proof": "One Start passed real ChatGPT on smoke and root. Root made one request with six measurements and source images at 1,067/3,000 ms; both rep cues resolved and seeking made no extra request. This is bounded evidence, not full-video interpretation."
  },
  {
    "id": "02",
    "title": "Build and verify the first real angle",
    "owner": "Motion · verified / Product integration · frontend owner",
    "work": "MediaPipe Heavy v1 is now the user-selected default. A local browser worker records decoded presentation timestamps and computes same-side projected angles. Full remains an explicit tested alternative. Both asset hashes are checked during setup and inference.",
    "proof": "Heavy passed the seven-fixture workflow. The clear sample tracks 57/57 frames with two bottoms at 1,067 and 3,000 ms. Optional onPoseFrame capture preserves 33 normalized xyz and world xyz slots per sample, with nullable confidence. Built smoke verified its local export."
  },
  {
    "id": "03",
    "title": "Review two reps and source evidence",
    "owner": "Shared harness integrated in PR #13",
    "work": "Local phase traces, projected metrics and source evidence support review. Start dispatches bounded coaching automatically; packet/copy controls are developer-only. Timestamped concise cards stack in smoke/live and retain accepted history.",
    "proof": "Production c1c9378 passed20 fresh-build readiness checks,15 controlled-provider lifecycle checks and7 real-provider checks. Retained short cards, Why, Stop/reset and source races pass. Latest9446951 restyle also passes15 production checks and the user-visible real Heavy/GPT demo shows two short retained cards. Two distinct Heavy video sources pass21 local browser checks, including independent clocks/hashes and retrying B without reanalyzing A."
  },
  {
    "id": "04",
    "title": "Verify ChatGPT sign-in and evidence interpretation",
    "owner": "Real root and public phone-path AI verified",
    "work": "Public HTTPS phone delivery, real WebRTC, Heavy and real ChatGPT feedback return passed across two Chrome contexts using a fixture-backed camera. One request carried three phase JPEGs; the10.209-second response appeared as historical coaching after adaptive resize.",
    "proof": "qa/phone-https.json records returned AI, local captions and Stop cleanup. This is browser-based phone-path evidence, not a physical iPhone test or network latency guarantee."
  },
  {
    "id": "05",
    "title": "Integrate and verify the final build",
    "owner": "Integration + final QA · open",
    "work": "Finish final design/accessibility and physical iPhone acceptance. Two-source local comparison is implemented. The experimental continuity guard, per-metric validity and sparse phase evidence are integrated; camera-orbit accuracy is still unverified.",
    "proof": "99 harness and6 launcher tests pass on65fc875. Fresh9446951 setup-only installs locked dependencies and pinned models; TypeScript/Vite build and dist hashes pass. Physical iPhone, independent accuracy and both final Wren workflows remain."
  }
];

const system = [
  {
    "title": "Browser workbench",
    "stack": "React · TypeScript · Vite · Canvas 2D",
    "body": "One Start coordinates analysis and coaching. Root, smoke and live retain concise timestamped cards with expandable reasons. Root passes15 controlled-provider production-preview checks. Preserve the shared controller, source resets and root/live navigation during design work."
  },
  {
    "title": "Local measurement engine",
    "stack": "Browser worker · MediaPipe Tasks Vision 1.2.2 · WASM · Heavy v1",
    "body": "Heavy is the default and Full remains selectable. Setup stages both pinned assets with SHA-256 verification. The 15 Hz sampler records actual decoded timestamps. The standard report carries 33 x/y/visibility slots; optional onPoseFrame capture preserves normalized xyz and estimated world xyz with nullable visibility/presence. Keep coordinate definitions and model provenance attached."
  },
  {
    "title": "Report, evidence and replay",
    "stack": "AnalysisReport v1 · local raw-pose trace · CoachPacket v1 · JPEG",
    "body": "The report and extended profile describe projected squat measurements and phases. Raw model depth is an estimate. The bounded coaching packet includes only selected metrics, context and approved source images. Validated response IDs drive timestamped playback cues without requesting the model again on every frame."
  },
  {
    "title": "Optional provider",
    "stack": "Node loopback · OAuth with PKCE · Responses · validated output",
    "body": "Credentials remain in the loopback service. Disclosed Start authorizes selected source JPEGs and bounded measurements automatically. Playback never triggers new inference; Stop cancels late work. Live requests are capped and evidence-bound. No full-video upload is claimed."
  },
  {
    "title": "Optional OpenCap research import",
    "stack": "Text .mot parser · scaled-model/video hashes · explicit source-row mapping",
    "body": "The importer accepts separately produced OpenSim kinematics and labels them imported-unverified. It preserves source frame indices, coordinate units and model signs. It does not execute OpenCap or turn MediaPipe depth into OpenSim kinematics. Native execution is unavailable on this Darwin arm64 machine without a compatible NVIDIA runtime, approved assets and calibrated capture metadata."
  },
  {
    "title": "Live squat capture",
    "stack": "MediaStream · Heavy worker · bounded history · optional WebRTC",
    "body": "One pose frame in flight and no backlog; exact accepted pixels supply live JPEGs. Phone video enters the same Heavy controller; local/AI feedback returns by data channel. Dedicated HTTPS signaling uses phone long polling, while provider credentials stay local. Physical device and physical venue acceptance remains."
  },
  {
    "title": "Experimental view and 3D diagnostics",
    "stack": "createViewGuard · analyzeMultiViewFrame · explicit reason/epoch/provenance",
    "body": "Integrated live samples expose independent full-body display, analysis eligibility, per-metric reasons and experimental multiview/view epochs. Adaptive resolution reacquires without killing the session. Completed-rep AI retains its original view/time; current baselines reset. No arbitrary-angle accuracy is claimed."
  }
];

const checks = [
  [
    "Geometry and missing data",
    "Latest npm test passed99 harness tests and6 launcher tests, with no failures, cancellations or skips. Geometry, missing data, continuity and runtime behavior are tested without claiming anatomical accuracy."
  ],
  [
    "Current Heavy timing and coverage",
    "Heavy tracked clear-squat at 57/57 frames and supported-squat at 90/90. Each yielded two complete reps. Bottom errors are 0 and 67 ms for both clips, within the unchanged 150 ms tolerance. The difficult original sample has 28/53 usable frames and no trusted reps. The front-view challenge has no usable projected measurements."
  ],
  [
    "Heavy cross-runtime agreement",
    "The Python Tasks check uses the same Heavy v1 weights and independently decoded RGB video. Its two supported-fixture knee values differ from Chrome by 0.09° and 0.78°. Source, report and model hashes are recorded. This is agreement between implementations; independent reference joint angles remain unavailable."
  ],
  [
    "Exploratory capture coverage",
    "Heavy produced 134/135 usable frames in side-gym, 105/135 in side-mirror and 135/135 in side-busy-background. These clips explore tracking behavior and do not supply labeled angle-accuracy evidence. The explicit Full fallback also passed the supported timing labels."
  ],
  [
    "Source timeline and decoder matrix",
    "Independent ffprobe checks account for 57/57 clear and 90/90 supported timestamps. Separate synthetic decoder QA ran through the explicit Full path: 30 Hz and rotated 30 Hz inputs retained 30/60 frames, 7 Hz retained 14/14, and a variable-rate input retained 21/21. Every reported timestamp matched a source frame. Three grayscale pixel comparisons per variant stayed below the 3/255 mean absolute RGB error limit. Rotation, malformed input and cancellation passed. This does not implement exact full-rate decoding."
  ],
  [
    "Local raw-pose export",
    "The onPoseFrame API and built review export retain all 33 normalized xyz and 33 estimated world xyz slots with timestamp/model provenance. Missing probabilities remain null. Export stays local and is excluded from CoachPacket. The world coordinate origin is the model-estimated hip midpoint; these values are not calibrated motion-capture truth."
  ],
  [
    "JPEG and browser acceptance",
    "Current Heavy packets use source JPEGs at 1,067/3,000 ms for clear-squat and 1,600/4,333 ms for supported-squat. Browser verification checks source pixels, source binding, the synchronized overlay, sample stepping and clipboard with no third-party requests. Final production browser QA is still pending."
  ],
  [
    "OpenCap importer verification",
    "Nine constructed-data tests cover units, malformed rows, source/model/motion hashes, trimming/gaps, boundary rounding and playback lookup. A browser synthetic import check also passed. The actual host preflight reports unsupported-runtime. Native inference is deferred per the user. No real OpenCap inference, 3D angle accuracy or MediaPipe/OpenCap accuracy comparison has been performed."
  ],
  [
    "Historical Full provider evidence",
    "The archived Full baseline preserves the old reports and JPEGs. That supported clip supplied the successful local ChatGPT request and earlier hosted harness run. The live response cited six approved measurement IDs and both image IDs. Do not substitute the current Heavy numbers into that historical result."
  ],
  [
    "Current root readiness and retained history",
    "Production c1c9378 passed20 fresh-build readiness gates with Heavy,57/57 samples and0/67ms bottom errors. It also passed15 controlled-provider lifecycle and7 real-provider checks. These are scoped results; subsequent restyles need affected-gate reruns. No angle-accuracy or Wren qualification claim."
  ],
  [
    "Final hosted acceptance",
    "Both historical harness-only Seldon cases passed on 2a6511f in experiment 9c9dabb7-9f02-4925-88e2-56eb9172b505. Harness debit was two, leaving a last-confirmed14. The merged frontend ledger records another run with debit pending; expected remaining13. The two final product cases still require one reachable integrated build, and all remaining simulations are held until it is complete."
  ],
  [
    "Live browser evidence",
    "Heavy real-clip captureStream processed37 frames with72 busy drops, mean76.8ms/max164.6ms local processing latency and one stabilized rep callback with its exact JPEG. Two reps were reconstructed; the final event lacked later samples and was withheld. This is not phone-to-Mac latency. Two Chrome contexts also verified real WebRTC decoded pixels and Stop cleanup."
  ],
  [
    "Stacked cue browser checks",
    "Smoke playback verification passed retained cards, no duplicate replay/seek events, source/model resets and no repeated inference using a controlled provider. Live local-camera verification retained two AI cards on Stop and cleared them on new Start. Current caps: 12 smoke cards and six live AI cards."
  ],
  [
    "Real root AI",
    "qa/root-live-chatgpt.json records real GPT-6.1 Sol, one request, source images 1,067/3,000 ms, valid citations and cues for both reps without extra seek requests."
  ],
  [
    "Experimental multiview compatibility",
    "Actual Heavy output had 57 frames and observed confidence for 1,881 points per coordinate representation. Left knee/hip estimates were available; occluded right joints and front-only proxies on this side view were withheld. This proves schema/abstention compatibility, not angle accuracy."
  ],
  [
    "Public HTTPS real coaching passed",
    "Public phone page, real WebRTC, Heavy and real ChatGPT/local feedback return pass across two Chrome contexts with a fixture-backed camera. One request uses phase JPEGs1205/1605/1937ms; response returns in10.209s as historical view1 coaching after resize. Stop clears tracks/captions. Physical iPhone and venue latency remain."
  ],
  [
    "Latest integrated browser checks",
    "Root15 controlled-provider production-preview checks pass. Combined live QA passes adaptive dimensions, old-view historical AI and subsequent fresh reps, five requests with three exact phase JPEGs, offline zero requests, QR cleanup and real WebRTC feedback. Processing means74/77ms are local processing, not network latency."
  ],
  [
    "Stable live layout",
    "Seven layout checks pass with representative cards and real fixture playback. Desktop1400/1280 uses a stable520px stage and390px feed. Mobile390×844 uses405.11px stage; first card ends834.20px, inside viewport. No overflow or page errors. These are layout checks, not live inference or physical-device results."
  ],
  [
    "Fresh checkout setup",
    "Clean9446951 checkout passes npm run demo -- --setup-only with automatic locked root/harness installs, pinned Full/Heavy hashes and all4 runtime files. CI=1 npm run build passes TypeScript/Vite; dist copies match. No services, demo ports or provider calls started. Phone sender needs no model installation."
  ]
];

const handoff = [
  [
    "Read current contracts first",
    "Read tracker.md, AI-AMENDMENTS.md, docs/frontend-design-amendments.md, docs/frontend-harness-amendments.md and harness/FRONTEND-HANDOFF.md. New one-Start/stacked-feed requirements supersede historical manual preview/send stories."
  ],
  [
    "Preserve the verified core",
    "Root Heavy and real ChatGPT work. Reuse analyzeSquat, source-time overlays, trace/profile helpers, prepareCoachingBundle and chatGPTProvider; keep shared principles/validation. Do not replace tested motion with a private UI geometry engine."
  ],
  [
    "Finish the designed session",
    "Preserve the root retained-feed integration now covered by15 production-preview checks: source timestamps, short action, Why details, Stop history, deduplicated replay and rejected stale results. Complete unified setup, region highlighting and full accessibility without duplicating inference."
  ],
  [
    "Reuse phone and live infrastructure",
    "Use startLiveSquat on the received MediaStream, exact cached completed-rep images, connectReceiver and the local proxy. Phone uses authenticated polling; QR generation stays local. Never expose the credential provider. Public real-provider return passes; physical-device acceptance remains."
  ],
  [
    "Consume experimental contracts honestly",
    "Consume LiveSample poseDisplayFrame, analysisEligible, metricValidity, multiView and experimental viewGuard; LiveRep adds epoch and exact phase JPEGs. Reset current baselines on epochs, retain completed-rep historical AI with original view/time labels. Estimates remain experimental and missing values stay missing."
  ],
  [
    "Implement two sources and temporal evidence",
    "Root comparison currently means two reps of one recording; add separate report/source identities. Live sparse descent/bottom/ascent cache wiring now passes combined browser QA with five controlled-provider three-image requests. Real-provider phase return passes; independent accuracy remains."
  ],
  [
    "Launch and final acceptance",
    "Use npm run demo and docs/quickstart.md. Default startup is private; phone mode exposes dedicated signaling only. Resolve physical-device gates, run the complete final suite, reconcile the expected 13 remaining Wren simulations, and run both stable cases on one final build. Native OpenCap and broad movement expansion remain deferred."
  ]
];

const methodology = [
  [
    "What counts as a quality rep",
    "Complete the intended motion and compare depth and tempo with the lifter’s stated goal or a matched personal baseline. Keep camera setup, stance, footwear and load comparable. Check complete reps and usable evidence before interpreting changes. A universal form score is not supported by these fixtures."
  ],
  [
    "What the numbers can say",
    "Use projected knee, torso, hip and shin angles, phase timing, ankle-closure change and normalized depth proxies. Values describe a camera projection. Small differences may reflect tracking error; independent annotations and repeated captures are needed to establish meaningful change thresholds."
  ],
  [
    "Capture and post-processing",
    "Record the full lifter from a static level side view. Keep near-side joints and feet visible. The 15 Hz sampler retains decoded presentation timestamps and skips duplicate times. The decoder matrix documents high-rate subsampling and variable-rate behavior. Exact sequential source-frame processing remains future work."
  ],
  [
    "Review during the full video",
    "Play the full local video, step analyzed samples, slow playback and seek by phase or evidence cue. Overlay and metrics follow the video clock and leave gaps when evidence is unavailable. ChatGPT explains an explicitly approved packet once; validated cues can appear throughout replay without repeatedly uploading the video."
  ],
  [
    "MediaPipe Heavy default",
    "The user selected Heavy v1 as the default after both pinned variants were benchmarked. The historical paired CPU run found Full faster and closer to supported-fixture timing labels. Heavy passes the same 150 ms acceptance threshold and is now verified across seven clips. Model size does not establish greater measured accuracy; source reference angles are still missing."
  ],
  [
    "OpenCap Monocular scope",
    "Pinned source revision 7c5c1dd has a PolyForm Noncommercial code license plus separate SMPL asset terms. The preprint reports aggregate rotational error for its own validation setup; that result does not establish MoveIDE accuracy. The importer is locally verified on constructed files. A suitable external GPU runtime, authorized assets, camera/subject metadata, original-frame mapping and independent references are required for a real run."
  ]
];

const stories = [
  [
    "BE-1 · Local pose report",
    "Verified · merged in PR #11",
    "Heavy is the user-selected default, with Full retained and tested. Seven fixture inputs produce schema-valid reports and capture guidance. Optional local raw-pose output retains all normalized and estimated world coordinates."
  ],
  [
    "BE-2 · Rep measures and packet",
    "Verified",
    "The current Heavy positive fixtures each yield two reps, six usable report values and two source JPEGs. Extended profiles and phase anchors remain available; old Full evidence is archived."
  ],
  [
    "BE-3 · Eligible ChatGPT connection",
    "Passed",
    "Loopback sign-in and eligible-model discovery passed on the demo laptop. Current changes do not rerun account sign-in."
  ],
  [
    "BE-4 · Evidence-linked interpretation",
    "Real smoke and root verified",
    "Current Heavy plus GPT-6.1 Sol passed bounded source evidence and playback citations. Recorded evidence uses bottoms; public live AI also passed three sampled phase images. Full temporal visual understanding is not established."
  ],
  [
    "FE-1 · Clip import",
    "Merged · on the shared harness",
    "The root workbench opens clear-squat.mp4 with Heavy through the shared harness APIs; the duplicate measuring code is removed."
  ],
  [
    "FE-2 · Synchronized overlay",
    "Merged · on the shared harness",
    "The root product runs Heavy on clear-squat.mp4 with the shared source clock. Final Seldon acceptance remains."
  ],
  [
    "FE-3 · Rep compare and handoff",
    "Two reps and two sources implemented",
    "Shared report/profile and optional developer exports work. Normal coaching is automatic. Compare examples analyzes two sources with independent hashes, reports, selected reps and phase anchors; browser acceptance is in qa/two-recording-comparison.json."
  ],
  [
    "FE-4 · Connected coaching",
    "Real root AI verified",
    "Root one Start made one real GPT-6.1 Sol request with exact evidence; both rep cues visible and no inference on seek. Final redesigned product and Wren remain separate gates."
  ],
  [
    "BE-5 · Source coverage and accuracy",
    "Partially verified",
    "Timestamp accounting, 30 Hz/7 Hz/VFR/rotation decoder checks, raw-data retention and Heavy fixture validation passed. Exact sequential decode, independent angle/annotator errors, repeated captures and memory profiling remain open."
  ],
  [
    "FE-5 · Replay and coaching cues",
    "Root retained feed development-verified",
    "Fifteen controlled-provider checks cover retained short cards, expanded reasoning/citations, delayed ordering, no replay duplicates, Stop/reset and source races. Historical built Trace/rate/step/seek readiness remains recorded separately."
  ],
  [
    "BE-6 · Complete sampled MediaPipe outputs",
    "Verified in the harness",
    "The optional onPoseFrame callback and local export preserve 33-slot normalized xyz and world xyz, nullable confidence, model provenance and decoded timestamps. Unit and real Heavy browser checks pass. Raw data stays outside CoachPacket."
  ],
  [
    "BE-7 · Source-bound OpenCap import",
    "Importer verified · native inference deferred",
    "Nine constructed-data tests and Chrome File/import smoke pass. The typed adapter verifies source/model/motion hashes and explicit frame mapping, preserves units/signs and reports imported-unverified status. Real-capture inference and accuracy are unverified."
  ],
  [
    "FE-6 · Dual-track video review",
    "Amendment published · integration pending",
    "Use one video clock and source identity for MediaPipe and imported OpenCap tracks. Keep units/status distinct, preserve missing rows, reset traces and cues on clip changes, and leave video review usable while coaching runs. Native OpenCap execution remains deferred."
  ],
  [
    "R-1 · OpenCap Monocular benchmark",
    "Native inference deferred",
    "The user selected Heavy plus OpenCap import for current delivery. Resume native inference only with compatible runtime/assets, appropriate capture metadata, original-frame mapping and independent accuracy references. No real OpenCap inference or accuracy benchmark has been completed."
  ],
  [
    "LIVE-1–3 · One-action live tracking",
    "Local camera + stacked feed browser verified",
    "Heavy uses bounded frame scheduling and exact evidence. Two local AI cards persisted through Stop and reset on new Start. Target 110° is illustrative projected depth, not a universal standard."
  ],
  [
    "LIVE-4–6 · Phone and AI coaching",
    "Public browser phone-path real AI verified",
    "HTTPS, real WebRTC, Heavy, three-phase real ChatGPT request, returned historical coaching and cleanup pass. Physical iPhone remains unverified."
  ],
  [
    "LIVE-7–9 · Demo and acceptance",
    "Product amendment published · final QA pending",
    "Compare two attributed reliable clips against a disclosed target; capture failure is not bad posture. Finish one-action demo and rerun two final Wren workflows on the same build."
  ],
  [
    "UX-1–3 · Stable feed, setup and highlights",
    "Retained feed and responsive layout verified",
    "Root15 checks and live/smoke browser checks pass. Seven representative-card layout checks cover desktop and mobile with stable video. Unified setup, region-specific emphasis and broader accessibility remain."
  ],
  [
    "VIEW-1–3 · Gated view diagnostics",
    "Experimental live integration browser-verified",
    "Per-metric validity, full-body display and view epochs are integrated. Adaptive resolution recovers, current baselines clear and historical completed-rep AI survives. Real frontal/oblique annotations, calibration and cue accuracy remain."
  ],
  [
    "VIEW-4–6 · Moving camera and orbit",
    "Required target · unverified",
    "Continuity, identity/left-right stability, bounded filtering, camera-relative versus canonical estimates and baseline reacquisition need integrated tests and independent orbit references. Full visibility alone is insufficient."
  ],
  [
    "TEMP-1 · Phase-aware evidence",
    "Live cache and phase bundle browser-verified",
    "Three pure tests and combined browser QA pass. Public real ChatGPT request now includes three exact phase JPEGs and returns historical coaching. Sparse images are not full-video upload or independent phase-angle validation."
  ],
  [
    "R-2 · Independent accuracy",
    "Reference data missing",
    "Measure error, coverage, latency, repeatability and false cues per view/metric using independent annotations/calibrated truth. Timing and same-model cross-runtime agreement are not angle accuracy."
  ]
];

function Sources({ links }: { links: [string, string][] }) {
  const theme = useHostTheme();
  return <div aria-label="Sources" style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", marginTop: 22, paddingTop: 16, borderTop: `1px solid ${theme.stroke.secondary}`, fontSize: 12 }}>
    {links.map(([label, path]) => <a key={path} href={path} style={{ color: theme.text.link, textUnderlineOffset: 3 }}>{label}</a>)}
  </div>;
}

export default function MoveIDEDevelopmentWorkflow() {
  const theme = useHostTheme();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Workflow");
  const [stage, setStage] = useState("02");
  const milestone = milestones.find(({ id }) => id === stage) ?? milestones[1];
  const body = { color: theme.text.secondary, fontSize: 14, lineHeight: 1.55, margin: "5px 0 0" };
  const heading = { fontSize: 16, fontWeight: 650, margin: 0 };
  const eyebrow = { color: theme.text.secondary, fontSize: 12, fontWeight: 650, margin: 0, letterSpacing: "0.065em", textTransform: "uppercase" as const };
  const line = `1px solid ${theme.stroke.secondary}`;
  const button = { font: "inherit", cursor: "pointer", border: 0, borderRadius: 6 };
  const entries = tab === "Verification" ? checks : tab === "Squat methodology" ? methodology : handoff;

  return <main style={{ background: theme.bg.editor, color: theme.text.primary, maxWidth: 1000, margin: "0 auto", padding: "24px clamp(14px, 4vw, 40px)", fontSize: 14, lineHeight: 1.45 }}>
    <header>
      <p style={eyebrow}>MoveIDE engineering · November 7, 2026</p>
      <h1 style={{ margin: "5px 0 6px", fontSize: 24, lineHeight: 1.25, fontWeight: 650 }}>From squat video to coaching evidence</h1>
      <p style={{ ...body, maxWidth: 680 }}>Recorded root Heavy and real one-Start AI pass. Latest9446951 root passes15 production checks and a visible real Heavy/GPT demo; earlier seven-check provider evidence remains recorded; the latest suite passes 99 harness and 6 launcher tests. Integrated live view/phase recovery and 7 responsive-layout checks pass. Fresh checkout setup/build and public real-provider return pass; physical iPhone and independent orbit accuracy remain. Two-video local comparison is implemented. Native OpenCap stays deferred.</p>
    </header>

    <Sources links={[["Global tracker", `${project}/tracker.md`], ["UI/UX contract", `${project}/docs/frontend-design-amendments.md`], ["AI amendment", `${project}/AI-AMENDMENTS.md`], ["Frontend API handoff", `${project}/docs/frontend-harness-amendments.md`], ["Quickstart", `${project}/docs/quickstart.md`], ["Root real AI evidence", `${project}/qa/root-live-chatgpt.json`], ["Current readiness", `${project}/qa/product-readiness.md`]]} />

    <nav aria-label="Report sections" style={{ display: "flex", flexWrap: "wrap", gap: 5, borderBottom: line, padding: "17px 0 12px" }}>
      {tabs.map(label => <button key={label} type="button" aria-pressed={tab === label} onClick={() => setTab(label)} style={{ ...button, padding: "6px 11px", background: tab === label ? theme.fill.secondary : "transparent", color: tab === label ? theme.text.primary : theme.text.secondary, fontWeight: tab === label ? 650 : 450 }}>{label}</button>)}
    </nav>

    {tab === "Workflow" && <section aria-label="Development workflow" style={{ paddingTop: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 252px), 1fr))", gap: 18 }}>
        <div aria-label="Milestones" style={{ display: "grid", gap: 3, alignContent: "start" }}>
          {milestones.map(item => <button key={item.id} type="button" aria-pressed={stage === item.id} onClick={() => setStage(item.id)} style={{ ...button, background: stage === item.id ? theme.fill.secondary : "transparent", color: theme.text.primary, padding: "8px 9px", textAlign: "left", display: "grid", gridTemplateColumns: "24px 1fr", gap: 5 }}>
            <span aria-hidden="true" style={{ color: stage === item.id ? theme.accent.primary : theme.text.secondary, fontVariantNumeric: "tabular-nums" }}>{item.id}</span><span>{item.title}</span>
          </button>)}
        </div>
        <article style={{ padding: 15, background: theme.fill.tertiary, borderRadius: 8 }}>
          <p style={eyebrow}>{milestone.owner}</p>
          <h2 style={{ ...heading, marginTop: 5 }}>{milestone.title}</h2>
          <p style={body}>{milestone.work}</p>
          <h3 style={{ ...heading, fontSize: 14, marginTop: 15 }}>Evidence for completion</h3>
          <p style={body}>{milestone.proof}</p>
        </article>
      </div>
      <p style={{ ...body, marginTop: 18 }}>BMAD provides the story, acceptance criteria and shared schema. Keep motion, packet and provider changes isolated during implementation. Join on the real report first, then on the rep pair and its evidence. Run local verification before the hosted gate.</p>
      <Sources links={[["BMAD story backlog", `${project}/_bmad-output/specs/epics.md`], ["Harness build record", `${project}/_bmad-output/implementation-artifacts/spec-moveide-harness-build.md`], ["Merged harness PR #2", "https://github.com/quinn-lgtm26/MoveIDE/pull/2"], ["FE-1 and FE-2 PR #3", "https://github.com/quinn-lgtm26/MoveIDE/pull/3"], ["Merged replay handoff PR #5", "https://github.com/quinn-lgtm26/MoveIDE/pull/5"], ["Merged Heavy and OpenCap harness PR #11", "https://github.com/quinn-lgtm26/MoveIDE/pull/11"], ["Product readiness gate PR #12", "https://github.com/quinn-lgtm26/MoveIDE/pull/12"], ["Harness specification", `${project}/_bmad-output/specs/spec-moveide-harness/SPEC.md`], ["Workbench specification", `${project}/_bmad-output/specs/spec-moveide-frontend/SPEC.md`]]} />
    </section>}

    {tab === "System" && <section aria-label="System architecture" style={{ paddingTop: 18 }}>
      {system.map((item, index) => <article key={item.title} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 8, padding: "10px 0 15px", borderBottom: index < system.length - 1 ? line : undefined }}>
        <span aria-hidden="true" style={{ color: theme.accent.primary, fontVariantNumeric: "tabular-nums" }}>0{index + 1}</span>
        <div><h2 style={heading}>{item.title}</h2><p style={{ ...body, fontSize: 12 }}>{item.stack}</p><p style={body}>{item.body}</p></div>
      </article>)}
      <article style={{ padding: 15, borderRadius: 8, background: theme.fill.tertiary }}><h2 style={heading}>Distribution and scope</h2><p style={body}>MoveIDE source uses MIT. MediaPipe Full and Heavy assets retain their upstream Apache 2.0 notices; fixtures are CC BY 4.0. OpenCap source and SMPL assets have separate terms and are not bundled. Verified MoveIDE claims cover sampled projected squat measurements, timing and importer behavior. Clinical validity, forces and calibrated 3D accuracy are unproven.</p></article>
      <Sources links={[["MoveIDE license", `${project}/LICENSE`], ["Fixture credits", `${project}/fixtures/squat/README.md`], ["MediaPipe Web documentation", "https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker?tab=Web"], ["MediaPipe model license clarification", "https://github.com/google-ai-edge/mediapipe/issues/6306"], ["OpenAI plan preview limits", "https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations"]]} />
    </section>}

    {tab === "Story status" && <section aria-label="Story status" style={{ paddingTop: 15 }}>
      {stories.map(([title, status, description], index) => <article key={title} style={{ padding: "11px 0 13px", borderBottom: index < stories.length - 1 ? line : undefined }}><p style={eyebrow}>{status}</p><h2 style={{ ...heading, marginTop: 4 }}>{title}</h2><p style={body}>{description}</p></article>)}
      <Sources links={[["BMAD story backlog", `${project}/_bmad-output/specs/epics.md`], ["Harness PR #2", "https://github.com/quinn-lgtm26/MoveIDE/pull/2"], ["FE-1 and FE-2 PR #3", "https://github.com/quinn-lgtm26/MoveIDE/pull/3"], ["Merged replay handoff PR #5", "https://github.com/quinn-lgtm26/MoveIDE/pull/5"], ["Merged Heavy and OpenCap harness PR #11", "https://github.com/quinn-lgtm26/MoveIDE/pull/11"], ["Product readiness gate PR #12", "https://github.com/quinn-lgtm26/MoveIDE/pull/12"], ["Merged frontend amendments PR #9", "https://github.com/quinn-lgtm26/MoveIDE/pull/9"], ["Merged comparison PR #8", "https://github.com/quinn-lgtm26/MoveIDE/pull/8"], ["Hosted harness ledger", `${project}/qa/seldon-ledger.md`]]} />
    </section>}

    {(tab === "Verification" || tab === "Squat methodology" || tab === "Frontend handoff") && <section aria-label={tab} style={{ paddingTop: 15 }}>
      {tab === "Verification" && <article style={{ padding: 15, borderRadius: 8, background: theme.fill.tertiary }}>
        <p style={eyebrow}>Verified in Chrome · clear-squat.mp4</p>
        <h2 style={{ ...heading, marginTop: 5 }}>The clearer default sample passed both timing checks</h2>
        <p style={body}>The Heavy trace contains 57 timestamped rows and six usable report measurements. Rep 1 measured 117.4° knee flexion, 41.1° torso lean and 1,400 ms duration. Rep 2 measured 117.5°, 40.7° and 1,333 ms. Bottom timing errors were 0 and 67 ms against the 150 ms limit.</p>
        <p style={body}>Selected Heavy start, bottom and end timestamps are 333 / 1,067 / 1,733 ms for rep 1 and 2,267 / 3,000 / 3,600 ms for rep 2.</p>
        <p style={body}>The separate Heavy profile adds 734 / 666 ms descent and ascent for rep 1 and 733 / 600 ms for rep 2. It also exposes projected hip flexion, shin inclination, ankle-closure change and normalized depth proxies. No independent joint-angle accuracy estimate is available.</p>
      </article>}
      {entries.map(([title, description], index) => <article key={title} style={{ padding: "11px 0 13px", borderBottom: index < entries.length - 1 ? line : undefined }}><h2 style={heading}>{title}</h2><p style={body}>{description}</p></article>)}
      <Sources links={tab === "Verification" ? [["Original sample labels", `${project}/fixtures/squat/sample-squat.labels.json`], ["Supported sample labels", `${project}/fixtures/squat/supported-squat.labels.json`], ["Clearer sample labels", `${project}/fixtures/squat/clear-squat.labels.json`], ["Clearer sample report", `${project}/harness/results/clear-squat.analysis-report.v1.json`], ["Clearer sample trace", `${project}/harness/results/clear-squat.motion-trace.v1.json`], ["Clearer sample profile", `${project}/harness/results/clear-squat.squat-profile.v1.json`], ["Historical Full replay screenshot", `${project}/docs/moveide-full-replay.png`], ["Supported regression report", `${project}/harness/results/supported-squat.analysis-report.v1.json`], ["Live ChatGPT verification", `${project}/harness/results/live-chatgpt-verification.json`], ["Full and Heavy browser benchmark", `${project}/harness/results/pose-model-benchmark.json`], ["Root product readiness result", `${project}/qa/product-readiness.json`], ["Product readiness gate PR #12", "https://github.com/quinn-lgtm26/MoveIDE/pull/12"], ["Seven-fixture results", `${project}/harness/results/fixture-verification.json`], ["Decoder matrix", `${project}/harness/results/decoder-matrix.json`], ["Heavy Python agreement", `${project}/harness/results/heavy-python-agreement.json`], ["Archived Full baseline", `${project}/harness/results/full-baseline/README.md`], ["Raw pose API", `${project}/harness/motion/analyze.d.mts`], ["OpenCap import contract", `${project}/harness/opencap/README.md`], ["OpenCap host preflight", `${project}/harness/opencap/preflight-result.json`], ["Python agreement check", `${project}/harness/verify/python-agreement.py`], ["Google MediaPipe Python guide", "https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker?tab=Python"], ["Seldon product baseline", `${project}/seldon.yml`], ["Seldon harness baseline", `${project}/qa/seldon-harness.yml`], ["Simulation ledger", `${project}/qa/seldon-ledger.md`], ["Hosted harness experiment", "https://app.seldon.com/experiments/9c9dabb7-9f02-4925-88e2-56eb9172b505"]] : tab === "Squat methodology" ? [["BMAD measurement and playback methodology", `${project}/_bmad-output/specs/spec-moveide-harness/squat-methodology.md`], ["Squat depth experiment", "https://pmc.ncbi.nlm.nih.gov/articles/PMC4064719/"], ["Squat stance experiment", "https://doi.org/10.1186/s13102-018-0103-7"], ["Google Pose Landmarker", "https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker?tab=Web"], ["Full and Heavy browser benchmark", `${project}/harness/results/pose-model-benchmark.json`], ["Video frame callback", "https://wicg.github.io/video-rvfc/"], ["OpenCap Monocular preprint", "https://arxiv.org/html/2603.24733v1"], ["OpenCap source revision", "https://github.com/utahmobl/opencap-monocular/commit/7c5c1dd459835e2482127e55dc45e98d68a1a9f2"], ["OpenCap Monocular repository license", "https://github.com/utahmobl/opencap-monocular/blob/7c5c1dd459835e2482127e55dc45e98d68a1a9f2/LICENSE"]] : [["Frontend scaffold PR #1", "https://github.com/quinn-lgtm26/MoveIDE/pull/1"], ["Merged harness PR #2", "https://github.com/quinn-lgtm26/MoveIDE/pull/2"], ["FE-1 and FE-2 PR #3", "https://github.com/quinn-lgtm26/MoveIDE/pull/3"], ["Merged replay handoff PR #5", "https://github.com/quinn-lgtm26/MoveIDE/pull/5"], ["Merged Heavy and OpenCap harness PR #11", "https://github.com/quinn-lgtm26/MoveIDE/pull/11"], ["Product readiness gate PR #12", "https://github.com/quinn-lgtm26/MoveIDE/pull/12"], ["Shared contract", `${project}/_bmad-output/specs/shared/analysis-report-v1.md`], ["Motion module", `${project}/harness/motion/analyze.mjs`], ["Coaching module", `${project}/harness/coaching/index.mjs`], ["Clearer sample coaching packet", `${project}/harness/results/clear-squat.coach-packet.v1.json`], ["Synthetic report", `${project}/_bmad-output/specs/shared/analysis-report-v1.example.json`], ["Frontend amendments", "https://github.com/quinn-lgtm26/MoveIDE/blob/main/harness/FRONTEND-HANDOFF.md"], ["Workbench implementation notes", `${project}/_bmad-output/specs/spec-moveide-frontend/workbench.md`]]} />
    </section>}
  </main>;
}
