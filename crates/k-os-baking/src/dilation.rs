//! Texture dilation for seam prevention
//!
//! Dilation fills empty pixels in baked textures by expanding valid pixels
//! outward. This prevents seams and artifacts at UV boundaries.

use image::{Rgba, RgbaImage};
use rayon::prelude::*;

/// Dilate a texture to fill empty pixels
pub fn dilate(image: &RgbaImage, iterations: u32) -> RgbaImage {
    let mut result = image.clone();

    for _ in 0..iterations {
        result = dilate_once(&result);
    }

    result
}

/// Perform one iteration of dilation
fn dilate_once(image: &RgbaImage) -> RgbaImage {
    let (width, height) = image.dimensions();
    let mut result = image.clone();

    let pixels: Vec<_> = (0..height)
        .into_par_iter()
        .flat_map(|y| {
            (0..width).into_par_iter().filter_map(move |x| {
                let pixel = image.get_pixel(x, y);

                // If pixel is empty (alpha = 0), try to fill it
                if pixel[3] == 0 {
                    if let Some(filled) = fill_pixel(image, x, y) {
                        return Some((x, y, filled));
                    }
                }

                None
            })
        })
        .collect();

    for (x, y, color) in pixels {
        result.put_pixel(x, y, color);
    }

    result
}

/// Fill an empty pixel by averaging neighboring valid pixels
fn fill_pixel(image: &RgbaImage, x: u32, y: u32) -> Option<Rgba<u8>> {
    let (width, height) = image.dimensions();
    let mut sum_r = 0u32;
    let mut sum_g = 0u32;
    let mut sum_b = 0u32;
    let mut count = 0u32;

    // Check 8-connected neighbors
    for dy in -1..=1 {
        for dx in -1..=1 {
            if dx == 0 && dy == 0 {
                continue;
            }

            let nx = x as i32 + dx;
            let ny = y as i32 + dy;

            if nx >= 0 && nx < width as i32 && ny >= 0 && ny < height as i32 {
                let neighbor = image.get_pixel(nx as u32, ny as u32);

                // Only use valid pixels (alpha > 0)
                if neighbor[3] > 0 {
                    sum_r += neighbor[0] as u32;
                    sum_g += neighbor[1] as u32;
                    sum_b += neighbor[2] as u32;
                    count += 1;
                }
            }
        }
    }

    if count > 0 {
        Some(Rgba([
            (sum_r / count) as u8,
            (sum_g / count) as u8,
            (sum_b / count) as u8,
            255,
        ]))
    } else {
        None
    }
}

/// Dilate with distance-based weighting (better quality)
pub fn dilate_weighted(image: &RgbaImage, iterations: u32, kernel_size: u32) -> RgbaImage {
    let mut result = image.clone();

    for _ in 0..iterations {
        result = dilate_weighted_once(&result, kernel_size);
    }

    result
}

fn dilate_weighted_once(image: &RgbaImage, kernel_size: u32) -> RgbaImage {
    let (width, height) = image.dimensions();
    let mut result = image.clone();
    let radius = kernel_size as i32 / 2;

    let pixels: Vec<_> = (0..height)
        .into_par_iter()
        .flat_map(|y| {
            (0..width).into_par_iter().filter_map(move |x| {
                let pixel = image.get_pixel(x, y);

                if pixel[3] == 0 {
                    if let Some(filled) = fill_pixel_weighted(image, x, y, radius) {
                        return Some((x, y, filled));
                    }
                }

                None
            })
        })
        .collect();

    for (x, y, color) in pixels {
        result.put_pixel(x, y, color);
    }

    result
}

fn fill_pixel_weighted(image: &RgbaImage, x: u32, y: u32, radius: i32) -> Option<Rgba<u8>> {
    let (width, height) = image.dimensions();
    let mut sum_r = 0.0f32;
    let mut sum_g = 0.0f32;
    let mut sum_b = 0.0f32;
    let mut weight_sum = 0.0f32;

    for dy in -radius..=radius {
        for dx in -radius..=radius {
            let nx = x as i32 + dx;
            let ny = y as i32 + dy;

            if nx >= 0 && nx < width as i32 && ny >= 0 && ny < height as i32 {
                let neighbor = image.get_pixel(nx as u32, ny as u32);

                if neighbor[3] > 0 {
                    let dist = ((dx * dx + dy * dy) as f32).sqrt();
                    let weight = 1.0 / (1.0 + dist);

                    sum_r += neighbor[0] as f32 * weight;
                    sum_g += neighbor[1] as f32 * weight;
                    sum_b += neighbor[2] as f32 * weight;
                    weight_sum += weight;
                }
            }
        }
    }

    if weight_sum > 0.0 {
        Some(Rgba([
            (sum_r / weight_sum) as u8,
            (sum_g / weight_sum) as u8,
            (sum_b / weight_sum) as u8,
            255,
        ]))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dilate_simple() {
        let mut image = RgbaImage::new(3, 3);

        // Set center pixel
        image.put_pixel(1, 1, Rgba([255, 0, 0, 255]));

        // Dilate once
        let dilated = dilate(&image, 1);

        // Check that neighbors are filled
        assert!(dilated.get_pixel(0, 1)[3] > 0);
        assert!(dilated.get_pixel(2, 1)[3] > 0);
        assert!(dilated.get_pixel(1, 0)[3] > 0);
        assert!(dilated.get_pixel(1, 2)[3] > 0);
    }

    #[test]
    fn test_dilate_preserves_valid() {
        let mut image = RgbaImage::new(3, 3);
        image.put_pixel(1, 1, Rgba([255, 0, 0, 255]));

        let dilated = dilate(&image, 1);

        // Original pixel should be unchanged
        assert_eq!(dilated.get_pixel(1, 1), &Rgba([255, 0, 0, 255]));
    }

    #[test]
    fn test_dilate_weighted() {
        let mut image = RgbaImage::new(5, 5);
        image.put_pixel(2, 2, Rgba([255, 0, 0, 255]));

        let dilated = dilate_weighted(&image, 1, 3);

        // Check that some neighbors are filled
        assert!(dilated.get_pixel(1, 2)[3] > 0);
        assert!(dilated.get_pixel(3, 2)[3] > 0);
    }
}
