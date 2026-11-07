# /// script
# requires-python = "==3.12.*"
# dependencies = ["mediapipe==1.2.2", "numpy==2.5.4"]
# ///

"""Compare browser knee measurements with the same model in Python Tasks."""

import argparse
import hashlib
import json
import math
import subprocess
from pathlib import Path

import mediapipe as mp
import numpy as np


HARNESS = Path(__file__).resolve().parents[1]
MODELS = {
    "mediapipe-pose-landmarker-full": ("pose_landmarker_full.task", "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1"),
    "mediapipe-pose-landmarker-heavy": ("pose_landmarker_heavy.task", "64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b"),
}
KNEE_INDICES = {"left": (23, 25, 27), "right": (24, 26, 28)}


def knee_flexion(pose, side, width, height):
    hip, knee, ankle = (pose[index] for index in KNEE_INDICES[side])
    if not all(
        point.visibility >= 0.5 and 0 <= point.x <= 1 and 0 <= point.y <= 1
        for point in (hip, knee, ankle)
    ):
        return None

    thigh_x = (hip.x - knee.x) * width
    thigh_y = (hip.y - knee.y) * height
    shin_x = (ankle.x - knee.x) * width
    shin_y = (ankle.y - knee.y) * height
    length_product = math.hypot(thigh_x, thigh_y) * math.hypot(shin_x, shin_y)
    if length_product < 1:
        return None

    cosine = (thigh_x * shin_x + thigh_y * shin_y) / length_product
    return 180 - math.degrees(math.acos(max(-1, min(1, cosine))))


def pose_at_evidence(clip, model, side, evidence_times):
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
        "stream=width,height:frame=best_effort_timestamp_time", "-of", "json", str(clip),
    ]))
    width, height = probe["streams"][0]["width"], probe["streams"][0]["height"]
    presentation_times = [float(frame["best_effort_timestamp_time"]) for frame in probe["frames"]]
    timestamps = [round(1000 * (time - presentation_times[0])) for time in presentation_times]
    if not evidence_times.issubset(timestamps):
        raise ValueError("The report refers to timestamps absent from the decoded clip.")

    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(
            model_asset_path=str(model), delegate=mp.tasks.BaseOptions.Delegate.CPU
        ),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_poses=1,
    )
    decoder_command = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-threads", "1", "-i", str(clip),
        "-map", "0:v:0", "-an", "-sn", "-fps_mode", "passthrough", "-pix_fmt", "rgb24",
        "-f", "rawvideo", "pipe:1",
    ]
    angles = {}
    with (
        mp.tasks.vision.PoseLandmarker.create_from_options(options) as landmarker,
        subprocess.Popen(decoder_command, stdout=subprocess.PIPE) as decoder,
    ):
        frame_size = width * height * 3
        for timestamp in timestamps:
            frame = decoder.stdout.read(frame_size)
            if len(frame) != frame_size:
                raise ValueError(f"FFmpeg returned an incomplete frame at {timestamp} ms.")

            pixels = np.frombuffer(frame, dtype=np.uint8).reshape(height, width, 3)
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=pixels)
            poses = landmarker.detect_for_video(image, timestamp).pose_landmarks
            if timestamp in evidence_times:
                angles[timestamp] = knee_flexion(poses[0], side, width, height) if poses else None

        if decoder.stdout.read(1) or decoder.wait():
            raise ValueError("FFmpeg output did not match the probed video frames.")

    return len(timestamps), angles


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--clip", type=Path, default=HARNESS.parent / "fixtures/squat/supported-squat.mp4")
    parser.add_argument("--report", type=Path, default=HARNESS / "results/supported-squat.analysis-report.v1.json")
    parser.add_argument("--model", type=Path, help="Defaults to the pinned model identified by the report.")
    args = parser.parse_args()
    for required in (args.clip, args.report):
        if not required.is_file():
            parser.error(f"Missing {required}. Run npm run verify:fixtures in harness/ first.")

    report = json.loads(args.report.read_text())
    model_info = report.get("poseModel", {})
    if model_info.get("id") not in MODELS or model_info.get("version") != "1":
        parser.error("The report must identify a pinned MediaPipe Full or Heavy v1 model.")
    model_file, expected_checksum = MODELS[model_info["id"]]
    args.model = args.model or HARNESS / "public/pose" / model_file
    if not args.model.is_file():
        parser.error("Missing model asset. Run npm run setup:pose in harness/ first.")
    checksum = hashlib.sha256(args.model.read_bytes()).hexdigest()
    if checksum != expected_checksum:
        parser.error("Model checksum differs from the model identified by the report.")

    side = report["protocol"]["side"]
    measurements = [
        item for item in report["measurements"]
        if item["metric"] == "knee_flexion" and item["quality"] == "usable"
    ]
    if side not in KNEE_INDICES or not measurements:
        parser.error("The report needs usable knee measurements and a recorded side.")

    evidence_times = {item["evidenceTimestampMs"] for item in measurements}
    try:
        frame_count, python_angles = pose_at_evidence(args.clip, args.model, side, evidence_times)
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        parser.error(str(error))

    comparison = []
    for item in measurements:
        timestamp = item["evidenceTimestampMs"]
        browser_angle = item["value"]
        python_angle = python_angles[timestamp]
        comparison.append({
            "measurementId": item["id"],
            "timestampMs": timestamp,
            "browserDeg": browser_angle,
            "pythonDeg": python_angle,
            "absDeltaDeg": abs(browser_angle - python_angle) if python_angle is not None else None,
        })

    print(json.dumps({
        "clip": args.clip.name,
        "clipSha256": hashlib.sha256(args.clip.read_bytes()).hexdigest(),
        "report": args.report.name,
        "reportSha256": hashlib.sha256(args.report.read_bytes()).hexdigest(),
        "pythonMediaPipeVersion": mp.__version__,
        "modelSha256": checksum,
        "poseModel": model_info,
        "frameCount": frame_count,
        "configuration": "FFmpeg RGB decode · MediaPipe VIDEO · CPU · one pose",
        "side": side,
        "comparison": comparison,
        "scope": "Cross-runtime agreement using shared model weights",
    }, indent=2))


if __name__ == "__main__":
    main()
