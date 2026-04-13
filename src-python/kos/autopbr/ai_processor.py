"""
KAutoPBR AI/ML Module
=====================
AI-powered texture processing: upscaling, denoising, inpainting, material classification

Uses ONNX Runtime for high-performance inference.
Models are downloaded on-demand and cached in apps/tauri/resources/models/
"""

import os
import sys
import io
import json
import base64
import numpy as np
import sys
import json
import base64
import numpy as np
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
import urllib.request
import hashlib

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    import onnxruntime as ort
    from PIL import Image
    import cv2
    HAS_DEPS = True
except ImportError:
    HAS_DEPS = False
    print("Warning: ONNX Runtime, PIL, or OpenCV not installed. AI features disabled.")

# Model URLs and checksums
MODELS = {
    "realesrgan_x2": {
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.onnx",
        "sha256": "placeholder_hash",  # TODO: Add actual hash
        "description": "Real-ESRGAN 2x upscaler"
    },
    "realesrgan_x4": {
        "url": "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x4plus.onnx",
        "sha256": "placeholder_hash",
        "description": "Real-ESRGAN 4x upscaler"
    },
    "nafnet_denoiser": {
        "url": "https://github.com/megvii-research/NAFNet/releases/download/v1.0/NAFNet-SIDD-width64.onnx",
        "sha256": "placeholder_hash",
        "description": "NAFNet denoiser"
    },
    "clip_vit_b32": {
        "url": "https://huggingface.co/openai/clip-vit-base-patch32/resolve/main/model.onnx",
        "sha256": "placeholder_hash",
        "description": "CLIP ViT-B/32 for material classification"
    }
}

class ModelManager:
    """Manages ONNX model downloading and caching"""
    
    def __init__(self, models_dir: Optional[Path] = None):
        if models_dir is None:
            # Default to apps/tauri/resources/models
            self.models_dir = Path(__file__).parent.parent.parent.parent / "apps" / "tauri" / "resources" / "models"
        else:
            self.models_dir = Path(models_dir)
        
        self.models_dir.mkdir(parents=True, exist_ok=True)
    
    def get_model_path(self, model_name: str) -> Path:
        """Get path to model file"""
        return self.models_dir / f"{model_name}.onnx"
    
    def download_model(self, model_name: str, force: bool = False) -> Path:
        """Download model if not cached"""
        if model_name not in MODELS:
            raise ValueError(f"Unknown model: {model_name}")
        
        model_path = self.get_model_path(model_name)
        
        if model_path.exists() and not force:
            print(f"Model {model_name} already cached at {model_path}")
            return model_path
        
        model_info = MODELS[model_name]
        url = model_info["url"]
        
        print(f"Downloading {model_name} from {url}...")
        
        try:
            urllib.request.urlretrieve(url, model_path)
            print(f"Downloaded {model_name} to {model_path}")
            
            # TODO: Verify checksum
            # self._verify_checksum(model_path, model_info["sha256"])
            
            return model_path
        except Exception as e:
            if model_path.exists():
                model_path.unlink()
            raise RuntimeError(f"Failed to download {model_name}: {e}")
    
    def _verify_checksum(self, file_path: Path, expected_sha256: str):
        """Verify file checksum"""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256.update(chunk)
        
        actual = sha256.hexdigest()
        if actual != expected_sha256:
            raise ValueError(f"Checksum mismatch: expected {expected_sha256}, got {actual}")


class AIProcessor:
    """AI-powered texture processing"""
    
    def __init__(self):
        if not HAS_DEPS:
            raise RuntimeError("ONNX Runtime dependencies not installed")
        
        self.model_manager = ModelManager()
        self.sessions: Dict[str, ort.InferenceSession] = {}
        
        # Configure ONNX Runtime for GPU if available
        self.providers = ['CUDAExecutionProvider', 'CPUExecutionProvider']
    
    def _get_session(self, model_name: str) -> ort.InferenceSession:
        """Get or create ONNX session"""
        if model_name not in self.sessions:
            model_path = self.model_manager.get_model_path(model_name)
            
            if not model_path.exists():
                print(f"Model {model_name} not found, downloading...")
                model_path = self.model_manager.download_model(model_name)
            
            self.sessions[model_name] = ort.InferenceSession(
                str(model_path),
                providers=self.providers
            )
        
        return self.sessions[model_name]
    
    def upscale_texture(
        self,
        image_data: bytes,
        scale_factor: int = 2
    ) -> bytes:
        """
        Upscale texture using Real-ESRGAN
        
        Args:
            image_data: Input image as bytes (PNG/JPEG)
            scale_factor: 2, 4, or 8
        
        Returns:
            Upscaled image as PNG bytes
        """
        if scale_factor not in [2, 4, 8]:
            raise ValueError(f"Invalid scale factor: {scale_factor}. Must be 2, 4, or 8")
        
        # Load image
        img = Image.open(io.BytesIO(image_data)).convert('RGB')
        img_np = np.array(img).astype(np.float32) / 255.0
        
        # Prepare input tensor (NCHW format)
        input_tensor = np.transpose(img_np, (2, 0, 1))[np.newaxis, ...]
        
        # Select model based on scale factor
        if scale_factor == 2:
            model_name = "realesrgan_x2"
            current_scale = 2
        elif scale_factor == 4:
            model_name = "realesrgan_x4"
            current_scale = 4
        else:  # 8x
            # Run 4x twice
            model_name = "realesrgan_x4"
            current_scale = 4
        
        # Run inference
        session = self._get_session(model_name)
        input_name = session.get_inputs()[0].name
        output_name = session.get_outputs()[0].name
        
        output = session.run([output_name], {input_name: input_tensor})[0]
        
        # If 8x, run again
        if scale_factor == 8:
            output = session.run([output_name], {input_name: output})[0]
        
        # Convert back to image
        output = np.clip(output[0] * 255.0, 0, 255).astype(np.uint8)
        output = np.transpose(output, (1, 2, 0))
        
        # Save to bytes
        result_img = Image.fromarray(output)
        output_buffer = io.BytesIO()
        result_img.save(output_buffer, format='PNG')
        
        return output_buffer.getvalue()
    
    def denoise_texture(
        self,
        image_data: bytes,
        strength: float = 0.5
    ) -> bytes:
        """
        Denoise texture using NAFNet
        
        Args:
            image_data: Input image as bytes
            strength: Denoising strength (0.0-1.0)
        
        Returns:
            Denoised image as PNG bytes
        """
        # Load image
        img = Image.open(io.BytesIO(image_data)).convert('RGB')
        img_np = np.array(img).astype(np.float32) / 255.0
        
        # Prepare input
        input_tensor = np.transpose(img_np, (2, 0, 1))[np.newaxis, ...]
        
        # Run denoiser
        session = self._get_session("nafnet_denoiser")
        input_name = session.get_inputs()[0].name
        output_name = session.get_outputs()[0].name
        
        output = session.run([output_name], {input_name: input_tensor})[0]
        
        # Blend with original based on strength
        output = output * strength + input_tensor * (1.0 - strength)
        
        # Convert back
        output = np.clip(output[0] * 255.0, 0, 255).astype(np.uint8)
        output = np.transpose(output, (1, 2, 0))
        
        result_img = Image.fromarray(output)
        output_buffer = io.BytesIO()
        result_img.save(output_buffer, format='PNG')
        
        return output_buffer.getvalue()
    
    def identify_material(
        self,
        image_data: bytes
    ) -> Tuple[str, float]:
        """
        Identify material type using CLIP
        
        Args:
            image_data: Input image as bytes
        
        Returns:
            (category, confidence) tuple
        """
        # Material categories
        categories = [
            "metal", "wood", "stone", "fabric", "plastic",
            "leather", "concrete", "brick", "tile", "organic"
        ]
        
        # Load image
        img = Image.open(io.BytesIO(image_data)).convert('RGB')
        img = img.resize((224, 224))
        img_np = np.array(img).astype(np.float32) / 255.0
        
        # Normalize (ImageNet stats)
        mean = np.array([0.485, 0.456, 0.406])
        std = np.array([0.229, 0.224, 0.225])
        img_np = (img_np - mean) / std
        
        # Prepare input
        input_tensor = np.transpose(img_np, (2, 0, 1))[np.newaxis, ...]
        
        # Run CLIP
        session = self._get_session("clip_vit_b32")
        input_name = session.get_inputs()[0].name
        output_name = session.get_outputs()[0].name
        
        logits = session.run([output_name], {input_name: input_tensor})[0]
        
        # Get top prediction
        probs = np.exp(logits) / np.sum(np.exp(logits))
        top_idx = np.argmax(probs)
        
        return categories[top_idx], float(probs[0, top_idx])


# Global processor instance
_processor: Optional[AIProcessor] = None

def get_processor() -> AIProcessor:
    """Get global AI processor instance"""
    global _processor
    if _processor is None:
        _processor = AIProcessor()
    return _processor


# JSON-RPC functions (registered in main.py)
def upscale_texture(image_base64: str, scale_factor: int) -> str:
    """Upscale texture (JSON-RPC endpoint)"""
    image_data = base64.b64decode(image_base64)
    result = get_processor().upscale_texture(image_data, scale_factor)
    return base64.b64encode(result).decode('utf-8')


def denoise_texture(image_base64: str, strength: float) -> str:
    """Denoise texture (JSON-RPC endpoint)"""
    image_data = base64.b64decode(image_base64)
    result = get_processor().denoise_texture(image_data, strength)
    return base64.b64encode(result).decode('utf-8')


def identify_material(image_base64: str) -> Dict[str, Any]:
    """Identify material type (JSON-RPC endpoint)"""
    image_data = base64.b64decode(image_base64)
    category, confidence = get_processor().identify_material(image_data)
    return {
        "category": category,
        "confidence": confidence
    }


if __name__ == "__main__":
    # Test model downloading
    manager = ModelManager()
    print("Available models:")
    for name, info in MODELS.items():
        print(f"  {name}: {info['description']}")
