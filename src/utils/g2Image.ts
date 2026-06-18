/** Object URL for the phone preview panel. */
export function createViewfinderPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

export async function readImageDimensions(
  blob: Blob
): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return dimensions;
}

/**
 * Encode camera frame as PNG at exact G2 container dimensions.
 * Width and height must match the ImageContainerProperty.
 */
export async function prepareG2ImageBytes(
  blob: Blob,
  targetWidth: number,
  targetHeight: number
): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(blob);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas not available for viewfinder image");
  }

  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const png = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error("Failed to encode viewfinder PNG"));
      },
      "image/png"
    );
  });

  return new Uint8Array(await png.arrayBuffer());
}
