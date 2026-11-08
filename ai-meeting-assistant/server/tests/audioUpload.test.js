import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { verifyAudioSignature } from '../middleware/uploadMiddleware.js';
import { transcribeAudio, WhisperError } from '../services/ai/whisperService.js';
import { resolveStoredAudioPath } from '../utils/audioFiles.js';

function runSignature(file) {
  return new Promise((resolve) => {
    verifyAudioSignature({ file }, {}, (error) => resolve(error || null));
  });
}

test('audio signature validator accepts WAV headers and removes mislabeled content', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'meeting-audio-test-'));
  const wavPath = path.join(directory, 'sample.wav');
  const invalidPath = path.join(directory, 'invalid.wav');
  try {
    const wav = Buffer.alloc(16);
    wav.write('RIFF', 0, 'ascii');
    wav.write('WAVE', 8, 'ascii');
    await writeFile(wavPath, wav);
    assert.equal(await runSignature({
      path: wavPath,
      originalname: 'sample.wav',
      mimetype: 'audio/wav',
    }), null);

    await writeFile(invalidPath, 'plain text pretending to be audio');
    const error = await runSignature({
      path: invalidPath,
      originalname: 'notes.wav',
      mimetype: 'audio/wav',
    });
    assert.equal(error?.status, 400);
    await assert.rejects(readFile(invalidPath), { code: 'ENOENT' });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('audio path resolver rejects absolute paths and traversal', () => {
  assert.equal(resolveStoredAudioPath('../.env'), null);
  assert.equal(resolveStoredAudioPath('C:\\outside.wav'), null);
  assert.equal(resolveStoredAudioPath('uploads/meetings/one.wav')?.endsWith(path.join('uploads', 'meetings', 'one.wav')), true);
});

test('Whisper service reports missing configuration and model instead of generating a transcript', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'meeting-whisper-test-'));
  const audioPath = path.join(directory, 'sample.wav');
  const prior = {
    executable: process.env.WHISPER_CPP_PATH,
    model: process.env.WHISPER_MODEL_PATH,
  };
  try {
    await writeFile(audioPath, Buffer.from('RIFF0000WAVE'));
    const modelPath = path.join(directory, 'model.bin');
    await writeFile(modelPath, 'placeholder model file for missing executable test');
    delete process.env.WHISPER_CPP_PATH;
    delete process.env.WHISPER_MODEL_PATH;
    await assert.rejects(transcribeAudio(audioPath), (error) => error instanceof WhisperError && error.code === 'WHISPER_NOT_CONFIGURED');

    process.env.WHISPER_CPP_PATH = path.join(directory, 'missing-whisper-cli.exe');
    process.env.WHISPER_MODEL_PATH = modelPath;
    await assert.rejects(transcribeAudio(audioPath), (error) => error instanceof WhisperError && error.code === 'WHISPER_NOT_FOUND');

    process.env.WHISPER_CPP_PATH = modelPath;
    process.env.WHISPER_MODEL_PATH = path.join(directory, 'missing-model.bin');
    await assert.rejects(transcribeAudio(audioPath), (error) => error instanceof WhisperError && error.code === 'WHISPER_MODEL_NOT_FOUND');
  } finally {
    if (prior.executable === undefined) delete process.env.WHISPER_CPP_PATH;
    else process.env.WHISPER_CPP_PATH = prior.executable;
    if (prior.model === undefined) delete process.env.WHISPER_MODEL_PATH;
    else process.env.WHISPER_MODEL_PATH = prior.model;
    await rm(directory, { recursive: true, force: true });
  }
});

test('MP3 transcription fails clearly when FFmpeg is not configured', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'meeting-ffmpeg-test-'));
  const prior = {
    executable: process.env.WHISPER_CPP_PATH,
    model: process.env.WHISPER_MODEL_PATH,
    ffmpeg: process.env.FFMPEG_PATH,
  };
  try {
    const audioPath = path.join(directory, 'sample.mp3');
    const localFile = path.join(directory, 'placeholder.bin');
    await writeFile(audioPath, 'not decoded because the FFmpeg setup is intentionally absent');
    await writeFile(localFile, 'placeholder');
    process.env.WHISPER_CPP_PATH = localFile;
    process.env.WHISPER_MODEL_PATH = localFile;
    delete process.env.FFMPEG_PATH;
    await assert.rejects(transcribeAudio(audioPath), (error) => error instanceof WhisperError && error.code === 'FFMPEG_NOT_CONFIGURED');
  } finally {
    for (const [key, value] of Object.entries({
      WHISPER_CPP_PATH: prior.executable,
      WHISPER_MODEL_PATH: prior.model,
      FFMPEG_PATH: prior.ffmpeg,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
