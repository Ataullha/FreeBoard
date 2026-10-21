import type { BinaryFileData } from '@excalidraw/excalidraw/types';
import { createId } from '../model/id';
import { MAX_IMAGE_BYTES, MAX_IMAGE_PIXELS } from '../model/document';
import { hasRasterSignature, rasterSize } from './raster';
export async function imageDimensions(
  dataURL: string,
): Promise<{ width: number; height: number }> {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataURL);
  if (!match)
    throw new Error('Only embedded PNG, JPEG, and WebP images are allowed.');
  rasterSize(atob(match[2]), match[1]);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('This image could not be decoded.'));
    img.src = dataURL;
  });
  if (
    !img.naturalWidth ||
    img.naturalWidth > 8192 ||
    img.naturalHeight > 8192 ||
    img.naturalWidth * img.naturalHeight > MAX_IMAGE_PIXELS
  )
    throw new Error(
      'Use an image up to 20 megapixels and 8,192 pixels on each side.',
    );
  return { width: img.naturalWidth, height: img.naturalHeight };
}
export async function readImage(
  file: File,
): Promise<{ file: BinaryFileData; width: number; height: number }> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > MAX_IMAGE_BYTES)
    throw new Error('Use an image smaller than 10 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (
    !hasRasterSignature(String.fromCharCode(...bytes.slice(0, 16)), file.type)
  )
    throw new Error('The image contents do not match its file type.');
  const dataURL = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Could not read this image.'));
    r.readAsDataURL(file);
  });
  const dimensions = await imageDimensions(dataURL);
  const digest = crypto.subtle
    ? await crypto.subtle.digest('SHA-256', bytes)
    : null;
  const id = digest
    ? Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('')
    : createId();
  return {
    file: {
      id,
      dataURL,
      mimeType: file.type,
      created: Date.now(),
      lastRetrieved: Date.now(),
    } as BinaryFileData,
    ...dimensions,
  };
}
