import { StencilSettings, StencilMode } from '../types';

export const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
};

/**
 * Super-fast Box Blur using a Sliding Window accumulator.
 * Complexity: O(N) independent of radius.
 */
const boxBlur = (source: Float32Array, w: number, h: number, radius: number): Float32Array => {
  if (radius < 1) return new Float32Array(source);

  const len = w * h;
  const target = new Float32Array(len);
  const temp = new Float32Array(len);

  // Horizontal Pass
  for (let y = 0; y < h; y++) {
    const rowStart = y * w;
    let sum = 0;
    const windowSize = radius * 2 + 1;

    // Pre-fill accumulator with edge extension
    for (let i = 0; i < radius; i++) sum += source[rowStart];
    for (let i = 0; i <= radius; i++) sum += source[rowStart + i];

    for (let x = 0; x < w; x++) {
      // Average = sum / windowSize
      temp[rowStart + x] = sum / windowSize;

      // Slide window: subtract leaving pixel, add entering pixel
      const leavingIndex = Math.max(0, x - radius);
      const enteringIndex = Math.min(w - 1, x + radius + 1);

      sum -= source[rowStart + leavingIndex];
      sum += source[rowStart + enteringIndex];
    }
  }

  // Vertical Pass
  for (let x = 0; x < w; x++) {
    let sum = 0;
    const windowSize = radius * 2 + 1;

    // Pre-fill
    for (let i = 0; i < radius; i++) sum += temp[x];
    for (let i = 0; i <= radius; i++) sum += temp[x + i * w];

    for (let y = 0; y < h; y++) {
      target[y * w + x] = sum / windowSize;

      const leavingIndex = Math.max(0, y - radius);
      const enteringIndex = Math.min(h - 1, y + radius + 1);

      sum -= temp[leavingIndex * w + x];
      sum += temp[enteringIndex * w + x];
    }
  }

  return target;
};
// Helper to clamp values
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

export const convolve = (data: Uint8ClampedArray, w: number, h: number, matrix: number[]) => {
  const side = Math.round(Math.sqrt(matrix.length));
  const half = Math.floor(side / 2);
  const src = new Uint8ClampedArray(data);
  const len = src.length;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      const dstOff = (y * w + x) * 4;

      for (let cy = 0; cy < side; cy++) {
        for (let cx = 0; cx < side; cx++) {
          const scy = y + cy - half;
          const scx = x + cx - half;

          if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
            const srcOff = (scy * w + scx) * 4;
            const wt = matrix[cy * side + cx];
            r += src[srcOff] * wt;
            g += src[srcOff + 1] * wt;
            b += src[srcOff + 2] * wt;
          }
        }
      }
      data[dstOff] = clamp(r, 0, 255);
      data[dstOff + 1] = clamp(g, 0, 255);
      data[dstOff + 2] = clamp(b, 0, 255);
    }
  }
};

export const generateStencil = async (
  img: HTMLImageElement,
  settings: StencilSettings
): Promise<string> => {
  // 1. Resize if too large to keep performance snappy during processing
  // Note: We will upscale for the final A4 print, but processing happens on this size
  const MAX_DIM = 2500;
  let w = img.naturalWidth;
  let h = img.naturalHeight;

  if (w > MAX_DIM || h > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas context missing");

  // Handle Mirroring
  ctx.save();
  if (settings.isMirrored) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  if (settings.mode === StencilMode.REALISM) {
    // Apply CSS-like filters for Realism (Contrast & Brightness only)
    // Saturation is replaced by Brilliance (applied manually later)
    const contrast = settings.contrast !== undefined ? settings.contrast : 100;
    const brightness = settings.brightness !== undefined ? settings.brightness : 100;

    ctx.filter = `contrast(${contrast}%) brightness(${brightness}%)`;
  }

  ctx.drawImage(img, 0, 0, w, h);
  ctx.restore();

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Realism specific processing (Brilliance & Sharpness) -> Return Early
  if (settings.mode === StencilMode.REALISM) {
    const brilliance = settings.brilliance || 0; // -100 to 100

    if (brilliance !== 0) {
      // Smart Tone Mapping (Brilliance)
      const strength = brilliance / 100;
      for (let i = 0; i < w * h; i++) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];

        // 1. Calculate Luma (Y)
        const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

        // 2. Brilliance Curve
        let newY = y;

        if (strength > 0) {
          // Positive Brilliance: HDR look
          // Lift shadows: add to Y where Y is small
          const shadowLift = Math.pow(1 - y, 5) * 1.0 * strength; // Strong lift at very bottom

          // Dampen highlights: subtract from Y where Y is large
          const highlightDamp = Math.pow(y, 4) * 0.4 * strength;

          newY = y + shadowLift - highlightDamp;

          // Midtone Contrast Boost (Sigmoid)
          // We mix original linear Y with a sigmoid curve
          const sigmoid = 1 / (1 + Math.exp(-10 * (newY - 0.5))); // Steep sigmoid
          // Map sigmoid back to 0-1 nicely
          // Or simpler: use a contrast polynomial
          // f(x) = x + alpha * x * (1-x) * (x-0.5) ? No

          // Simple contrast stretch around 0.5
          // val = (val - 0.5) * contrast + 0.5
          const contrastFactor = 1 + (strength * 0.5); // Up to 1.5x contrast
          const contrasted = (newY - 0.5) * contrastFactor + 0.5;

          // Learn/Mix: 
          // We want the shadow/highlight recovery, AND the contrast.
          // Let's use the contrasted version, but clamped.
          newY = Math.max(0, Math.min(1, contrasted));

        } else {
          // Negative Brilliance: Flatten / Dull
          newY = y * (1 + strength * 0.5); // Just darken/dull
        }

        // 3. Apply Y shift to RGB
        // preserve color ratios
        if (y > 0.001) {
          const scale = newY / y;
          data[i * 4] = clamp(r * scale, 0, 255);
          data[i * 4 + 1] = clamp(g * scale, 0, 255);
          data[i * 4 + 2] = clamp(b * scale, 0, 255);
        }
      }
    }

    if (settings.sharpness && settings.sharpness > 0) {
      // Simple Sharpen Kernel
      // A standard sharpen kernel
      //  0 -1  0
      // -1  5 -1
      //  0 -1  0
      // For controllable sharpness, we can blend original and sharpened, 
      // or use a weighted kernel. Let's use a weighted approach.
      const s = settings.sharpness; // 0 to 10
      // The center weight increases with sharpness
      // This is a basic high-pass filter addition
      const kernel = [
        0, -s, 0,
        -s, 4 * s + 1, -s,
        0, -s, 0
      ];
      // Normalization check? The sum is 1, so brightness is preserved.
      convolve(data, w, h, kernel);
    }
    // Put data back and return
    ctx.putImageData(imgData, 0, 0);
    return finishProcessing(canvas, settings, w, h);
  }

  // 2. Extract Luma (Grayscale)
  const luma = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    // Standard Rec. 601 luma
    luma[i] = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;
  }

  const output = new Float32Array(w * h);

  // 3. Pre-process (Sharpen or Blur based on Detail Level)
  // Detail Level slider (-4 to 5)
  // < 0: Sharpen (Max Detail)
  // > 0: Blur (Smoother)
  let processedLuma = luma;

  if (settings.noiseReduction < 0) {
    // SHARPEN (Unsharp Mask)
    // Strength is proportional to negative value
    const strength = Math.abs(settings.noiseReduction) * 0.5;
    const blurForSharpen = boxBlur(luma, w, h, 1);
    processedLuma = new Float32Array(w * h);

    for (let i = 0; i < w * h; i++) {
      // Original + (Original - Blurred) * amount
      const detail = luma[i] - blurForSharpen[i];
      const val = luma[i] + detail * strength;
      processedLuma[i] = Math.min(255, Math.max(0, val));
    }
  } else if (settings.noiseReduction > 0) {
    // BLUR (Smooth)
    // Only apply pre-blur here for SOLID mode. 
    // For Outline mode, we use the parameter to adjust DoG radii.
    if (settings.mode === StencilMode.SOLID) {
      processedLuma = boxBlur(luma, w, h, settings.noiseReduction);
    }
  }

  // 4. Apply Algorithms
  if (settings.mode === StencilMode.SOLID) {
    /**
     * ADAPTIVE THRESHOLDING
     */
    // Calculate local mean with a medium radius (simulates local lighting)
    const localMean = boxBlur(processedLuma, w, h, 16);

    // Threshold sensitivity
    const bias = (255 - settings.threshold) / 5;

    for (let i = 0; i < w * h; i++) {
      if (processedLuma[i] < localMean[i] - bias) {
        output[i] = 0; // Ink
      } else {
        output[i] = 255; // Skin
      }
    }

  } else {
    /**
     * DIFFERENCE OF GAUSSIANS (DoG)
     */

    // If we are in sharpening mode (negative), we use tight radii.
    // If we are in smoothing mode (positive), we scale radii up.
    const effectiveBlur = Math.max(0, settings.noiseReduction);

    // Base radius
    const r1 = Math.max(0.5, effectiveBlur * 0.8);
    const r2 = r1 * 2.5;

    // Use processedLuma (which might be sharpened) or raw luma?
    // Using sharpened luma for DoG creates very crisp edges.
    const blur1 = boxBlur(processedLuma, w, h, Math.ceil(r1));
    const blur2 = boxBlur(processedLuma, w, h, Math.ceil(r2));

    const sensitivity = (255 - settings.threshold) / 255;
    const cutoff = 2 + (sensitivity * 10);

    for (let i = 0; i < w * h; i++) {
      const diff = (blur1[i] - blur2[i]);
      if (diff < -cutoff) {
        output[i] = 0; // Black
      } else {
        output[i] = 255; // White
      }
    }
  }

  // 5. Morphology (Thickness)
  let finalMap = output;
  if (settings.thickness !== 0) {
    const passes = Math.abs(settings.thickness);
    const isDilate = settings.thickness > 0;

    let bufA = Float32Array.from(output);
    let bufB = new Float32Array(output.length);

    const safePasses = Math.min(passes, 15);

    for (let p = 0; p < safePasses; p++) {
      const src = p % 2 === 0 ? bufA : bufB;
      const dst = p % 2 === 0 ? bufB : bufA;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          const val = src[idx];

          if (isDilate) {
            if (val > 128) {
              const n = y > 0 ? src[idx - w] : 255;
              const s = y < h - 1 ? src[idx + w] : 255;
              const w_pix = x > 0 ? src[idx - 1] : 255;
              const e_pix = x < w - 1 ? src[idx + 1] : 255;

              if (n < 128 || s < 128 || w_pix < 128 || e_pix < 128) {
                dst[idx] = 0;
              } else {
                dst[idx] = 255;
              }
            } else {
              dst[idx] = 0;
            }
          } else {
            if (val < 128) {
              const n = y > 0 ? src[idx - w] : 0;
              const s = y < h - 1 ? src[idx + w] : 0;
              const w_pix = x > 0 ? src[idx - 1] : 0;
              const e_pix = x < w - 1 ? src[idx + 1] : 0;

              if (n > 128 || s > 128 || w_pix > 128 || e_pix > 128) {
                dst[idx] = 255;
              } else {
                dst[idx] = 0;
              }
            } else {
              dst[idx] = 255;
            }
          }
        }
      }
    }
    finalMap = safePasses % 2 === 0 ? bufA : bufB;
  }

  // 6. Create Intermediate Stencil Image
  const dstData = imgData.data;
  for (let i = 0; i < w * h; i++) {
    const val = finalMap[i];
    dstData[i * 4] = val;
    dstData[i * 4 + 1] = val;
    dstData[i * 4 + 2] = val;
    dstData[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return finishProcessing(canvas, settings, w, h);
};

function finishProcessing(canvas: HTMLCanvasElement, settings: StencilSettings, w: number, h: number): string {
  // 7. Compose Final A4 Output
  // A4 size at 300 DPI
  const DPI = 300;
  const A4_WIDTH = 2480; // 8.27 in * 300
  const A4_HEIGHT = 3508; // 11.69 in * 300

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = A4_WIDTH;
  finalCanvas.height = A4_HEIGHT;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) return canvas.toDataURL('image/png');

  // Fill white background
  finalCtx.fillStyle = 'white';
  finalCtx.fillRect(0, 0, A4_WIDTH, A4_HEIGHT);

  // Source aspect ratio
  const aspect = w / h;

  if (settings.isMultipleSizes) {
    const count = settings.variantCount || 9;

    // Determine layout based on count
    let cols = 3;
    let rows = 3;

    if (count === 3) {
      // Vertical stack for 3 items allows for larger widths if needed
      cols = 1;
      rows = 3;
    } else if (count === 6) {
      cols = 2;
      rows = 3;
    } else {
      cols = 3;
      rows = 3;
    }

    const cellW = A4_WIDTH / cols;
    const cellH = A4_HEIGHT / rows;

    const startSizePx = settings.minSize * DPI;
    const endSizePx = settings.maxSize * DPI;

    // Avoid division by zero if count is 1 (unlikely here but safe)
    const step = (count > 1) ? (endSizePx - startSizePx) / (count - 1) : 0;

    finalCtx.font = "bold 40px Arial";
    finalCtx.textAlign = "center";
    finalCtx.fillStyle = "black";

    for (let i = 0; i < count; i++) {
      // Calculate pixel size for the longest dimension based on INCHES requested
      const targetSizeInches = settings.minSize + ((settings.maxSize - settings.minSize) / (count - 1)) * i;
      const targetLongestSide = targetSizeInches * DPI;

      let drawW, drawH;
      if (w >= h) {
        drawW = targetLongestSide;
        drawH = targetLongestSide / aspect;
      } else {
        drawH = targetLongestSide;
        drawW = targetLongestSide * aspect;
      }

      // Grid Position
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = col * cellW + cellW / 2;
      const cy = row * cellH + cellH / 2;

      // Draw Image Centered
      finalCtx.drawImage(canvas, cx - drawW / 2, cy - drawH / 2, drawW, drawH);

      // Draw Dimensions Label
      if (settings.showDimensions) {
        const labelY = cy + (drawH / 2) + 50;
        // Ensure label doesn't go off bottom of cell too much
        if (labelY < (row + 1) * cellH) {
          finalCtx.fillText(`${targetSizeInches.toFixed(1)}"`, cx, labelY);
        } else {
          // If image fills cell, draw text overlaid at bottom
          finalCtx.fillText(`${targetSizeInches.toFixed(1)}"`, cx, (row + 1) * cellH - 20);
        }
      }
    }

  } else {
    // Single Mode: Fit to A4 with padding
    const padding = 100;
    const availW = A4_WIDTH - padding * 2;
    const availH = A4_HEIGHT - padding * 2;

    let drawW = availW;
    let drawH = availW / aspect;

    if (drawH > availH) {
      drawH = availH;
      drawW = availH * aspect;
    }

    finalCtx.drawImage(canvas, (A4_WIDTH - drawW) / 2, (A4_HEIGHT - drawH) / 2, drawW, drawH);
  }

  // Return as PNG (better quality for line work than JPG)
  return finalCanvas.toDataURL('image/png');
}