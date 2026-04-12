#!/usr/bin/env python3
"""
ZenMocap Model Converter
========================
Converts .pt and .pth pose estimation checkpoints → .onnx

Usage:
    cd M:/dev3D/ZenMocap/src-tauri/resources/models
    python convert_models.py

Requirements:
    pip install ultralytics torch torchvision
    # For RTMw3D also install:
    pip install mmpose mmengine mmdet mmdeploy

Output directory: same folder as this script (resources/models/)
"""

import os
import sys
import shutil
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent.resolve()
MODELS_DIR = SCRIPT_DIR  # Drop .onnx files right here

# ─── YOLO11 Pose (ultralytics) ────────────────────────────────────────────────

YOLO_MODELS = [
    ("yolo26n-pose.pt", "yolov11n_pose.onnx"),
    ("yolo26s-pose.pt", "yolov11s_pose.onnx"),
    ("yolo26m-pose.pt", "yolov11m_pose.onnx"),
    ("yolo26l-pose.pt", "yolov11l_pose.onnx"),
    ("yolo26x-pose.pt", "yolov11x_pose.onnx"),
]

def convert_yolo():
    try:
        from ultralytics import YOLO
    except ImportError:
        print("ultralytics not installed — skipping YOLO export")
        print("  pip install ultralytics")
        return

    for pt_name, onnx_name in YOLO_MODELS:
        pt_path = MODELS_DIR / pt_name
        onnx_out = MODELS_DIR / onnx_name

        if onnx_out.exists():
            print(f"  [SKIP] {onnx_name} already exists")
            continue

        if not pt_path.exists():
            print(f"  [MISS] {pt_name} not found — skipping")
            continue

        print(f"  [CONV] {pt_name} → {onnx_name}")
        model = YOLO(str(pt_path))
        # Export — opset 12 for broad ONNX Runtime compatibility
        exported = model.export(
            format="onnx",
            imgsz=640,
            opset=12,
            simplify=True,
            dynamic=False,   # static batch=1
            half=False,
        )
        # Ultralytics exports next to the .pt file — move to our output
        exported_path = Path(exported) if exported else pt_path.with_suffix(".onnx")
        if exported_path.exists() and exported_path != onnx_out:
            shutil.move(str(exported_path), str(onnx_out))
        print(f"    → {onnx_out} ({onnx_out.stat().st_size / 1e6:.1f} MB)")

# ─── RTMw3D (MMPose whole-body 3D) ────────────────────────────────────────────
# RTMw3D exports are more involved — uses mmdeploy or direct torch.onnx.export
# Input:  [1, 3, 384, 288]  (BGR or RGB depending on pipeline)
# Output: [1, 133, 3]       (133 whole-body keypoints in 3D camera space)
#
# Keypoints layout (133 total):
#   0-16:   17 body  (COCO format)
#   17-22:  6  foot
#   23-90:  68 face
#   91-111: 21 left hand
#   112-132:21 right hand

RTMW3D_MODELS = [
    (
        "rtmw3d-l_8xb64_cocktail14-384x288-794dbc78_20240626.pth",
        "configs/rtmw3d/rtmw3d-l_8xb64_cocktail14-384x288.py",  # MMPose config
        "rtmw3d_l_384x288.onnx",
        133,
    ),
    (
        "rtmw3d-x_8xb64_cocktail14-384x288-b0a0eab7_20240626.pth",
        "configs/rtmw3d/rtmw3d-x_8xb64_cocktail14-384x288.py",
        "rtmw3d_x_384x288.onnx",
        133,
    ),
]

def convert_rtmw3d():
    """
    Strategy: use torch.onnx.export on the MMPose backbone directly.
    This avoids mmdeploy complexity while still producing a valid ONNX.
    
    The exported model takes raw image tensors (normalized) and outputs
    keypoint heatmaps which we decode in the inference engine.
    """
    try:
        import torch
        import mmpose
    except ImportError:
        print("\nMMPose not installed — for RTMw3D run:")
        print("  pip install -U openmim")
        print("  mim install mmengine 'mmcv>=2.0.0' mmdet mmpose")
        print("  Then re-run this script.")
        return

    from mmengine.config import Config
    from mmpose.apis import init_model

    for pth_name, cfg_path, onnx_name, num_kp in RTMW3D_MODELS:
        pth_path = MODELS_DIR / pth_name
        onnx_out = MODELS_DIR / onnx_name

        if onnx_out.exists():
            print(f"  [SKIP] {onnx_name} already exists")
            continue

        if not pth_path.exists():
            print(f"  [MISS] {pth_name} not found — skipping")
            continue

        # Try to find config — look in installed mmpose package first
        import mmpose as _mm
        mmpose_root = Path(_mm.__file__).parent.parent
        full_cfg = mmpose_root / cfg_path
        if not full_cfg.exists():
            print(f"  [WARN] Config not found at {full_cfg}")
            print(f"         Download from: https://github.com/open-mmlab/mmpose/tree/main/{cfg_path}")
            continue

        print(f"  [CONV] {pth_name} → {onnx_name}")
        device = "cuda" if __import__("torch").cuda.is_available() else "cpu"
        model = init_model(str(full_cfg), str(pth_path), device=device)
        model.eval()

        dummy = __import__("torch").randn(1, 3, 384, 288).to(device)

        __import__("torch").onnx.export(
            model,
            dummy,
            str(onnx_out),
            opset_version=12,
            input_names=["input"],
            output_names=["output"],
            dynamic_axes={"input": {0: "batch"}, "output": {0: "batch"}},
            do_constant_folding=True,
        )
        print(f"    → {onnx_out} ({onnx_out.stat().st_size / 1e6:.1f} MB)")

# ─── rtmdet detector (used as 2-stage: detect persons → crop → RTMPose) ───────
# The rtmdet_m pth is a person detector. Not needed for single-person capture
# (YOLOv11-pose does detection+pose in one shot), but useful for multi-person.

def convert_rtmdet():
    try:
        import torch
        import mmdet
    except ImportError:
        print("\nMMDet not installed — skipping rtmdet export")
        return

    pth = MODELS_DIR / "rtmdet_m_8xb32-100e_coco-obj365-person-235e8209.pth"
    out = MODELS_DIR / "rtmdet_m_person.onnx"

    if out.exists():
        print(f"  [SKIP] rtmdet_m_person.onnx already exists")
        return
    if not pth.exists():
        print(f"  [MISS] rtmdet pth not found — skipping")
        return

    print(f"  [INFO] rtmdet export requires MMDet config — see MMPose docs")
    print(f"         Skipping for now — YOLOv11 handles detection+pose in one shot")

# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("ZenMocap ONNX Converter")
    print(f"Output dir: {MODELS_DIR}")
    print("=" * 60)

    print("\n[1/3] YOLO11 Pose (ultralytics)")
    convert_yolo()

    print("\n[2/3] RTMw3D Whole-body 3D Pose (mmpose)")
    convert_rtmw3d()

    print("\n[3/3] RTMDet Person Detector")
    convert_rtmdet()

    print("\nDone! Place any .onnx files in:")
    print(f"  {MODELS_DIR}")
    print("Then run: npm run tauri dev")
