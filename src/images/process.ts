import { execFile } from 'node:child_process';
import { mkdtemp, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { PROFILE_PHOTO_SIZE } from '../types.js';
import { ensureDir, removePath } from '../storage/files.js';

const require = createRequire(import.meta.url);
const ffmpegPath = require('ffmpeg-static') as string | null;

const execFileAsync = promisify(execFile);

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

export function isGifFile(mime?: string, fileName?: string): boolean {
  return mime === 'image/gif' || Boolean(fileName && /\.gif$/i.test(fileName));
}

export function isVideoFile(mime?: string, fileName?: string): boolean {
  if (mime?.startsWith('video/')) {
    return true;
  }
  return Boolean(fileName && /\.(mp4|webm|mov|m4v)$/i.test(fileName));
}

export async function replaceGallery(imagesDir: string, buffers: Buffer[]): Promise<string[]> {
  const tempDir = `${imagesDir}.next`;
  await removePath(tempDir);
  await ensureDir(tempDir);

  const files: string[] = [];
  for (const buffer of buffers) {
    const index = String(files.length).padStart(3, '0');
    try {
      const fileName = await processProfileMedia(buffer, tempDir, index);
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

async function processProfileMedia(
  input: Buffer,
  outputDir: string,
  index: string,
): Promise<string> {
  if (await shouldUseVideoProfile(input)) {
    const fileName = `${index}.mp4`;
    await convertToSquareMp4(input, path.join(outputDir, fileName));
    return fileName;
  }

  const fileName = `${index}.jpg`;
  await processProfileImage(input, path.join(outputDir, fileName));
  return fileName;
}

async function shouldUseVideoProfile(input: Buffer): Promise<boolean> {
  if (isVideoContainer(input)) {
    return true;
  }
  try {
    const meta = await sharp(input, { animated: true, failOn: 'none' }).metadata();
    return (meta.pages ?? 1) > 1;
  } catch {
    return false;
  }
}

function isVideoContainer(input: Buffer): boolean {
  return input.length > 12 && input.subarray(4, 8).toString('ascii') === 'ftyp';
}

async function convertToSquareMp4(input: Buffer, outputPath: string): Promise<void> {
  if (!ffmpegPath) {
    throw new Error('ffmpeg is not available');
  }

  await ensureDir(path.dirname(outputPath));
  const workDir = await mkdtemp(path.join(tmpdir(), 'pfp-gif-'));
  const inputPath = path.join(workDir, 'input.bin');

  try {
    await writeFile(inputPath, input);
    const size = PROFILE_PHOTO_SIZE;
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-i',
        inputPath,
        '-vf',
        `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}`,
        '-t',
        '10',
        '-r',
        '25',
        '-an',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        outputPath,
      ],
      { windowsHide: true },
    );
  } finally {
    await removePath(workDir);
  }
}
