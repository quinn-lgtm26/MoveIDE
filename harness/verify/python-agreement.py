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
MODEL_SHA256 = "5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1"
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
    parser.add_argument("--model", type=Path, default=HARNESS / "public/pose/pose_landmarker_full.task")
    args = parser.parse_args()
    for required in (args.clip, args.report, args.model):
        if not required.is_file():
            parser.error(f"Missing {required}. Run npm run verify:fixtures in harness/ first.")

    checksum = hashlib.sha256(args.model.read_bytes()).hexdigest()
    if checksum != MODEL_SHA256:
        parser.error("Model checksum differs from the pinned Pose Landmarker Full v1 asset.")

    report = json.loads(args.report.read_text())
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
        "report": args.report.name,
        "pythonMediaPipeVersion": mp.__version__,
        "modelSha256": checksum,
        "frameCount": frame_count,
        "configuration": "FFmpeg RGB decode · MediaPipe VIDEO · CPU · one pose",
        "side": side,
        "comparison": comparison,
        "scope": "Cross-runtime agreement using shared model weights",
    }, indent=2))


if __name__ == "__main__":
    main()
