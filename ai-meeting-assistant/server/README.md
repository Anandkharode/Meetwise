# Meeting Action API: Python Analysis Integration

## Local audio transcription (Whisper.cpp)

Audio uploads use local disk storage under `server/uploads/meetings/`. MongoDB stores metadata only. Node starts Whisper.cpp with an argument array and `shell: false`; it reads recognized text from Whisper's `.txt` output file rather than mixing stdout/stderr diagnostics into the transcript. MP3 and M4A inputs are converted by local FFmpeg to temporary 16 kHz mono PCM WAV files. Temporary conversion and transcript files are removed after success or failure; the original uploaded audio is preserved until its meeting is deleted. The default transcription concurrency is one.

This machine is configured with the MSVC CPU executable at `C:/AI-Tools/whisper.cpp/build-msvc/bin/Release/whisper-cli.exe`, the Base model at `C:/AI-Tools/whisper.cpp/ggml-base.bin`, and FFmpeg 9.0.2. Whisper is forced to English with `-l en`, defaults to transcription mode (the translation flag is not passed), and uses `WHISPER_THREADS` for CPU threads. The JFK WAV, MP3, and M4A samples transcribed through the Node service to: `And so my fellow Americans, ask not what your country can do for you, ask what you can do for your country.` The complete authenticated HTTP upload could not be verified because MongoDB Atlas rejected the current network as not IP-whitelisted.

### Install Whisper.cpp on Windows

Install Git, CMake, and Visual Studio Build Tools with the C++ workload. Then build the official CPU version and download the Tiny model (a smaller starting point for an 8 GB machine):

```powershell
cd C:\path\where\you\keep\tools
git clone https://github.com/ggml-org/whisper.cpp.git
cd whisper.cpp
cmake -B build
cmake --build build --config Release -j
.\models\download-ggml-model.cmd tiny
```

The executable is commonly produced at `build\bin\Release\whisper-cli.exe`; verify its actual location after building. Test it against the repository's included sample WAV before connecting the API:

```powershell
.\build\bin\Release\whisper-cli.exe -m .\models\ggml-tiny.bin -f .\samples\jfk.wav
```

The official project documents Windows support, model download scripts, and CLI usage in its [README](https://github.com/ggml-org/whisper.cpp/blob/master/README.md). WAV uploads are checked for a RIFF/WAVE header. MP3/M4A content is signature checked by the upload middleware and then decoded by FFmpeg; malformed or unsupported audio produces a conversion error.

Add actual absolute paths to `server/.env` (do not commit `.env`):

```ini
MAX_AUDIO_UPLOAD_BYTES=104857600
WHISPER_CPP_PATH=C:/AI-Tools/whisper.cpp/build-msvc/bin/Release/whisper-cli.exe
WHISPER_MODEL_PATH=C:/AI-Tools/whisper.cpp/ggml-base.bin
FFMPEG_PATH=C:/path/to/ffmpeg.exe
WHISPER_TIMEOUT_MS=1800000
WHISPER_CONCURRENCY=1
WHISPER_THREADS=4
```

All WAV, MP3, and M4A files are converted to temporary 16 kHz mono PCM WAV before transcription. `WHISPER_THREADS` defaults to 4 and is capped at 64. `WHISPER_TIMEOUT_MS` is milliseconds. Restart Node after editing `.env`.

### Upload with Postman

Send `POST http://localhost:5000/api/meetings/upload-audio` with `Authorization: Bearer <JWT>` and Body → `form-data`:

| Key | Type | Example |
| --- | --- | --- |
| `title` | Text | `Project Development Meeting` |
| `meetingDate` | Text | `2026-11-08` |
| `audio` | File | select a WAV, MP3, or M4A audio file |

On success, the response contains the saved meeting, actual transcription text, summary, decisions, and separately stored tasks. Absolute filesystem paths are never included. If the Whisper executable/model is not configured or fails, the API returns a sanitized error and the meeting is marked `failed`; it does not call Python after transcription failure. If Python analysis fails, the real transcript remains saved and the meeting is marked `failed`.

Deleting a meeting removes its associated audio file after the meeting/task database deletion succeeds. Uploads that fail validation or cannot be persisted are removed. Audio retained for a persisted failed meeting remains available for diagnosis and can be removed by deleting that meeting.

## Services

Run the Python NLP/ML engine from `ai-engine`:

```powershell
cd ..\ai-engine
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In another terminal, run the Node API from `server`:

```powershell
cd ..\server
npm run dev
```

The Node service calls `POST ${PYTHON_AI_URL}/analyze` with the meeting title, ISO meeting date, and transcript. It validates and maps the FastAPI snake_case response to the MongoDB camelCase fields. Set `PYTHON_AI_URL` and `PYTHON_AI_TIMEOUT_MS` in `.env`; the default analysis timeout is 120 seconds. `GET /api/ai/health` checks the separate Python health endpoint with a three-second timeout.

## Analyze an owned meeting

```http
POST http://localhost:5000/api/meetings/<MEETING_ID>/analyze
Authorization: Bearer <JWT>
Content-Type: application/json
```

First analysis requires no body. A completed meeting requires an explicit reanalysis request:

```json
{"reanalyze": true}
```

AI-generated tasks are marked with `origin: "ai"`, `isManuallyEdited: false`, and associated with the analysis run. Reanalysis replaces unedited generated tasks. Manually created tasks (`origin: "manual"`) and generated tasks marked `isManuallyEdited: true` are preserved by default. Task edit handlers should set that marker when a user changes an AI task. To explicitly replace all tasks, send `{"reanalyze": true, "replaceManualTasks": true}`. Python task IDs are discarded; MongoDB creates persisted IDs.

The meeting is atomically claimed as `processing`, then analysis results and generated tasks are written in an Atlas transaction. If transactions are unsupported, the service uses a rollback-aware ordered replacement. Upstream failures mark the current run `failed` and store a sanitized message. A processing claim includes a run ID and start time; claims older than `ANALYSIS_STALE_AFTER_MS` (default 15 minutes, minimum 1 minute) can be reclaimed. Run IDs stop an old worker from committing after another worker has reclaimed its stale run.

## Task management

All task routes require `Authorization: Bearer <JWT>` and only operate on the authenticated user's documents:

- `GET /api/tasks?page=1&limit=10` lists tasks. Optional filters: `status`, `priority`, `meetingId`, `responsiblePerson`, `origin`.
- `GET /api/tasks/stats` returns totals, overdue count, and tasks without deadlines.
- `GET /api/tasks/:id` returns a task and its meeting title/date.
- `PATCH /api/tasks/:id` accepts only `description`, `responsiblePerson`, `deadline.originalText`, `deadline.normalizedDate`, `priority`, and `status`.
- `DELETE /api/tasks/:id` deletes that task only.

For example, update a task with `PATCH /api/tasks/<TASK_ID>` and JSON `{"status":"in_progress","priority":"high","deadline":{"originalText":"by Thursday","normalizedDate":"2026-11-12"}}`. If an AI-generated task is edited, it is marked `isManuallyEdited: true`; later meeting reanalysis preserves that task by default.

## Checks

Run unit and mocked integration tests:

```powershell
npm test
```

With the Python service running, execute the real Node-to-FastAPI integration test:

```powershell
$env:RUN_PYTHON_AI_E2E = '1'
npm test
Remove-Item Env:RUN_PYTHON_AI_E2E
```

With both local services configured and Atlas reachable, the isolated Atlas test creates a temporary user and meeting, verifies persistence and reanalysis, and removes only its temporary records:

```powershell
$env:RUN_ATLAS_AI_E2E = '1'
npm test
Remove-Item Env:RUN_ATLAS_AI_E2E
```

The Atlas test uses `server/.env` and requires Atlas network access. It does not use existing user or meeting records.

The real audio upload integration test requires Atlas access, the local Python service, Whisper.cpp, FFmpeg, and a real WAV sample. It creates a temporary user and meeting, checks actual saved transcript/tasks and audio-file cleanup, and removes those records:

```powershell
$env:RUN_AUDIO_E2E = '1'
$env:WHISPER_SAMPLE_PATH = 'C:/AI-Tools/whisper.cpp/samples/jfk.wav'
node --test tests/audioUploadE2E.test.js
Remove-Item Env:RUN_AUDIO_E2E
Remove-Item Env:WHISPER_SAMPLE_PATH
```
