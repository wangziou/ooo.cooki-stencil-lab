export enum StencilMode {
  SOLID = 'SOLID',
  HOLLOW = 'HOLLOW',
  REALISM = 'REALISM'
}

export interface StencilSettings {
  threshold: number; // 0-255, determines black/white cutoff
  thickness: number; // -5 to 10, dilation/erosion
  noiseReduction: number; // -4 to 5, negative=sharpen, positive=smooth
  mode: StencilMode;
  isMirrored: boolean; // Flips image horizontally
  isMultipleSizes: boolean; // Grid mode
  variantCount: number; // 3, 6, or 9
  minSize: number; // Inches (0.5 - 9)
  maxSize: number; // Inches (0.5 - 9)
  showDimensions: boolean; // Draw size label

  // Realism Mode Settings
  saturation?: number; // 0-500 (100 = default)
  contrast?: number;   // 0-500 (100 = default)
  brightness?: number; // 0-500 (100 = default)
  sharpness?: number;  // 0-10 (0 = default)
}

export interface ProcessedImage {
  id: string;
  originalUrl: string;
  processedUrl: string | null;
  name: string;
  settings: StencilSettings;
  isProcessing: boolean;
  fileType: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}