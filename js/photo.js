// photo.js: shrinks a camera photo before we check or save it.
// Phone photos are often 3-6 MB; a 1024-pixel JPEG is about 150-300 KB.

import { PHOTO_MAX_EDGE, PHOTO_JPEG_QUALITY } from './config.js';

export async function downscalePhoto(file, maxEdge = PHOTO_MAX_EDGE, quality = PHOTO_JPEG_QUALITY) {
  // createImageBitmap decodes the photo and, in current browsers, applies
  // the camera's rotation (EXIF orientation) so portrait shots stay upright.
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  // Draw the photo onto a smaller canvas, then save the canvas as a JPEG.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Could not compress the photo.'))),
      'image/jpeg',
      quality,
    );
  });
  return { blob, width, height };
}
