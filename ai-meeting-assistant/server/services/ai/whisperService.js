import { spawn } from 'node:child_process';
import { mkdtemp, open, readFile, rm, stat, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_CAPTURE_BYTES = 2 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a']);
let activeJobs = 0;
const waiters = [];

export class WhisperError extends Error {
  constructor(message, { status = 503, code = 'WHISPER_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'WhisperError';
    this.status = status;
    this.code = code;
  }
}

function configuredConcurrency() {
  const value = Number(process.env.WHISPER_CONCURRENCY);
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 4) : 1;
}

async function acquireSlot() {
  if (activeJobs < configuredConcurrency()) {
    activeJobs += 1;
    return;
  }
  await new Promise((resolve) => waiters.push(resolve));
  activeJobs += 1;
}

function releaseSlot() {
  activeJobs = Math.max(0, activeJobs - 1);
  waiters.shift()?.();
}

function timeoutMs() {
  const configured = Number(process.env.WHISPER_TIMEOUT_MS);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function requiredPath(value, description, code) {
  const configured = value?.trim();
  if (!configured) throw new WhisperError(`${description} is not configured.`, { code });
  return configured;
}

async function requireFile(filePath, description, code, status = 503) {
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Configured path is not a file.');
  } catch (error) {
    throw new WhisperError(`${description} was not found or is not a file.`, { status, code, cause: error });
  }
}

async function collectProcess(child, timeout, label, { maxOutputBytes = MAX_CAPTURE_BYTES } = {}) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let exceededOutput = false;
    let timedOut = false;
    let settled = false;
    let killTimer;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      killTimer = setTimeout(() => child.kill('SIGKILL'), 5000);
    }, timeout);

    const clearTimers = () => {
      clearTimeout(timer);
      clearTimeout(killTimer);
    };
    const appendBounded = (current, chunk) => {
      const next = current + chunk.toString('utf8');
      if (Buffer.byteLength(next) > maxOutputBytes) {
        exceededOutput = true;
        return next.slice(-maxOutputBytes);
      }
      return next;
    };
    child.stdout?.on('data', (chunk) => { stdout = appendBounded(stdout, chunk); });
    child.stderr?.on('data', (chunk) => { stderr = appendBounded(stderr, chunk); });
    child.once('error', (error) => {
      clearTimers();
      settled = true;
      const code = error.code === 'ENOENT'
        ? `${label}_NOT_FOUND`
        : `${label}_START_FAILED`;
      const message = error.code === 'ENOENT'
        ? `${label === 'FFMPEG' ? 'FFmpeg' : 'Whisper.cpp'} executable was not found. Check its configured path.`
        : `${label === 'FFMPEG' ? 'FFmpeg' : 'Whisper.cpp'} could not be started.`;
      reject(new WhisperError(message, { code, cause: error }));
    });
    child.once('close', (code) => {
      clearTimers();
      if (settled) return;
      if (timedOut) {
        reject(new WhisperError(`${label === 'FFMPEG' ? 'FFmpeg conversion' : 'Whisper transcription'} timed out.`, {
          status: 504,
          code: `${label}_TIMEOUT`,
        }));
      } else if (exceededOutput) {
        reject(new WhisperError(`${label === 'FFMPEG' ? 'FFmpeg' : 'Whisper.cpp'} produced excessive diagnostic output.`, {
          code: `${label}_OUTPUT_LIMIT`,
        }));
      } else if (code !== 0) {
        // Diagnostic output stays separate from recognized speech and is never returned to clients.
        reject(new WhisperError(`${label === 'FFMPEG' ? 'FFmpeg conversion' : 'Whisper transcription'} failed.`, {
          status: 422,
          code: label === 'FFMPEG' ? 'FFMPEG_CONVERSION_FAILED' : 'WHISPER_TRANSCRIPTION_FAILED',
        }));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function validateWav(filePath) {
  let handle;
  try {
    handle = await open(filePath, 'r');
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const isWave = bytesRead === 12
      && ['RIFF', 'RF64'].includes(header.toString('ascii', 0, 4))
      && header.toString('ascii', 8, 12) === 'WAVE';
    if (!isWave) {
      throw new WhisperError('WAV audio has an invalid RIFF/WAVE header.', {
        status: 400,
        code: 'INVALID_WAV',
      });
    }
  } catch (error) {
    if (error instanceof WhisperError) throw error;
    throw new WhisperError('WAV audio could not be read.', { status: 400, code: 'INVALID_WAV', cause: error });
  } finally {
    await handle?.close().catch(() => {});
  }
}

function configuredThreads() {
  const value = Number(process.env.WHISPER_THREADS);
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 64) : 4;
}

async function convertAudioToWhisperWav(ffmpeg, inputPath, outputPath) {
  const args = [
    '-nostdin', '-hide_banner', '-loglevel', 'error', '-y',
    '-i', inputPath,
    '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
    outputPath,
  ];
  const child = spawn(ffmpeg, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  await collectProcess(child, timeoutMs(), 'FFMPEG');
  await requireFile(outputPath, 'FFmpeg converted WAV file', 'FFMPEG_OUTPUT_MISSING', 422);
  await validateWav(outputPath);
}

/** Transcribe an audio file locally; return recognized text only, never process logs. */
export async function transcribeAudio(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new WhisperError('Audio file path is required.', { status: 400, code: 'AUDIO_PATH_REQUIRED' });
  }

  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error('Audio path is not a file.');
  } catch (error) {
    throw new WhisperError('Uploaded audio file is unavailable for transcription.', {
      status: 400,
      code: 'AUDIO_FILE_MISSING',
      cause: error,
    });
  }

  const extension = path.extname(filePath).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.has(extension)) {
    throw new WhisperError('Unsupported audio file extension.', { status: 400, code: 'UNSUPPORTED_AUDIO' });
  }

  const executable = requiredPath(process.env.WHISPER_CPP_PATH, 'Whisper.cpp executable', 'WHISPER_NOT_CONFIGURED');
  const model = requiredPath(process.env.WHISPER_MODEL_PATH, 'Whisper model', 'WHISPER_MODEL_NOT_CONFIGURED');
  await requireFile(executable, 'Configured Whisper.cpp executable', 'WHISPER_NOT_FOUND');
  await requireFile(model, 'Configured Whisper model', 'WHISPER_MODEL_NOT_FOUND');

  if (extension === '.wav') await validateWav(filePath);
  const ffmpeg = requiredPath(process.env.FFMPEG_PATH, 'FFmpeg executable (required for audio normalization)', 'FFMPEG_NOT_CONFIGURED');
  if (path.isAbsolute(ffmpeg) || ffmpeg.includes('/') || ffmpeg.includes('\\')) {
    await requireFile(ffmpeg, 'Configured FFmpeg executable', 'FFMPEG_NOT_FOUND');
  }

  await acquireSlot();
  let temporaryDirectory;
  let outputText;
  try {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'meeting-audio-'));
    const whisperInput = path.join(temporaryDirectory, 'normalized-16khz-mono.wav');
    await convertAudioToWhisperWav(ffmpeg, filePath, whisperInput);

    const outputBase = path.join(temporaryDirectory, `whisper-${uuidv4()}`);
    outputText = `${outputBase}.txt`;
    const args = [
      '-m', model,
      '-f', whisperInput,
      '-l', 'en',
      '-t', String(configuredThreads()),
      '-otxt', '-of', outputBase, '-nt', '-np',
    ];
    // Whisper.cpp's default task is transcription; translation only activates when `-tr` is passed.

    const child = spawn(executable, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await collectProcess(child, timeoutMs(), 'WHISPER');
    let transcript;
    try {
      transcript = (await readFile(outputText, 'utf8')).trim();
    } catch (error) {
      throw new WhisperError('Whisper.cpp completed without producing a transcript file.', {
        status: 502,
        code: 'WHISPER_OUTPUT_MISSING',
        cause: error,
      });
    }
    if (!transcript) {
      throw new WhisperError('Whisper.cpp produced an empty transcript.', { status: 422, code: 'EMPTY_TRANSCRIPT' });
    }
    return { success: true, transcript, language: 'en', duration: null };
  } finally {
    releaseSlot();
    if (outputText) await unlink(outputText).catch(() => {});
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true }).catch(() => {});
  }
}
