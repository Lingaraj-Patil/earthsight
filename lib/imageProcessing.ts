/**
 * Real client-side image compression, run in the browser via canvas before
 * an image is persisted to localStorage or sent to the analysis API. This
 * keeps report payloads well under localStorage quota and reduces upload
 * size — it performs actual resizing/re-encoding work, not a cosmetic
 * delay.
 */

const MAX_DIMENSION = 1600;
const INITIAL_QUALITY = 0.82;
const MIN_QUALITY = 0.4;
const TARGET_MAX_BYTES = 2 * 1024 * 1024; // soft ceiling after compression

export async function compressImageToDataUrl(file: File): Promise<string> {
  const image = await loadImage(file);
  const { width, height } = scaledDimensions(image.width, image.height, MAX_DIMENSION);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("This browser could not process the image.");
  }
  ctx.drawImage(image, 0, 0, width, height);

  let quality = INITIAL_QUALITY;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (estimateBytes(dataUrl) > TARGET_MAX_BYTES && quality > MIN_QUALITY) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  return dataUrl;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read this image."));
    };
    img.src = objectUrl;
  });
}

function scaledDimensions(width: number, height: number, maxDimension: number) {
  if (width <= maxDimension && height <= maxDimension) return { width, height };
  const ratio = width > height ? maxDimension / width : maxDimension / height;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function estimateBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.round((base64.length * 3) / 4);
}
