import { open, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { getUploadRoot } from '../utils/audioFiles.js';

const supported = {
  '.wav': new Set(['audio/wav', 'audio/x-wav', 'audio/vnd.wave']),
  '.mp3': new Set(['audio/mpeg', 'audio/mp3']),
  '.m4a': new Set(['audio/mp4', 'audio/x-m4a', 'audio/m4a']),
};

export class AudioUploadError extends Error {
  constructor(message, status = 400, code = 'INVALID_AUDIO') {
    super(message);
    this.name = 'AudioUploadError';
    this.status = status;
    this.code = code;
  }
}

function maximumFileSize() {
  const configured = Number(process.env.MAX_AUDIO_UPLOAD_BYTES);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : 100 * 1024 * 1024;
}

function validatedExtensionAndMime(file) {
  const extension = path.extname(file.originalname.replaceAll('\\', '/')).toLowerCase();
  return supported[extension]?.has((file.mimetype || '').toLowerCase()) ? extension : null;
}

const storage = multer.diskStorage({
  destination(_req, _file, callback) {
    const directory = getUploadRoot();
    mkdir(directory, { recursive: true }).then(() => callback(null, directory), callback);
  },
  filename(_req, file, callback) {
    const extension = validatedExtensionAndMime(file);
    if (!extension) return callback(new AudioUploadError('Unsupported audio format. Upload a WAV, MP3, or M4A file.'));
    callback(null, `${uuidv4()}${extension}`);
  },
});

const parser = multer({
  storage,
  limits: { fileSize: maximumFileSize(), files: 1, fields: 8 },
  fileFilter(_req, file, callback) {
    if (!validatedExtensionAndMime(file)) {
      return callback(new AudioUploadError('Unsupported audio format. The extension and audio MIME type must match WAV, MP3, or M4A.'));
    }
    callback(null, true);
  },
}).single('audio');

/** Parse one audio upload and translate Multer failures to useful HTTP errors. */
export function uploadAudio(req, res, next) {
  parser(req, res, (error) => {
    if (!error) return next();
    if (error instanceof AudioUploadError) return next(error);
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return next(new AudioUploadError('Audio file exceeds the configured upload limit.', 413, error.code));
    }
    if (error instanceof multer.MulterError) {
      return next(new AudioUploadError('Invalid audio upload request.', 400, error.code));
    }
    return next(new AudioUploadError('Audio upload could not be stored.', 500, 'AUDIO_STORAGE_ERROR'));
  });
}

function hasValidSignature(extension, header) {
  if (extension === '.wav') {
    return header.length >= 12
      && header.toString('ascii', 0, 4) === 'RIFF'
      && header.toString('ascii', 8, 12) === 'WAVE';
  }
  if (extension === '.m4a') {
    return header.length >= 12 && header.toString('ascii', 4, 8) === 'ftyp';
  }
  if (extension === '.mp3') {
    return (header.length >= 3 && header.toString('ascii', 0, 3) === 'ID3')
      || (header.length >= 2 && header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
  }
  return false;
}

/** Validate file magic bytes after upload; client MIME/extension are insufficient. */
export async function verifyAudioSignature(req, _res, next) {
  if (!req.file) return next();
  let handle;
  try {
    const extension = validatedExtensionAndMime(req.file);
    handle = await open(req.file.path, 'r');
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (!extension || !hasValidSignature(extension, header.subarray(0, bytesRead))) {
      const error = new AudioUploadError('Uploaded file contents do not match a supported audio format.');
      await unlink(req.file.path).catch(() => {});
      req.file = undefined;
      return next(error);
    }
    return next();
  } catch {
    await unlink(req.file.path).catch(() => {});
    req.file = undefined;
    return next(new AudioUploadError('Could not verify the uploaded audio file.', 400));
  } finally {
    await handle?.close().catch(() => {});
  }
}
