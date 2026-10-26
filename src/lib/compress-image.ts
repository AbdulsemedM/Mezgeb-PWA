/** ADR-016: the server takes receipt photos up to 600 KB; aim well below on 3G. */
export const MAX_RECEIPT_BYTES = 600 * 1024;
const TARGET_BYTES = 250 * 1024;
const MAX_SIDE = 1280;
const QUALITIES = [0.75, 0.6, 0.45, 0.3];

/**
 * W6: shrinks a camera photo on the phone before it is queued (WEB-001: 3G, little data):
 * at most 1280 px on the long side, JPEG, lowering quality until it fits. Null when the photo
 * cannot be read or stays too large.
 */
export async function compressReceipt(file: Blob): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let best: Blob | null = null;
  for (const quality of QUALITIES) {
    best = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (best && best.size <= TARGET_BYTES) return best;
  }
  return best && best.size <= MAX_RECEIPT_BYTES ? best : null;
}
