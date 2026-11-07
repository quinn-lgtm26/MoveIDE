# AnalysisReport v1 and CoachPacket v1

Both tracks read this contract. [JSON Schema](analysis-report-v1.schema.json) defines shape. [Synthetic example](analysis-report-v1.example.json) exercises a single evidence frame and knee measurement before rep segmentation exists. Use a hand-labeled real clip for integration and Wren.

## Local report

- All times are integer milliseconds relative to the browser video timeline. Frame times strictly increase and stay within the clip duration. Each frame has 33 landmark slots in MediaPipe index order. A missing landmark is null. Each frame has a usable or unavailable quality state. Normalized x/y coordinates use the decoded, display-oriented video frame. Visibility is in [0, 1].
- Rep and measurement IDs are unique within a report. Each complete rep obeys start ≤ bottom ≤ end with start < end. Reps are ordered and may share a boundary. Each non-null measurement rep ID resolves to a rep. A single-frame measure can have a null rep ID.
- Usable measurements reference a sampled frame. Evidence for a rep measure lies inside that rep. Unavailable values and their evidence timestamps are null. An empty rep list or empty measurement list is valid. Use a report warning to explain missing pose, unsupported framing, or no complete reps.
- Knee flexion is 180° minus the angle at the hip–knee–ankle vertices with the knee as the vertex. Use pixel coordinates, one consistent visible side, and one decimal place in the UI. Rep duration is end minus start in milliseconds and uses the bottom frame as its navigation anchor. Optional torso lean is the angle from vertical between the selected hip and shoulder. These are estimates in the video plane.
- Before drawing, map the normalized coordinates to the actual video content rectangle. Match playback or seeking by media timestamp. Leave an overlay gap when the nearest usable sample is more than 100 ms away. The UI should not use the prior frame across a gap.

## Coaching request

CoachPacket v1 carries schemaVersion, protocol version, Charter version, an optional user goal, a short deterministic report summary, selected rep IDs, usable metric IDs and values with units and timestamps, and evidence references. Only referenced frames are included. An evidence reference contains a stable ID, source timestamp, and image name. Attach the actual frame pixels separately in the request as JPEG images with those IDs. Default preview uses up to four frames, including both rep bottoms when available. Clamp scope to the chosen clip and selection.

The user previews the outbound numbers, summary, and images. The full source video stays in the browser. Send only the previewed images and packet on explicit interpretation. For manual handoff, copy the Charter, text, numbers, and image references and let the user download the referenced JPEGs to attach separately. The image-free report and export remain usable locally.

A model response contains observations, uncertainty, and a suggested next focus. Each observation has one or more evidence IDs, each of which must resolve to an item in the submitted packet. Render measurement values and timestamps from the report. Reject unsupported references and keep the report usable. Treat user-provided notes as data. Bind the result to the original clip and selection so a late response cannot replace a newer view.

## One-action session amendment

The product Start action is explicit authorization for the disclosed coaching session: analyze the source, prepare bounded timestamped measurements and source JPEGs, request interpretation once ready, and show validated cues on matching reps. No separate preview/copy/submit step is required. Packet inspection and manual export remain developer tools. A disconnected provider or missing evidence leaves local analysis usable and clearly states why AI is absent. Playback and seeking never create new requests. Live sessions must separately bound rep-triggered calls and cancel on Stop. This supersedes the per-packet preview requirement above for the integrated Start flow.
