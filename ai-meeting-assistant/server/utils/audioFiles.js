import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unlink } from 'node:fs/promises';

const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPLOAD_ROOT = path.resolve(SERVER_ROOT, 'uploads', 'meetings');

/** Resolve a persisted relative audio path while rejecting traversal/absolute paths. */
export function resolveStoredAudioPath(storedPath) {
  if (typeof storedPath !== 'string' || !storedPath || path.isAbsolute(storedPath)) return null;
  const candidate = path.resolve(SERVER_ROOT, storedPath);
  const relative = path.relative(UPLOAD_ROOT, candidate);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) return null;
  return candidate;
}

/** Remove one file only when its persisted path is inside uploads/meetings. */
export async function deleteStoredAudioFile(storedPath) {
  const target = resolveStoredAudioPath(storedPath);
  if (!target) return false;
  try {
    await unlink(target);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

export function getUploadRoot() {
  return UPLOAD_ROOT;
}
