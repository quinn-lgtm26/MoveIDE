# MoveIDE — measure your squat, understand your next rep

[Get the app](../README.md#get-started) · [Try the demo](JUDGES-START-HERE.md) · [Presentation](#presentation) · [Evidence and limits](FINAL-HANDOFF.md)

## The pitch

Coaches and athletes already film their lifts. Turning that footage into measurements can mean another subscription and a cloud upload. Markerless AI’s Basic plan, for example, costs $29 a month.

**MoveIDE makes the measurement layer free and open source.** It runs locally on your laptop using Google’s MediaPipe Heavy model, which estimates 33 body landmarks. Starting with side-view squats, MoveIDE measures knee, hip and torso angles, rep timing and consistency.

Connect your own ChatGPT account for coaching on completed reps, with observations linked to source images and measurements you can inspect. Full recordings stay local; optional AI receives selected images and measured values.

**Measurement should be free. Knowing what to do about it is the product.**

The pricing example is from [Markerless AI’s pricing page](https://markerless.ai/pricing), checked November 7, 2026 Pacific. It also offers pay-as-you-go packs, so a subscription is not its only purchase option. Its [privacy policy](https://markerless.ai/privacy) describes uploading video to its pose-processing infrastructure. This is a comparison of the target workflow, not a claim that MoveIDE replaces every competitor feature.

## What the product actually does

**Record or open a squat.** Use a laptop camera, send iPhone video through a private QR/WebRTC connection, or review a supported recording. The laptop does the pose tracking. A steady side view with the whole body visible is the supported setup.

**See your movement.** The video overlay shows the tracked body. Graphs show knee bend, hip bend and chest lean over time. Rep controls let you inspect lowering, the bottom and standing back up. Compare reps at matching stages, even when their pace differs.

**Understand the feedback.** Optional ChatGPT reviews receive selected source images and measurements. The interface keeps short coaching notes beside the video, with an explanation and evidence you can open. A camera-framing tip means the view limited what could be assessed; it does not necessarily mean the analysis service failed.

**Keep the full session.** Stop to save locally, replay the video and notes, or export a portable session to another computer. The included demo contains seven detected reps and six saved reviews and can be replayed without an account.

## Product introduction after the problem slide

**Title:** Meet MoveIDE.

**Subtitle:** Free squat measurement. Coaching you can inspect.

- **See it:** track the movement on your own laptop.
- **Understand it:** compare reps and get a short coaching suggestion.
- **Check it:** open the source images and measurements behind the note.

**Speaker note:** “We start with the video you already have. MoveIDE measures the squat locally, then lets you bring your own ChatGPT account to help explain it. The video, the graph and the coaching stay together, so you can see what happened and what to try on the next rep.”

Use the [homepage screenshot](images/homepage.png) to introduce the product, then switch to the actual saved demo. Keep the problem slide before this introduction and the live product walkthrough after it.

## A simple demo story

| Show | Say |
| --- | --- |
| Home page | “Start with a recording or a camera. Local measurement needs no AI account.” |
| History → Open demo session | “This is a real saved run: seven detected reps and six saved coaching reviews.” |
| Play, pause and inspect the overlay | “The replay lets us look at the tracked movement and estimated angles.” |
| Rep 5 → Why | “Here is a suggestion about lowering the hips and bending the knees together, with the source images behind it.” |
| Movement graph and example comparison | “Compare how the movement changes through a rep, not just one number at the bottom.” |
| Export session | “Take the video, measurements and notes to another computer as one package.” |

Describe this as **saved coaching replay**. For a new AI review, connect your own eligible account and start a new session; a replay itself does not make another AI request.

## Details to keep consistent in the talk

| Topic | Accurate wording |
| --- | --- |
| Free | MoveIDE’s local measurement software is free and open source. Optional ChatGPT usage requires an eligible account and follows its limits. |
| Local | Pose measurement runs on the laptop. Optional AI sends selected images and measurements to ChatGPT; the full video is not sent to ChatGPT. |
| Every rep | Rep tracking and AI review are different. This version accepts at most six AI reviews per live session; more detected reps can remain in History without a note. |
| Timing | Recorded source evidence has timestamps. Original live coaching links to approximate recording times; prepared pose replay uses the encoded video timeline. |
| Video understanding | The AI reviews bounded image sequences and measurements, up to 32 source JPEGs per reviewed live rep. It does not watch every frame continuously. |
| Accuracy | Angles are estimates. Selected fixture rep counts and bottom timing are checked; anatomical-angle accuracy and arbitrary moving-camera views are not independently certified. |
| Scope | Squat analysis is the demo. Other movements and native OpenCap inference are future work. |
| QA | Present the linked test evidence and open findings. Do not label the latest hosted run a full pass. |

## Presentation

**PowerPoint / slide deck:** link to be added when supplied.

<!-- PRESENTATION_URL: replace the line above with a Markdown link labeled Open the presentation using the user-provided URL. Do not invent a URL or publish a placeholder destination. -->

The small **Presentation** link in the README points here until the final deck URL is supplied. This page contains the pitch and speaker notes; it is not the PowerPoint file.

[Back to the README](../README.md) · [Full judge walkthrough](JUDGES-START-HERE.md) · [Current delivery and known issues](FINAL-HANDOFF.md)
