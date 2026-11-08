import axios from 'axios';

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 300_000;

export class AIServiceError extends Error {
  constructor(message, { status = 503, code = 'AI_SERVICE_ERROR', cause } = {}) {
    super(message, { cause });
    this.name = 'AIServiceError';
    this.status = status;
    this.code = code;
  }
}

function serviceBaseUrl() {
  return (process.env.PYTHON_AI_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
}

function requestTimeout() {
  const configured = Number(process.env.PYTHON_AI_TIMEOUT_MS);
  if (!Number.isFinite(configured) || configured < 1) return DEFAULT_TIMEOUT_MS;
  return Math.min(configured, MAX_TIMEOUT_MS);
}

function assertString(value, field, { optional = false } = {}) {
  if (optional && value == null) return;
  if (typeof value !== 'string' || !value.trim()) {
    throw new AIServiceError(`Invalid meeting analysis input: ${field} is required.`, { status: 400, code: 'INVALID_INPUT' });
  }
}

function validConfidence(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Validate the concrete FastAPI /analyze response and normalize its fields. */
export function normalizeAnalysisResponse(data) {
  const invalid = () => {
    throw new AIServiceError('Python analysis service returned an invalid response.', {
      status: 502,
      code: 'INVALID_AI_RESPONSE',
    });
  };
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.success !== true) invalid();
  if (!data.summary || typeof data.summary.text !== 'string' || !isStringArray(data.summary.key_points)) invalid();
  if (!data.entities || !['people', 'organizations', 'dates'].every((key) => isStringArray(data.entities[key]))) invalid();
  if (!Array.isArray(data.tasks) || !Array.isArray(data.decisions)) invalid();
  if (!data.analysis_metadata || !['total_sentences', 'tasks_found', 'decisions_found', 'processing_time_ms'].every(
    (key) => Number.isInteger(data.analysis_metadata[key]) && data.analysis_metadata[key] >= 0,
  ) || !isStringArray(data.analysis_metadata.warnings)) invalid();

  const tasks = data.tasks.map((task) => {
    if (!task || typeof task !== 'object' || typeof task.description !== 'string' || !task.description.trim()
      || typeof task.source_sentence !== 'string' || !task.source_sentence.trim()) invalid();
    if (task.status !== 'pending') invalid();
    if (task.action != null && typeof task.action !== 'string') invalid();
    if (task.responsible_person != null && typeof task.responsible_person !== 'string') invalid();
    if (task.priority != null && !['HIGH', 'MEDIUM', 'LOW'].includes(task.priority)) invalid();
    if (!validConfidence(task.confidence)) invalid();
    let deadline = null;
    if (task.deadline != null) {
      if (typeof task.deadline !== 'object' || typeof task.deadline.original_text !== 'string'
        || (task.deadline.normalized_date != null && !validDate(task.deadline.normalized_date))) invalid();
      deadline = {
        originalText: task.deadline.original_text,
        normalizedDate: task.deadline.normalized_date ?? null,
      };
    }
    if (task.warnings != null && !isStringArray(task.warnings)) invalid();
    return {
      description: task.description,
      action: task.action ?? undefined,
      responsiblePerson: task.responsible_person ?? null,
      deadline,
      priority: task.priority?.toLowerCase() ?? null,
      status: task.status,
      sourceSentence: task.source_sentence,
      confidence: task.confidence,
      warnings: task.warnings ?? [],
    };
  });

  const decisions = data.decisions.map((decision) => {
    if (!decision || typeof decision.description !== 'string' || !decision.description.trim()) invalid();
    if (decision.source_sentence != null && typeof decision.source_sentence !== 'string') invalid();
    if (decision.confidence != null && !validConfidence(decision.confidence)) invalid();
    return {
      description: decision.description,
      sourceSentence: decision.source_sentence ?? null,
      ...(decision.confidence == null ? {} : { confidence: decision.confidence }),
    };
  });

  return {
    summary: data.summary.text,
    keyPoints: data.summary.key_points,
    entities: {
      people: data.entities.people,
      organizations: data.entities.organizations,
      dates: data.entities.dates,
    },
    decisions,
    tasks,
    analysisMetadata: {
      totalSentences: data.analysis_metadata.total_sentences,
      tasksFound: data.analysis_metadata.tasks_found,
      decisionsFound: data.analysis_metadata.decisions_found,
      processingTimeMs: data.analysis_metadata.processing_time_ms,
      warnings: data.analysis_metadata.warnings,
    },
  };
}

/** Send a meeting transcript to the local FastAPI analysis service. */
export async function analyzeMeeting({ meetingTitle, meetingDate, transcript }) {
  assertString(meetingTitle, 'meetingTitle', { optional: true });
  assertString(transcript, 'transcript');
  if ((meetingDate instanceof Date && Number.isNaN(meetingDate.valueOf()))
    || (!(meetingDate instanceof Date) && !validDate(meetingDate))) {
    throw new AIServiceError('Invalid meeting analysis input: meetingDate must be a valid YYYY-MM-DD date.', {
      status: 400,
      code: 'INVALID_INPUT',
    });
  }
  const isoDate = meetingDate instanceof Date ? meetingDate.toISOString().slice(0, 10) : meetingDate;

  try {
    const response = await axios.post(`${serviceBaseUrl()}/analyze`, {
      meeting_title: meetingTitle ?? null,
      meeting_date: isoDate,
      transcript,
    }, {
      timeout: requestTimeout(),
      headers: { 'Content-Type': 'application/json' },
      transitional: { clarifyTimeoutError: true },
    });
    return normalizeAnalysisResponse(response.data);
  } catch (error) {
    if (error instanceof AIServiceError) throw error;
    if (axios.isAxiosError(error)) {
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        throw new AIServiceError('Python analysis service timed out.', { status: 504, code: 'AI_TIMEOUT', cause: error });
      }
      if (error.response) {
        if (error.response.status === 422) {
          throw new AIServiceError('Python analysis service rejected the transcript.', { status: 422, code: 'AI_INVALID_TRANSCRIPT', cause: error });
        }
        throw new AIServiceError('Python analysis service returned an error.', {
          status: error.response.status === 503 ? 503 : 502,
          code: 'AI_UPSTREAM_ERROR',
          cause: error,
        });
      }
      throw new AIServiceError('Python analysis service is unavailable.', { status: 503, code: 'AI_UNAVAILABLE', cause: error });
    }
    throw new AIServiceError('Python analysis service returned an invalid response.', {
      status: 502,
      code: 'INVALID_AI_RESPONSE',
      cause: error,
    });
  }
}

/** Check local FastAPI health with a short bounded timeout. */
export async function checkAIHealth() {
  try {
    const response = await axios.get(`${serviceBaseUrl()}/health`, { timeout: 3000 });
    return response.status === 200
      && response.data?.status === 'healthy'
      && response.data?.service === 'meeting-analysis-engine';
  } catch {
    return false;
  }
}
