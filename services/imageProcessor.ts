/**
 * Simulates the Nanobanana Pro API call (Image-to-Image mode).
 * 
 * @param prompt The prompt to control the generation
 * @param sourceImageBase64 The source image for style reference (Mocking Img2Img)
 */
export const mockGenerateImageApi = async (prompt: string, sourceImageBase64?: string): Promise<string> => {
  return new Promise((resolve) => {
    // In a real scenario, we would POST { prompt, image: sourceImageBase64 } to the endpoint.
    console.log("Simulating Img2Img Generation...");
    console.log("Prompt:", prompt);
    console.log("Source Image Present:", !!sourceImageBase64);

    setTimeout(() => {
      // Fallback Logic:
      // If we have a source image, return a "fake" 3x3 grid derived from it.
      // This ensures the user sees a visual change (grid layout) even if API fails.
      if (sourceImageBase64) {
        createFakeGrid(sourceImageBase64).then(resolve);
      } else {
        // Fallback if no source provided
        const randomSeed = Math.floor(Math.random() * 1000);
        resolve(`https://picsum.photos/seed/${randomSeed}/1024/1024`);
      }
    }, 1500); 
  });
};

/**
 * Creates a fake 3x3 grid from the source image.
 * Simulates "variations" by slightly zooming/cropping the source into grid cells.
 */
const createFakeGrid = async (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const size = 1024; // Output size
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64); return; }

      // Fill white background (separators)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);

      const cellW = (size - 20) / 3; // 10px padding total -> 5px gaps
      const cellH = (size - 20) / 3;
      const gap = 10;

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const dx = col * (cellW + gap);
          const dy = row * (cellH + gap);
          
          // Random slight zoom/pan to simulate "variation"
          // We take a center crop of the source, but vary the scale/position slightly
          const zoom = 1 + Math.random() * 0.3; // 1.0 - 1.3x zoom
          const sw = img.width / zoom;
          const sh = img.height / zoom;
          const sx = (img.width - sw) / 2 + (Math.random() - 0.5) * (img.width * 0.1);
          const sy = (img.height - sh) / 2 + (Math.random() - 0.5) * (img.height * 0.1);

          ctx.drawImage(img, sx, sy, sw, sh, dx, dy, cellW, cellH);
        }
      }
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};

/**
 * Intelligent crop based on Global Projection Profile.
 * 
 * Update V3 - Robust Grid Detection:
 * 1. First detects and removes outer white borders
 * 2. Uses peak detection to find ALL significant white lines (not just near 1/3, 2/3)
 * 3. Validates detected grid structure and falls back gracefully
 * 4. Handles non-standard grids by finding content regions
 */
export const smartCropFromClick = async (
  imageUrl: string, 
  clickXPercent: number, 
  clickYPercent: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("No context"));
        return;
      }
      
      const width = img.width;
      const height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Helper: Get brightness at pixel
      const getBrightness = (x: number, y: number) => {
        const i = (y * width + x) * 4;
        return (data[i] + data[i + 1] + data[i + 2]) / 3;
      };

      // Helper: Check if a line is predominantly white
      const isWhiteLine = (isVertical: boolean, pos: number, threshold: number = 230) => {
        let whiteCount = 0;
        const total = isVertical ? height : width;
        const sampleStep = Math.max(1, Math.floor(total / 100)); // Sample 100 points for speed
        let samples = 0;
        
        for (let i = 0; i < total; i += sampleStep) {
          const brightness = isVertical ? getBrightness(pos, i) : getBrightness(i, pos);
          if (brightness > threshold) whiteCount++;
          samples++;
        }
        return whiteCount / samples > 0.85; // 85% of samples must be white
      };

      // ========== STEP 1: Detect and remove outer white border ==========
      const BORDER_THRESHOLD = 235;
      const MIN_BORDER_RATIO = 0.9; // 90% white pixels to count as border
      
      const detectBorder = (isVertical: boolean, fromEnd: boolean) => {
        const maxScan = isVertical ? Math.floor(width * 0.15) : Math.floor(height * 0.15);
        const lineLength = isVertical ? height : width;
        
        let borderEnd = 0;
        
        for (let pos = 0; pos < maxScan; pos++) {
          const actualPos = fromEnd 
            ? (isVertical ? width - 1 - pos : height - 1 - pos) 
            : pos;
          
          let whitePixels = 0;
          for (let i = 0; i < lineLength; i += 3) {
            const brightness = isVertical 
              ? getBrightness(actualPos, i) 
              : getBrightness(i, actualPos);
            if (brightness > BORDER_THRESHOLD) whitePixels++;
          }
          
          if (whitePixels / (lineLength / 3) >= MIN_BORDER_RATIO) {
            borderEnd = pos + 1;
          } else {
            // Found non-white line, but continue a bit to handle noise
            let foundContent = true;
            for (let check = 1; check <= 3 && pos + check < maxScan; check++) {
              const checkPos = fromEnd 
                ? (isVertical ? width - 1 - (pos + check) : height - 1 - (pos + check))
                : pos + check;
              let checkWhite = 0;
              for (let i = 0; i < lineLength; i += 5) {
                const b = isVertical 
                  ? getBrightness(checkPos, i) 
                  : getBrightness(i, checkPos);
                if (b > BORDER_THRESHOLD) checkWhite++;
              }
              if (checkWhite / (lineLength / 5) >= MIN_BORDER_RATIO) {
                foundContent = false;
                break;
              }
            }
            if (foundContent) break;
          }
        }
        return borderEnd;
      };

      const borderLeft = detectBorder(true, false);
      const borderRight = detectBorder(true, true);
      const borderTop = detectBorder(false, false);
      const borderBottom = detectBorder(false, true);

      // Content region after removing borders
      const contentLeft = borderLeft;
      const contentRight = width - borderRight;
      const contentTop = borderTop;
      const contentBottom = height - borderBottom;
      const contentWidth = contentRight - contentLeft;
      const contentHeight = contentBottom - contentTop;

      // ========== STEP 2: Calculate projection profiles within content area ==========
      const colAvgs = new Float32Array(contentWidth);
      const rowAvgs = new Float32Array(contentHeight);

      // Column averages (vertical lines detector)
      for (let x = 0; x < contentWidth; x++) {
        let sum = 0;
        for (let y = 0; y < contentHeight; y++) {
          sum += getBrightness(contentLeft + x, contentTop + y);
        }
        colAvgs[x] = sum / contentHeight;
      }

      // Row averages (horizontal lines detector)
      for (let y = 0; y < contentHeight; y++) {
        let sum = 0;
        for (let x = 0; x < contentWidth; x++) {
          sum += getBrightness(contentLeft + x, contentTop + y);
        }
        rowAvgs[y] = sum / contentWidth;
      }

      // ========== STEP 3: Find all significant white line regions ==========
      const GUTTER_THRESHOLD = 220;
      const MIN_LINE_THICKNESS = 2;
      const MIN_GAP_BETWEEN_LINES = 20; // Minimum content width between lines
      
      interface LineRegion {
        start: number;
        end: number;
        center: number;
        thickness: number;
        avgBrightness: number;
      }

      const findAllLines = (profile: Float32Array): LineRegion[] => {
        const lines: LineRegion[] = [];
        let i = 0;
        const len = profile.length;
        
        while (i < len) {
          if (profile[i] > GUTTER_THRESHOLD) {
            const runStart = i;
            let brightnessSum = 0;
            
            while (i < len && profile[i] > GUTTER_THRESHOLD) {
              brightnessSum += profile[i];
              i++;
            }
            
            const runEnd = i;
            const thickness = runEnd - runStart;
            
            // Only count lines with minimum thickness and not at the very edges
            if (thickness >= MIN_LINE_THICKNESS && 
                runStart > MIN_GAP_BETWEEN_LINES && 
                runEnd < len - MIN_GAP_BETWEEN_LINES) {
              lines.push({
                start: runStart,
                end: runEnd,
                center: (runStart + runEnd) / 2,
                thickness,
                avgBrightness: brightnessSum / thickness
              });
            }
          } else {
            i++;
          }
        }
        
        return lines;
      };

      const verticalLines = findAllLines(colAvgs);
      const horizontalLines = findAllLines(rowAvgs);

      // ========== STEP 4: Select best 2 dividers for 3x3 grid ==========
      const selectBestDividers = (lines: LineRegion[], totalLength: number): [number, number] => {
        const idealFirst = totalLength / 3;
        const idealSecond = (totalLength * 2) / 3;
        
        if (lines.length === 0) {
          // No lines detected, use geometric division
          return [idealFirst, idealSecond];
        }
        
        if (lines.length === 1) {
          // Only one line - decide if it's the first or second divider
          const line = lines[0];
          if (line.center < totalLength / 2) {
            return [line.center, idealSecond];
          } else {
            return [idealFirst, line.center];
          }
        }
        
        if (lines.length === 2) {
          // Exactly 2 lines - perfect!
          const sorted = [...lines].sort((a, b) => a.center - b.center);
          return [sorted[0].center, sorted[1].center];
        }
        
        // More than 2 lines - find the best pair
        // Score based on: proximity to ideal positions + creating roughly equal cells
        let bestPair: [number, number] = [idealFirst, idealSecond];
        let bestScore = -Infinity;
        
        for (let i = 0; i < lines.length; i++) {
          for (let j = i + 1; j < lines.length; j++) {
            const first = lines[i].center;
            const second = lines[j].center;
            
            // Check if they create roughly equal-sized cells
            const cell1Size = first;
            const cell2Size = second - first;
            const cell3Size = totalLength - second;
            
            const avgCellSize = totalLength / 3;
            const sizeVariance = 
              Math.abs(cell1Size - avgCellSize) + 
              Math.abs(cell2Size - avgCellSize) + 
              Math.abs(cell3Size - avgCellSize);
            
            // Proximity to ideal positions
            const positionScore = 
              -Math.abs(first - idealFirst) - Math.abs(second - idealSecond);
            
            // Prefer thicker, brighter lines
            const lineQuality = 
              (lines[i].thickness + lines[j].thickness) * 0.5 +
              (lines[i].avgBrightness + lines[j].avgBrightness) * 0.1;
            
            const score = positionScore - sizeVariance * 2 + lineQuality;
            
            if (score > bestScore) {
              bestScore = score;
              bestPair = [first, second];
            }
          }
        }
        
        return bestPair;
      };

      const [vDiv1, vDiv2] = selectBestDividers(verticalLines, contentWidth);
      const [hDiv1, hDiv2] = selectBestDividers(horizontalLines, contentHeight);

      // ========== STEP 5: Find line thickness at detected positions ==========
      const getLineThickness = (lines: LineRegion[], position: number): number => {
        for (const line of lines) {
          if (Math.abs(line.center - position) < line.thickness) {
            return line.thickness;
          }
        }
        return 0; // No line found, geometric cut
      };

      const v1Thickness = getLineThickness(verticalLines, vDiv1);
      const v2Thickness = getLineThickness(verticalLines, vDiv2);
      const h1Thickness = getLineThickness(horizontalLines, hDiv1);
      const h2Thickness = getLineThickness(horizontalLines, hDiv2);

      // ========== STEP 6: Define cell boundaries (in content coordinates) ==========
      const colBoundaries = [
        { start: 0, end: Math.floor(vDiv1 - v1Thickness / 2) },
        { start: Math.ceil(vDiv1 + v1Thickness / 2), end: Math.floor(vDiv2 - v2Thickness / 2) },
        { start: Math.ceil(vDiv2 + v2Thickness / 2), end: contentWidth }
      ];

      const rowBoundaries = [
        { start: 0, end: Math.floor(hDiv1 - h1Thickness / 2) },
        { start: Math.ceil(hDiv1 + h1Thickness / 2), end: Math.floor(hDiv2 - h2Thickness / 2) },
        { start: Math.ceil(hDiv2 + h2Thickness / 2), end: contentHeight }
      ];

      // ========== STEP 7: Map click to cell (convert click to content coordinates) ==========
      const clickXPx = clickXPercent * width - contentLeft;
      const clickYPx = clickYPercent * height - contentTop;

      // Find nearest cell center
      let targetCol = 0;
      let targetRow = 0;
      let minDistX = Infinity;
      let minDistY = Infinity;

      for (let i = 0; i < 3; i++) {
        const centerX = (colBoundaries[i].start + colBoundaries[i].end) / 2;
        const centerY = (rowBoundaries[i].start + rowBoundaries[i].end) / 2;
        
        const distX = Math.abs(clickXPx - centerX);
        const distY = Math.abs(clickYPx - centerY);
        
        if (distX < minDistX) { minDistX = distX; targetCol = i; }
        if (distY < minDistY) { minDistY = distY; targetRow = i; }
      }

      // ========== STEP 8: Calculate final crop (convert back to image coordinates) ==========
      let cropX = contentLeft + colBoundaries[targetCol].start;
      let cropY = contentTop + rowBoundaries[targetRow].start;
      let cropW = colBoundaries[targetCol].end - colBoundaries[targetCol].start;
      let cropH = rowBoundaries[targetRow].end - rowBoundaries[targetRow].start;

      // ========== STEP 9: Trim any remaining white edges from the cell ==========
      const TRIM_THRESHOLD = 240;
      const TRIM_RATIO = 0.92; // 92% white to trim
      
      const trimCell = () => {
        // Trim left
        while (cropW > 50) {
          let whitePixels = 0;
          for (let y = cropY; y < cropY + cropH; y += 3) {
            if (getBrightness(cropX, y) > TRIM_THRESHOLD) whitePixels++;
          }
          if (whitePixels / (cropH / 3) > TRIM_RATIO) {
            cropX++;
            cropW--;
          } else break;
        }
        
        // Trim right
        while (cropW > 50) {
          let whitePixels = 0;
          for (let y = cropY; y < cropY + cropH; y += 3) {
            if (getBrightness(cropX + cropW - 1, y) > TRIM_THRESHOLD) whitePixels++;
          }
          if (whitePixels / (cropH / 3) > TRIM_RATIO) {
            cropW--;
          } else break;
        }
        
        // Trim top
        while (cropH > 50) {
          let whitePixels = 0;
          for (let x = cropX; x < cropX + cropW; x += 3) {
            if (getBrightness(x, cropY) > TRIM_THRESHOLD) whitePixels++;
          }
          if (whitePixels / (cropW / 3) > TRIM_RATIO) {
            cropY++;
            cropH--;
          } else break;
        }
        
        // Trim bottom
        while (cropH > 50) {
          let whitePixels = 0;
          for (let x = cropX; x < cropX + cropW; x += 3) {
            if (getBrightness(x, cropY + cropH - 1) > TRIM_THRESHOLD) whitePixels++;
          }
          if (whitePixels / (cropW / 3) > TRIM_RATIO) {
            cropH--;
          } else break;
        }
      };

      trimCell();

      // Safety checks
      cropX = Math.max(0, Math.min(cropX, width - 10));
      cropY = Math.max(0, Math.min(cropY, height - 10));
      cropW = Math.max(50, Math.min(cropW, width - cropX));
      cropH = Math.max(50, Math.min(cropH, height - cropY));

      // ========== STEP 10: Execute Crop ==========
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) {
        reject(new Error("No crop context"));
        return;
      }

      cropCtx.drawImage(
        img,
        cropX, cropY, cropW, cropH,
        0, 0, cropW, cropH
      );

      resolve(cropCanvas.toDataURL('image/jpeg'));
    };

    img.onerror = reject;
    img.src = imageUrl;
  });
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Extracts the dominant color from an image URL.
 * Returns a CSS rgb string.
 */
export const getDominantColor = async (imageUrl: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Downscale for speed
      canvas.width = 50;
      canvas.height = 50;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('248, 250, 252'); // default slate-50
        return;
      }
      ctx.drawImage(img, 0, 0, 50, 50);
      const data = ctx.getImageData(0, 0, 50, 50).data;
      let r = 0, g = 0, b = 0;
      const count = data.length / 4;
      
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i+1];
        b += data[i+2];
      }
      
      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);
      
      resolve(`${r}, ${g}, ${b}`);
    };
    img.onerror = () => resolve('248, 250, 252');
    img.src = imageUrl;
  });
};
