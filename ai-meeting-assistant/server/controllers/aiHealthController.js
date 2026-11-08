import { checkAIHealth } from '../services/ai/meetingAnalysisService.js';

/** Report local Python AI service reachability without returning internals. */
export async function aiHealth(_req, res) {
  const reachable = await checkAIHealth();
  return res.status(reachable ? 200 : 503).json({
    status: reachable ? 'healthy' : 'unavailable',
    service: 'python-ai-engine',
  });
}
