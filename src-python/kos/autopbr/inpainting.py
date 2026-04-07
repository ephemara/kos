"""
Seamless Tiling with AI Inpainting
===================================
Uses Stable Diffusion inpainting to create seamless textures
"""

import io
import base64
import numpy as np
from PIL import Image
from typing import Optional, Tuple
import cv2

try:
    from diffusers import StableDiffusionInpaintPipeline
    import torch
    HAS_DIFFUSERS = True
except ImportError:
    HAS_DIFFUSERS = False
    print("Warning: diffusers not installed. Inpainting disabled.")


class TilingEngine:
    """AI-powered seamless tiling engine"""
    
    def __init__(self, device: str = "cuda"):
        if not HAS_DIFFUSERS:
            raise RuntimeError("diffusers not installed")
        
        self.device = device if torch.cuda.is_available() else "cpu"
        self.pipe: Optional[StableDiffusionInpaintPipeline] = None
    
    def _load_pipeline(self):
        """Lazy load Stable Diffusion pipeline"""
        if self.pipe is None:
            print("Loading Stable Diffusion inpainting model...")
            self.pipe = StableDiffusionInpaintPipeline.from_pretrained(
                "runwayml/stable-diffusion-inpainting",
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            ).to(self.device)
            
            # Enable memory optimizations
            if self.device == "cuda":
                self.pipe.enable_attention_slicing()
                self.pipe.enable_vae_slicing()
    
    def analyze_edges(self, image: np.ndarray) -> np.ndarray:
        """
        Analyze texture edges for discontinuities
        
        Args:
            image: RGB image as numpy array
        
        Returns:
            Edge mask (0-255)
        """
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        
        # Detect edges using Canny
        edges = cv2.Canny(gray, 50, 150)
        
        # Focus on border regions
        h, w = edges.shape
        border_width = min(h, w) // 10
        
        mask = np.zeros_like(edges)
        
        # Top and bottom borders
        mask[:border_width, :] = edges[:border_width, :]
        mask[-border_width:, :] = edges[-border_width:, :]
        
        # Left and right borders
        mask[:, :border_width] = edges[:, :border_width]
        mask[:, -border_width:] = edges[:, -border_width:]
        
        # Dilate to create inpainting region
        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.dilate(mask, kernel, iterations=2)
        
        return mask
    
    def make_seamless(
        self,
        image_data: bytes,
        strength: float = 0.8,
        max_retries: int = 3
    ) -> bytes:
        """
        Make texture seamless using AI inpainting
        
        Args:
            image_data: Input image as bytes
            strength: Inpainting strength (0.0-1.0)
            max_retries: Maximum retry attempts
        
        Returns:
            Seamless texture as PNG bytes
        """
        self._load_pipeline()
        
        # Load image
        img = Image.open(io.BytesIO(image_data)).convert('RGB')
        img_np = np.array(img)
        
        # Analyze edges
        edge_mask = self.analyze_edges(img_np)
        mask_img = Image.fromarray(edge_mask)
        
        # Inpaint edges
        prompt = "seamless texture, tileable pattern, uniform surface"
        negative_prompt = "seam, edge, border, discontinuity"
        
        for attempt in range(max_retries):
            result = self.pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                image=img,
                mask_image=mask_img,
                strength=strength,
                num_inference_steps=50,
                guidance_scale=7.5,
            ).images[0]
            
            # Validate seamlessness
            if self._validate_seamless(np.array(result)):
                # Success!
                output_buffer = io.BytesIO()
                result.save(output_buffer, format='PNG')
                return output_buffer.getvalue()
            
            print(f"Attempt {attempt + 1} failed validation, retrying...")
            strength *= 0.9  # Reduce strength for next attempt
        
        # Failed after retries, return best attempt
        print(f"Failed to achieve seamless result after {max_retries} attempts")
        output_buffer = io.BytesIO()
        result.save(output_buffer, format='PNG')
        return output_buffer.getvalue()
    
    def _validate_seamless(self, image: np.ndarray, tolerance: float = 0.05) -> bool:
        """
        Validate seamlessness by checking edge pixel similarity
        
        Args:
            image: RGB image as numpy array
            tolerance: Maximum allowed difference (0.0-1.0)
        
        Returns:
            True if seamless within tolerance
        """
        h, w, _ = image.shape
        
        # Compare top-bottom edges
        top_edge = image[0, :, :].astype(np.float32) / 255.0
        bottom_edge = image[-1, :, :].astype(np.float32) / 255.0
        tb_diff = np.mean(np.abs(top_edge - bottom_edge))
        
        # Compare left-right edges
        left_edge = image[:, 0, :].astype(np.float32) / 255.0
        right_edge = image[:, -1, :].astype(np.float32) / 255.0
        lr_diff = np.mean(np.abs(left_edge - right_edge))
        
        # Check if within tolerance
        return tb_diff < tolerance and lr_diff < tolerance
    
    def correct_perspective(self, image_data: bytes) -> bytes:
        """
        Correct perspective distortion in texture
        
        Args:
            image_data: Input image as bytes
        
        Returns:
            Corrected image as PNG bytes
        """
        # Load image
        img = Image.open(io.BytesIO(image_data)).convert('RGB')
        img_np = np.array(img)
        
        # Detect lines using Hough transform
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        lines = cv2.HoughLinesP(edges, 1, np.pi/180, 100, minLineLength=100, maxLineGap=10)
        
        if lines is None or len(lines) < 4:
            # Not enough lines detected, return original
            return image_data
        
        # Find dominant angles
        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = np.arctan2(y2 - y1, x2 - x1) * 180 / np.pi
            angles.append(angle)
        
        # Calculate rotation needed
        median_angle = np.median(angles)
        
        # Rotate image
        h, w = img_np.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
        corrected = cv2.warpAffine(img_np, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
        
        # Save result
        result_img = Image.fromarray(corrected)
        output_buffer = io.BytesIO()
        result_img.save(output_buffer, format='PNG')
        
        return output_buffer.getvalue()
    
    def remove_folds(self, image_data: bytes) -> bytes:
        """
        Remove fold artifacts from fabric textures
        
        Args:
            image_data: Input image as bytes
        
        Returns:
            Fold-free image as PNG bytes
        """
        self._load_pipeline()
        
        # Load image
        img = Image.open(io.BytesIO(image_data)).convert('RGB')
        img_np = np.array(img)
        
        # Detect folds using edge detection
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        edges = cv2.Canny(gray, 30, 100)
        
        # Find fold regions (strong edges)
        kernel = np.ones((5, 5), np.uint8)
        fold_mask = cv2.dilate(edges, kernel, iterations=3)
        
        # Inpaint folds
        mask_img = Image.fromarray(fold_mask)
        
        result = self.pipe(
            prompt="smooth fabric texture, flat surface, no wrinkles",
            negative_prompt="fold, wrinkle, crease, shadow",
            image=img,
            mask_image=mask_img,
            strength=0.7,
            num_inference_steps=50,
            guidance_scale=7.5,
        ).images[0]
        
        output_buffer = io.BytesIO()
        result.save(output_buffer, format='PNG')
        return output_buffer.getvalue()


# Global engine instance
_engine: Optional[TilingEngine] = None

def get_engine() -> TilingEngine:
    """Get global tiling engine instance"""
    global _engine
    if _engine is None:
        _engine = TilingEngine()
    return _engine


# JSON-RPC functions
def make_seamless(image_base64: str, strength: float = 0.8) -> str:
    """Make texture seamless (JSON-RPC endpoint)"""
    image_data = base64.b64decode(image_base64)
    result = get_engine().make_seamless(image_data, strength)
    return base64.b64encode(result).decode('utf-8')


def correct_perspective(image_base64: str) -> str:
    """Correct perspective distortion (JSON-RPC endpoint)"""
    image_data = base64.b64decode(image_base64)
    result = get_engine().correct_perspective(image_data)
    return base64.b64encode(result).decode('utf-8')


def remove_folds(image_base64: str) -> str:
    """Remove fold artifacts (JSON-RPC endpoint)"""
    image_data = base64.b64decode(image_base64)
    result = get_engine().remove_folds(image_data)
    return base64.b64encode(result).decode('utf-8')
