/**
 * Ultra-lightweight client-side image optimizer and converter.
 * Automatically resizes and compresses user-uploaded avatar photos into
 * compact WebP format (typically 8 KB - 25 KB) using browser HTML5 Canvas.
 * This ensures zero storage bloat, instant rendering, and fast Firestore syncing.
 */

export interface OptimizedImageResult {
  dataUrl: string;
  sizeKb: number;
  width: number;
  height: number;
  format: 'webp' | 'jpeg';
}

/**
 * Optimizes and converts an uploaded image file into a compact WebP data URL.
 * @param file The uploaded File object
 * @param maxDimension The maximum width or height in pixels (default: 256px)
 * @param quality Compression quality from 0.1 to 1.0 (default: 0.78)
 */
export async function optimizeAndConvertToWebP(
  file: File,
  maxDimension = 256,
  quality = 0.78
): Promise<OptimizedImageResult> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image in browser.'));
      img.onload = () => {
        try {
          // Calculate proportional aspect ratio scaling
          let targetWidth = img.width;
          let targetHeight = img.height;

          if (targetWidth > maxDimension || targetHeight > maxDimension) {
            if (targetWidth > targetHeight) {
              targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
              targetWidth = maxDimension;
            } else {
              targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
              targetHeight = maxDimension;
            }
          }

          // Create offscreen canvas for resizing
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = targetHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Could not initialize canvas context.'));
            return;
          }

          // Enable high-quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw the resized image
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

          // Try exporting to WebP first
          let format: 'webp' | 'jpeg' = 'webp';
          let dataUrl = canvas.toDataURL('image/webp', quality);

          // Fallback if browser does not support image/webp output
          if (!dataUrl.startsWith('data:image/webp')) {
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            format = 'jpeg';
          }

          // Calculate byte size
          const stringLength = dataUrl.length - 'data:image/webp;base64,'.length;
          const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383;
          const sizeKb = Number((sizeInBytes / 1024).toFixed(1));

          resolve({
            dataUrl,
            sizeKb,
            width: targetWidth,
            height: targetHeight,
            format
          });
        } catch (err) {
          reject(err);
        }
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Built-in preset student avatars (lightweight SVG data avatars)
 * allowing students to choose a beautiful Islamic / Quranic learning persona.
 */
export interface PresetAvatar {
  id: string;
  name: string;
  category: string;
  bgGradient: string;
  iconSvg: string;
}

export const PRESET_STUDENT_AVATARS: PresetAvatar[] = [
  {
    id: 'emerald_quran',
    name: 'Quran Scholar',
    category: 'Learning',
    bgGradient: 'from-emerald-600 to-teal-800',
    iconSvg: '📖'
  },
  {
    id: 'gold_crescent',
    name: 'Noor Crescent',
    category: 'Islamic',
    bgGradient: 'from-amber-500 to-yellow-700',
    iconSvg: '🌙'
  },
  {
    id: 'hifz_star',
    name: 'Hifz Champion',
    category: 'Achievement',
    bgGradient: 'from-blue-600 to-indigo-800',
    iconSvg: '⭐'
  },
  {
    id: 'tajweed_gem',
    name: 'Tajweed Master',
    category: 'Achievement',
    bgGradient: 'from-purple-600 to-pink-800',
    iconSvg: '💎'
  },
  {
    id: 'minaret_green',
    name: 'Sacred Mosque',
    category: 'Islamic',
    bgGradient: 'from-emerald-700 to-green-950',
    iconSvg: '🕌'
  },
  {
    id: 'dawn_sun',
    name: 'Fajr Seeker',
    category: 'Spirituality',
    bgGradient: 'from-orange-500 to-amber-700',
    iconSvg: '☀️'
  },
  {
    id: 'scroll_quill',
    name: 'Arabic Pen',
    category: 'Learning',
    bgGradient: 'from-stone-600 to-neutral-800',
    iconSvg: '✒️'
  },
  {
    id: 'compass_qibla',
    name: 'Qibla Guide',
    category: 'Islamic',
    bgGradient: 'from-cyan-600 to-blue-800',
    iconSvg: '🧭'
  }
];
