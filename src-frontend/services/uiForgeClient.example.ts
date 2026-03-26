/**
 * uiForgeClient.example.ts
 * 
 * Example usage patterns for the UI Forge TypeScript client.
 * These examples demonstrate common workflows for generating UI assets.
 */

import { uiForgeClient, GeneratorType, OutputFormat, BlendMode, GradientType, MotionType, AnimationOutputType } from './uiForgeClient';

// ============================================================================
// Example 1: Generate a Simple Icon
// ============================================================================

export async function generateSimpleIcon() {
    const result = await uiForgeClient.generateAsset({
        name: "Sculpt Clay Icon",
        description: "Clay sculpting tool icon",
        generator_type: GeneratorType.ICON,
        category: "toolbar",
        tags: ["sculpt", "tool"],
        dimensions: { width: 64, height: 64 },
        output_formats: [OutputFormat.PNG, OutputFormat.SVG],
        params: {
            layers: [
                {
                    type: "circle",
                    geometry: { cx: 32, cy: 32, r: 24 },
                    fill: {
                        type: GradientType.SOLID,
                        colors: ["#2563eb"]
                    }
                }
            ],
            padding: 8,
            antialias_factor: 2
        }
    });

    console.log(`Generated icon: ${result.asset_id}`);
    console.log(`Output paths:`, result.output_paths);
    return result;
}

// ============================================================================
// Example 2: Generate Icon with Gradient and Multiple Layers
// ============================================================================

export async function generateGradientIcon() {
    const result = await uiForgeClient.generateAsset({
        name: "Gradient Tool Icon",
        description: "Multi-layer icon with gradient",
        generator_type: GeneratorType.ICON,
        category: "toolbar",
        dimensions: { width: 128, height: 128 },
        output_formats: [OutputFormat.PNG, OutputFormat.SVG],
        params: {
            layers: [
                // Background circle
                {
                    type: "circle",
                    geometry: { cx: 64, cy: 64, r: 48 },
                    fill: {
                        type: GradientType.RADIAL,
                        colors: ["#3b82f6", "#1e40af"],
                        center: [0.5, 0.5]
                    }
                },
                // Foreground shape
                {
                    type: "rect",
                    geometry: { x: 32, y: 32, width: 64, height: 64 },
                    fill: {
                        type: GradientType.LINEAR,
                        colors: ["#fbbf24", "#f59e0b"],
                        angle: 45
                    },
                    blend_mode: BlendMode.OVERLAY,
                    opacity: 0.8
                }
            ],
            padding: 12,
            antialias_factor: 4
        }
    });

    return result;
}

// ============================================================================
// Example 3: Generate Brush Preview
// ============================================================================

export async function generateBrushPreview() {
    const result = await uiForgeClient.generateAsset({
        name: "Soft Round Brush",
        description: "Soft round brush preview",
        generator_type: GeneratorType.BRUSH,
        category: "sculpt",
        dimensions: { width: 256, height: 256 },
        output_formats: [OutputFormat.PNG],
        params: {
            shape: "circular",
            size: 200,
            hardness: 0.3,
            spacing: 0.25,
            falloff_curve: "smooth",
            stroke_preview: true,
            generate_thumbnail: true,
            generate_detail: true
        }
    });

    return result;
}

// ============================================================================
// Example 4: Batch Generate Multiple Icons
// ============================================================================

export async function batchGenerateIcons() {
    const templatePaths = [
        'templates/icons/sculpt-clay.yaml',
        'templates/icons/sculpt-smooth.yaml',
        'templates/icons/sculpt-grab.yaml',
        'templates/icons/sculpt-flatten.yaml',
    ];

    const batch = await uiForgeClient.batchGenerate(templatePaths, true);
    
    console.log(`Batch ${batch.batch_id} started`);
    console.log(`Total: ${batch.total}, Successful: ${batch.successful}, Failed: ${batch.failed}`);

    return batch;
}

// ============================================================================
// Example 5: Monitor Batch Progress
// ============================================================================

export async function monitorBatchProgress(batchId: string) {
    const checkProgress = async () => {
        const progress = await uiForgeClient.getProgress(batchId);
        
        console.log(`Progress: ${progress.percent_complete.toFixed(1)}%`);
        console.log(`Completed: ${progress.completed}/${progress.total}`);
        console.log(`Failed: ${progress.failed}`);
        
        if (progress.current_asset) {
            console.log(`Current: ${progress.current_asset}`);
        }

        if (progress.estimated_time_remaining) {
            console.log(`ETA: ${progress.estimated_time_remaining.toFixed(1)}s`);
        }

        return progress;
    };

    // Poll every 500ms until complete
    const interval = setInterval(async () => {
        const progress = await checkProgress();
        if (progress.completed === progress.total) {
            clearInterval(interval);
            console.log('Batch generation complete!');
        }
    }, 500);
}

// ============================================================================
// Example 6: Search Library Assets
// ============================================================================

export async function searchSculptIcons() {
    const results = await uiForgeClient.searchLibrary({
        query: 'sculpt',
        category: 'icons',
        tags: ['toolbar'],
        minResolution: 64,
    });

    console.log(`Found ${results.length} sculpt icons`);
    results.forEach(asset => {
        console.log(`- ${asset.name} (${asset.dimensions[0]}x${asset.dimensions[1]})`);
    });

    return results;
}

// ============================================================================
// Example 7: Get Library Statistics
// ============================================================================

export async function getLibraryStats() {
    const stats = await uiForgeClient.getStatistics();
    
    console.log(`Total generators: ${stats.generators}`);
    console.log('Engine stats:', stats.engine);
    console.log('Library stats:', stats.library);

    const index = await uiForgeClient.getLibraryIndex();
    console.log(`Total assets in library: ${index.total_assets}`);
    console.log('Categories:', Object.keys(index.categories));

    return { stats, index };
}

// ============================================================================
// Example 8: Generate Theme Variants
// ============================================================================

export async function generateThemedIcon() {
    const result = await uiForgeClient.generateAsset({
        name: "Themed Icon",
        description: "Icon with light/dark theme variants",
        generator_type: GeneratorType.ICON,
        category: "toolbar",
        dimensions: { width: 64, height: 64 },
        output_formats: [OutputFormat.PNG],
        theme_variants: ["light", "dark"],
        colors: ["$primary", "$accent"], // Color tokens
        params: {
            layers: [
                {
                    type: "circle",
                    geometry: { cx: 32, cy: 32, r: 24 },
                    fill: {
                        type: GradientType.SOLID,
                        colors: ["$primary"]
                    }
                }
            ]
        }
    });

    return result;
}

// ============================================================================
// Example 9: Generate Animated Icon
// ============================================================================

export async function generateAnimatedIcon() {
    const result = await uiForgeClient.generateAsset({
        name: "Loading Spinner",
        description: "Animated loading spinner icon",
        generator_type: GeneratorType.ICON,
        category: "ui",
        dimensions: { width: 64, height: 64 },
        output_formats: [OutputFormat.SVG],
        params: {
            layers: [
                {
                    type: "circle",
                    geometry: { cx: 32, cy: 32, r: 20 },
                    stroke: {
                        color: "#3b82f6",
                        width: 4
                    },
                    fill: null
                }
            ]
        },
        animation: {
            enabled: true,
            motion_types: [MotionType.ORBIT],
            duration: 2.0,
            fps: 30,
            loop: true,
            output_type: AnimationOutputType.SVG_SMIL
        }
    });

    return result;
}

// ============================================================================
// Example 10: Hot-Reload Generator During Development
// ============================================================================

export async function reloadIconGenerator() {
    const result = await uiForgeClient.reloadGenerator('icon');
    console.log(result.message);
    return result;
}

// ============================================================================
// Example 11: Approve Preview Assets
// ============================================================================

export async function approveGeneratedAssets(previewId: string, assetIds: string[]) {
    const result = await uiForgeClient.approvePreview(assetIds, previewId, true);
    
    console.log(`Approved ${result.approved} assets`);
    console.log(`Moved ${result.moved_to_library} to library`);
    console.log('Library asset IDs:', result.library_asset_ids);

    return result;
}

// ============================================================================
// Example 12: Error Handling
// ============================================================================

export async function generateWithErrorHandling() {
    try {
        const result = await uiForgeClient.generateAsset({
            name: "Test Icon",
            description: "Test icon with error handling",
            generator_type: GeneratorType.ICON,
            category: "test",
            dimensions: { width: 64, height: 64 },
            output_formats: [OutputFormat.PNG],
            params: {
                layers: []
            }
        });

        return result;
    } catch (error) {
        if (error instanceof Error) {
            console.error('Generation failed:', error.message);
            
            // Check if it's a UI Forge specific error
            if ('type' in error && 'traceback' in error) {
                console.error('Error type:', (error as any).type);
                console.error('Traceback:', (error as any).traceback);
            }
        }
        throw error;
    }
}
