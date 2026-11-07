# Root recorded-product readiness

Latest run: 2026-11-07, source commit `e953a132ff8bd347acc881ba36452d2d384fd7a3`, no root UI/config changes at build time. [Machine-readable result](product-readiness.json) records the tested build/probe hashes, Chrome version and individual gates.

**20 checks passed.** A fresh TypeScript/Vite build and one Start produced the real Heavy report from the exact clear fixture: 57/57 tracked samples, two reps, bottom timestamps 1067/3000 ms versus independent labels 1067/2933 ms. Timing errors were 0/67 ms against the existing 150 ms tolerance. Knee, duration and torso measurements were usable for both reps.

The browser also verified the two-rep comparison, real trace paths, rep evidence navigation, 0.25× playback, keyboard sample stepping, trace-click seeking, visible overlay at evidence, and clearing the prior overlay when replacement failed. The disconnected state was explicit, developer packet controls stayed hidden initially, no interpretation requests were sent, all assets were same-origin, and no page errors occurred.

The old result for commit `617912a` is preserved unchanged in [the dated archive](archive/product-readiness-2026-11-07-617912a-d12744bb.json). Its historical preview/copy requirement no longer defines readiness for the normal product.

## Run

```sh
node harness/verify/product-readiness.mjs --write
```

The probe builds the root itself with `CI=1` to avoid the prebuild Git pull. It inspects a developer report export only after the normal Start journey succeeds; the export is diagnostic, not a task for the product user. `--developer-packet` optionally checks that the two preview images decode. Copying a packet is never required for this gate. `--write` preserves the previous JSON in a content-addressed, dated archive before updating it.

`readyForFinalQA: true` means this narrow recorded-product gate passed. `readyForWrenDispatch: false` is intentional: this test does not authorize a paid run or declare the full product complete. Actual AI interpretation, two different source videos, physical iPhone/venue behavior and the final two Wren workflows have separate acceptance gates. These timing and UI checks do not measure independent joint-angle accuracy.
