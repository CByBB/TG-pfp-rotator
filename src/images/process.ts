import { rename } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PROFILE_PHOTO_SIZE } from '../types.js';
import { ensureDir, removePath } from '../storage/files.js';

export async function processProfileImage(input: Buffer, outputPath: string): Promise<void> {
  await ensureDir(path.dirname(outputPath));
  await sharp(input)
    .rotate()
    .resize(PROFILE_PHOTO_SIZE, PROFILE_PHOTO_SIZE, {
      fit: 'cover',
      position: 'centre',
    })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(outputPath);
}

export function isSupportedImage(mime?: string, fileName?: string): boolean {
  if (mime?.startsWith('image/')) {
    return !mime.includes('svg');
  }
  if (!fileName) {
    return false;
  }
  return /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(fileName);
}

export async function replaceGallery(imagesDir: string, buffers: Buffer[]): Promise<string[]> {
  const tempDir = `${imagesDir}.next`;
  await removePath(tempDir);
  await ensureDir(tempDir);

  const files: string[] = [];
  for (const buffer of buffers) {
    const fileName = `${String(files.length).padStart(3, '0')}.jpg`;
    try {
      await processProfileImage(buffer, path.join(tempDir, fileName));
      files.push(fileName);
    } catch {
      // skip unreadable images and keep the rest of the batch
    }
  }

  if (files.length === 0) {
    await removePath(tempDir);
    throw new Error('No processable images in this batch');
  }

  await removePath(imagesDir);
  await rename(tempDir, imagesDir);
  return files;
}
