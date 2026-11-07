# Optional OpenCap Monocular import

This module imports separately produced OpenSim kinematics for synchronized local review. It does not run OpenCap inference. The local preflight is **unsupported-runtime** on the development machine (Darwin arm64, no detected NVIDIA runtime). No OpenCap estimates or accuracy results have been generated for the squat fixtures. The MediaPipe path remains available independently.

## Verified upstream interface

Inspected upstream revision `7c5c1dd459835e2482127e55dc45e98d68a1a9f2`, the remote HEAD on November 7, 2026. The standalone runner calls WHAM, optimization and OpenSim IK with GPU enabled. Optimized outputs include an OpenSim `.mot`, a scaled `.osim`, and optional `mono.json` body transforms. Use the optimized IK output under `results/<session>/<clip>/OpenSim/IK/<non-wham-folder>/`; preserve its associated scaled model. This importer reads the text `.mot` format with explicit `nRows`, `nColumns`, and `inDegrees`. Unsupported coordinate names are listed and withheld from the normalized trace.

The upstream code can trim or omit WHAM frame IDs. It warns that gaps can break a one-to-one relationship between kinematic rows and the trimmed movie. Therefore this importer requires an original-video frame index and presentation timestamp for **every** motion row. Never align a trimmed result to the full source merely by adding the first timestamp or multiplying a rounded frame rate. The current upstream optimization also rounds video frame rate; variable-rate and noninteger-rate alignment needs independent checks.

Source references: [standalone runner](https://github.com/utahmobl/opencap-monocular/blob/7c5c1dd459835e2482127e55dc45e98d68a1a9f2/run_mono_standalone.py), [optimization and trim mapping](https://github.com/utahmobl/opencap-monocular/blob/7c5c1dd459835e2482127e55dc45e98d68a1a9f2/optimization.py), [OpenSim motion format writer](https://github.com/utahmobl/opencap-monocular/blob/7c5c1dd459835e2482127e55dc45e98d68a1a9f2/utils/utils_mot.py), [visualizer export](https://github.com/utahmobl/opencap-monocular/blob/7c5c1dd459835e2482127e55dc45e98d68a1a9f2/visualization/utils.py).

## Frontend interface

```ts
import { importOpenCapResult, openCapFrameAt } from './harness/opencap/import.mjs';

const result = await importOpenCapResult({
  motionText: await motionFile.text(),
  manifest: JSON.parse(await manifestFile.text()),
  source: originalVideoFile,
  scaledModel: scaledModelFile,
});
const row = openCapFrameAt(result, video.currentTime * 1000);
```

`import.d.mts` defines the manifest and result. Every import hashes the actual local video bytes, exact motion text and scaled-model bytes. The manifest must name the pinned engine revision and those three hashes, a clip ID and duration, and `alignment.rows` containing `{sourceTimestampMs, sourceFrameIndex, motionTimeSeconds}` for each motion row. Reject a mismatched source rather than attaching it to a newly selected clip. Save these values from the producing run and independently decoded source timeline, retaining any removed-frame mapping. No Python pickle is accepted or executed by this importer.

The result is always `status: 'imported-unverified'` with `provenance.alignment: 'producer-declared'`. Hash agreement binds files; it does not attest which software produced them or prove the declared alignment. `frames[].timestampMs` uses the original-video mapping. `openCapFrameAt` uses that clock, returns null outside the imported interval or across missing source-frame indices, and applies a 100 ms nearest-sample limit. Confirm original frame pixels and row mapping before treating synchronization as verified.

Show a separate OpenCap research trace with the original coordinate names. Rotational values are in degrees (converted only when the header declares radians); `pelvis_tx/ty/tz` remain meters. The coordinate system is the associated OpenSim model's generalized coordinates. A `knee_angle_r` value is not a MediaPipe projected `knee_flexion` value. Preserve model sign conventions. This module produces no 2D skeleton, confidence estimates, clinical assessment, forces, or model-comparison accuracy score. A rendered 3D body additionally requires the matching model/geometry and a separately checked visualizer importer.

For the model selector, offer MediaPipe analysis normally. Until an external runtime has been configured and verified, label OpenCap as “Import OpenCap result” and its native execution status as “External GPU setup required.” The imported trace can accompany the same video. Keep model status, units, limitations, source identity, and missing rows visible. Bind imported data to the active clip generation and clear it on replacement. The CoachPacket v1 provider accepts the MediaPipe measurement contract; do not silently insert these 3D coordinates into it. A versioned OpenCap coaching packet and evidence validation is a separate integration gate.

## Runtime requirements and commands

The official supported installation uses Ubuntu 20.04/22.04, Python 3.9, NVIDIA CUDA, OpenSim 4.4 and additional WHAM/ViTPose/SMPL assets. The repo's code is PolyForm Noncommercial, while required SMPL assets have separate restricted terms. No model assets or upstream source are bundled by MoveIDE. An operator must resolve the intended code and asset use and provision suitable hardware before execution. See [upstream installation](https://github.com/utahmobl/opencap-monocular/blob/7c5c1dd459835e2482127e55dc45e98d68a1a9f2/installation/INSTALL_SLIM.md), [code license](https://github.com/utahmobl/opencap-monocular/blob/7c5c1dd459835e2482127e55dc45e98d68a1a9f2/LICENSE), and [asset terms](https://github.com/utahmobl/opencap-monocular/blob/7c5c1dd459835e2482127e55dc45e98d68a1a9f2/README.md#third-party-licenses).

Run the read-only preflight and parser checks from the MoveIDE repository:

```sh
node harness/opencap/preflight.mjs --repo /absolute/path/to/opencap-monocular
node --test harness/opencap/import.test.mjs
node harness/opencap/verify-browser.mjs
```

On a provisioned compatible machine, pin the upstream source before following its installation guide:

```sh
git clone --recursive https://github.com/utahmobl/opencap-monocular.git
cd opencap-monocular
git checkout 7c5c1dd459835e2482127e55dc45e98d68a1a9f2
git submodule update --init --recursive
```

After installing the pinned dependencies, supplying the individually authorized assets, and verifying camera calibration/intrinsics and subject metadata, the inspected standalone function can be called locally. These are the actual upstream argument names; replace paths with approved local inputs. Use explicit `activity='squat'` to avoid the activity-classifier service. This invocation has **not** been run on the development machine:

```python
from run_mono_standalone import run_mono_standalone
result = run_mono_standalone(
    video_path='/absolute/path/to/approved-squat.mp4',
    metadata_path='/absolute/path/to/subject.yaml',
    calib_path='/absolute/path/to/calib.txt',
    intrinsics_path='/absolute/path/to/cameraIntrinsics.pickle',
    estimate_local_only=True,
    rerun=True,
    session_id='moveide-squat-verification',
    activity='squat',
)
```

Do not substitute upstream defaults for unknown height, mass, subject attributes, calibration or intrinsics. A compatible capture and measured metadata are still required. The upstream standalone runner and its dependencies need a local-only/network audit before processing private footage. Do not launch the hosted API or automatic cloud upload as part of this import path.

## Verification scope and remaining gate

The nine automated tests use explicitly constructed parser fixtures. They cover units, unknown columns, malformed rows, source/model/output hash mismatches, invalid row mappings, rounded-duration boundaries, trimming/gaps, and playback lookup. The Chrome smoke checks browser File hashing, returned coordinate units and times, source mismatch rejection and gap-aware playback with zero external requests. `browser-verification.json` records that constructed-fixture result. These tests establish importer behavior, not OpenCap pose accuracy. `preflight-result.json` records the observed host limitation and pinned source revision.

To promote this path to verified inference, obtain the compatible runtime and authorized assets, a suitable fixed-camera capture with subject/camera metadata, the exact original-frame map, and real `.mot`/`.osim` outputs. Verify source alignment and 3D kinematics against appropriate independent references. Run the imported trace and video together in the integrated frontend, and separately validate any later OpenCap-specific coaching contract.
