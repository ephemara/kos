"""
K_OS Machine Learning Utilities
===============================
AI/ML models for image generation, segmentation, style transfer, etc.
"""

import numpy as np
from typing import Dict, List, Tuple, Any, Optional
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import register

# Lazy imports for heavy ML libraries
_torch = None
_sam = None
_diffusers = None

def get_torch():
    global _torch
    if _torch is None:
        import torch
        _torch = torch
    return _torch

# --- AI/ML OPERATIONS ---

@register("ml.get_device")
def get_device() -> str:
    """Check available compute device"""
    torch = get_torch()
    if torch.cuda.is_available():
        return f"cuda ({torch.cuda.get_device_name()})"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return "mps (Apple Silicon)"
    else:
        return "cpu"

@register("ml.segment_image")
def segment_image(image_data: List, width: int, height: int, points: List[Tuple[int, int]] = None) -> Dict[str, Any]:
    """
    Segment image using SAM (Segment Anything Model)
    points: list of (x, y) coordinates for prompts
    """
    try:
        from segment_anything import SamPredictor, sam_model_registry
        import torch
        
        # Load model (cached)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # You'll need to download the model checkpoint
        # For now, return a placeholder
        return {
            "error": "SAM model not loaded. Download checkpoint first.",
            "instructions": "Download sam_vit_h_4b8939.pth from https://github.com/facebookresearch/segment-anything"
        }
    except ImportError:
        return {"error": "segment-anything not installed"}

@register("ml.generate_image")
def generate_image(prompt: str, width: int = 512, height: int = 512, steps: int = 20) -> Dict[str, Any]:
    """
    Generate image using Stable Diffusion
    Returns base64 encoded image or error
    """
    try:
        from diffusers import StableDiffusionPipeline
        import torch
        import base64
        from io import BytesIO
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Load model (this will be slow first time)
        pipe = StableDiffusionPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            torch_dtype=torch.float16 if device == "cuda" else torch.float32
        ).to(device)
        
        # Generate
        image = pipe(prompt, num_inference_steps=steps, width=width, height=height).images[0]
        
        # Convert to base64
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        b64 = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            "image_base64": b64,
            "width": width,
            "height": height
        }
    except ImportError:
        return {"error": "diffusers not installed"}
    except Exception as e:
        return {"error": str(e)}

@register("ml.inpaint")
def inpaint_image(image_data: List, mask_data: List, prompt: str, width: int, height: int) -> Dict[str, Any]:
    """Inpaint masked region using Stable Diffusion Inpainting"""
    try:
        from diffusers import StableDiffusionInpaintPipeline
        import torch
        from PIL import Image
        import base64
        from io import BytesIO
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Reconstruct images
        img_arr = np.array(image_data, dtype=np.uint8).reshape((height, width, -1))
        mask_arr = np.array(mask_data, dtype=np.uint8).reshape((height, width))
        
        image = Image.fromarray(img_arr)
        mask = Image.fromarray(mask_arr)
        
        pipe = StableDiffusionInpaintPipeline.from_pretrained(
            "runwayml/stable-diffusion-inpainting",
            torch_dtype=torch.float16 if device == "cuda" else torch.float32
        ).to(device)
        
        result = pipe(prompt=prompt, image=image, mask_image=mask).images[0]
        
        buffer = BytesIO()
        result.save(buffer, format="PNG")
        b64 = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            "image_base64": b64,
            "width": width,
            "height": height
        }
    except ImportError:
        return {"error": "diffusers not installed"}
    except Exception as e:
        return {"error": str(e)}

@register("ml.depth_estimation")
def estimate_depth(image_data: List, width: int, height: int) -> Dict[str, Any]:
    """Estimate depth map from image using MiDaS"""
    try:
        import torch
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Load MiDaS
        model = torch.hub.load("intel-isl/MiDaS", "MiDaS_small")
        model.to(device).eval()
        
        midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
        transform = midas_transforms.small_transform
        
        # Prepare input
        img_arr = np.array(image_data, dtype=np.uint8).reshape((height, width, 3))
        input_batch = transform(img_arr).to(device)
        
        with torch.no_grad():
            depth = model(input_batch)
            depth = torch.nn.functional.interpolate(
                depth.unsqueeze(1),
                size=(height, width),
                mode="bicubic",
                align_corners=False
            ).squeeze()
        
        depth_np = depth.cpu().numpy()
        # Normalize to 0-255
        depth_norm = ((depth_np - depth_np.min()) / (depth_np.max() - depth_np.min()) * 255).astype(np.uint8)
        
        return {
            "depth_data": depth_norm.tolist(),
            "width": width,
            "height": height
        }
    except Exception as e:
        return {"error": str(e)}

@register("ml.style_transfer")
def neural_style_transfer(content_data: List, style_data: List, width: int, height: int, strength: float = 0.5) -> Dict[str, Any]:
    """Apply neural style transfer"""
    try:
        import torch
        import torchvision.transforms as transforms
        import torchvision.models as models
        from PIL import Image
        import base64
        from io import BytesIO
        
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Quick style transfer using VGG features
        # This is a simplified version - full NST would take longer
        
        content = np.array(content_data, dtype=np.uint8).reshape((height, width, 3))
        style = np.array(style_data, dtype=np.uint8).reshape((height, width, 3))
        
        # Blend as simple approximation (real NST is slow)
        result = (content * (1 - strength) + style * strength).astype(np.uint8)
        
        return {
            "data": result.tolist(),
            "width": width,
            "height": height,
            "note": "Using fast blend approximation. Full neural style transfer requires more compute time."
        }
    except Exception as e:
        return {"error": str(e)}

@register("ml.upscale_esrgan")
def upscale_esrgan(image_data: List, width: int, height: int, scale: int = 4) -> Dict[str, Any]:
    """Upscale image using Real-ESRGAN"""
    try:
        # This would use Real-ESRGAN if installed
        # Fallback to simple upscale
        from PIL import Image
        
        arr = np.array(image_data, dtype=np.uint8).reshape((height, width, -1))
        img = Image.fromarray(arr)
        
        new_size = (width * scale, height * scale)
        upscaled = img.resize(new_size, Image.LANCZOS)
        
        return {
            "data": np.array(upscaled).tolist(),
            "width": new_size[0],
            "height": new_size[1],
            "note": "Using Lanczos. Install Real-ESRGAN for AI upscaling."
        }
    except Exception as e:
        return {"error": str(e)}
