# Heavy, full pose export, and OpenCap import

Status: verified locally, ready to publish.

The user selected Heavy as default, asked for parallel frontend amendments, and confirmed local Heavy plus OpenCap import as the current delivery because no compatible OpenCap GPU runtime/assets are available. Native OpenCap inference is deferred. The independent frontend owner keeps the production workbench.

Delivered:

- Hash-pinned Heavy default with explicit Full fallback, 41 unit tests, seven real fixture cases, and rebuilt browser smoke. Both positive clips retain two reps within the original 150 ms label tolerance. Heavy clear bottoms are 1067/3000 ms (0/67 ms error); supported bottoms are 1600/4333 ms (0/67 ms error). Hard and front-view clips preserve unavailable results.
- Local raw pose callback/export retains 33 normalized and 33 world landmark slots, estimated z, nullable confidence, decoded timestamps and model provenance. Browser export matches report timestamps. The bounded provider packet excludes the raw trace. Independent review found no actionable issues.
- Decoder matrix independently checks source PTS and selected frame pixels for 30 Hz, 7 Hz, variable-rate and 90-degree rotated synthetic inputs. It also checks malformed input and cancellation. This verifies sampled compatibility, not exact-rate decoding or pose accuracy.
- Optional OpenCap importer validates the actual source/model/motion bytes, original-frame mapping and units. Nine tests plus a Chrome import smoke pass. Imported values remain unverified and distinct from MediaPipe. Review found and fixed the rounded-duration boundary in both the source audit and importer. Real inference and 3D accuracy were not tested.
- The local review has a restrained visual refresh, real video overlay, stepping, per-rep metrics, evidence preview, and raw export. Chrome desktop/mobile checks show no horizontal overflow. The existing ChatGPT connection remains available on loopback; no new paid model or Seldon request was made.
- PR #9 already published frontend pickup guidance. The final amendment includes exact OpenCap and raw-pose APIs. Frontend PRs #4/#7/#8 are now merged; the production shared-harness pickup remains to be verified.

Verification commands:

```sh
npm --prefix harness test
npm --prefix harness run verify:fixtures
npm --prefix harness run build
npm --prefix harness run verify:build
npm --prefix harness run verify:source-timeline
npm --prefix harness run verify:decoder-matrix
node harness/opencap/verify-browser.mjs
```

Python/Chrome Heavy knee agreement was 0.09 and 0.78 degrees on the supported regression. This checks two runtimes sharing model weights and is not independent angle ground truth. Independent angle annotations, repeated-capture validation, exact source-frame mode and memory profiling remain open BE-5 work. Preserve historical Full results for the earlier live ChatGPT and Seldon runs. Hold the remaining 14 simulations until final product integration.
