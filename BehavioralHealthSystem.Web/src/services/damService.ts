/**
 * DAM (Depression & Anxiety Model) Service
 *
 * Provides a helper to submit audio files to the SK orchestration backend
 * (`/api/process-audio-upload`) and map the response into the same shape
 * that the UploadAnalyze page uses for analysis results.
 */

import { env } from '@/utils/env';
import type { PredictionResult } from '@/types';

// ── Types ────────────────────────────────────────────────────────────────────

/** Shape of `PredictionResponse` nested inside the pipeline result (snake_case from [JsonPropertyName]) */
interface DamPredictionResponse {
  session_id?: string;
  status?: string;
  predicted_score?: string;
  predicted_score_depression?: string;
  predicted_score_anxiety?: string;
  created_at?: string;
  updated_at?: string;
  provider?: string;
  model?: string;
  model_category?: string;
  model_granularity?: string;
  is_calibrated?: boolean;
}

/** Shape returned by `/api/process-audio-upload` (camelCase from JsonNamingPolicy.CamelCase) */
export interface DamPipelineResult {
  success: boolean;
  message: string;
  audioSource?: string;
  originalFileName?: string;
  originalFileSize?: number;
  convertedFileSize?: number;
  convertedSampleRate?: number;
  filtersApplied?: boolean;
  conversionElapsedMs?: number;
  sessionId?: string;
  provider?: string;
  predictionResponse?: DamPredictionResponse;
  totalElapsedMs?: number;
  startedAtUtc?: string;
  completedAtUtc?: string;
  userId?: string;
  error?: string | null;
  failedStep?: string | null;
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Submit an audio file to the DAM SK orchestration pipeline.
 *
 * @param file      The audio File to upload
 * @param userId    User / participant identifier
 * @param sessionId Session identifier (from initiateSession)
 * @returns         The raw `DamPipelineResult` from the backend
 */
export async function submitToDam(
  file: File,
  userId: string,
  sessionId: string,
): Promise<DamPipelineResult> {
  // Guard: ensure the file is a real File/Blob, not a mock object.
  // A plain object cast as File would be coerced to "[object Object]" by FormData,
  // producing a corrupt 15-byte upload that ffmpeg cannot parse.
  if (!(file instanceof Blob)) {
    throw new Error(
      'Invalid audio file: expected a File or Blob but received a plain object. ' +
      'Please re-select the audio file and try again.'
    );
  }

  if (file.size === 0) {
    throw new Error(
      'Invalid audio file: file is empty (0 bytes). ' +
      'Please re-select the audio file and try again.'
    );
  }

  const apiBaseUrl = env.API_BASE_URL;

  const formData = new FormData();
  formData.append('userId', userId);
  formData.append('sessionId', sessionId);
  formData.append('file', file);

  const response = await fetch(`${apiBaseUrl}/process-audio-upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`DAM pipeline request failed (${response.status}): ${text || response.statusText}`);
  }

  return response.json();
}

// ── Mapping ──────────────────────────────────────────────────────────────────

/**
 * Map a `DamPipelineResult` into the `PredictionResult` shape used by the frontend.
 *
 * This enables the Sessions, SessionDetail, and Predictions pages to render
 * DAM results in a consistent PredictionResult format.
 */
export function mapDamResultToPrediction(pipeline: DamPipelineResult): PredictionResult {
  const pred = pipeline.predictionResponse;
  const now = new Date().toISOString();

  return {
    sessionId: pipeline.sessionId ?? pred?.session_id ?? '',
    status: pipeline.success ? 'completed' : 'failed',

    // Scores — from PredictionResponse (snake_case)
    predicted_score_depression: pred?.predicted_score_depression,
    predicted_score_anxiety: pred?.predicted_score_anxiety,
    predicted_score: pred?.predicted_score,

    // Also populate camelCase variants so either accessor path works
    predictedScoreDepression: pred?.predicted_score_depression,
    predictedScoreAnxiety: pred?.predicted_score_anxiety,
    predictedScore: pred?.predicted_score,

    // Timestamps
    createdAt: pred?.created_at ?? now,
    updatedAt: pred?.updated_at ?? now,
    created_at: pred?.created_at ?? now,
    updated_at: pred?.updated_at ?? now,

    // Model metadata
    model: pred?.model,
    modelCategory: pred?.model_category,
    modelGranularity: pred?.model_granularity,
    isCalibrated: pred?.is_calibrated ?? false,
    model_category: pred?.model_category,
    model_granularity: pred?.model_granularity,
    is_calibrated: pred?.is_calibrated ?? false,
  };
}
