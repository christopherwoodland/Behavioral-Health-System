import React, { useState, useCallback, useRef } from 'react';
import {
  Play,
  AlertCircle,
  CheckCircle,
  Loader2,
  Server,
  FolderOpen,
  Cloud,
  Clock,
  FileAudio,
  Activity,
  ChevronDown,
  ChevronUp,
  Copy,
  RefreshCw,
  Upload,
  Wand2,
  Download,
} from 'lucide-react';
import { config } from '@/config/constants';

// ── Types ────────────────────────────────────────────────────────────────────

interface PipelineRequest {
  userId: string;
  sessionId: string;
  fileName?: string;
  filePath?: string;
}

interface PredictionResponse {
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
  actual_score?: string | null;
  predict_error?: string | null;
}

interface PipelineResult {
  success: boolean;
  message: string;
  audioSource?: string;
  sourceBlobPath?: string;
  sourceLocalPath?: string;
  originalFileName?: string;
  originalFileSize?: number;
  convertedFileSize?: number;
  convertedSampleRate?: number;
  filtersApplied?: boolean;
  conversionElapsedMs?: number;
  sessionId?: string;
  provider?: string;
  predictionResponse?: PredictionResponse;
  totalElapsedMs?: number;
  startedAtUtc?: string;
  completedAtUtc?: string;
  userId?: string;
  error?: string | null;
  failedStep?: string | null;
}

interface DamHealthStatus {
  status: string;
  model_loaded?: boolean;
  model_name?: string;
  [key: string]: unknown;
}

type WorkflowMode = 'blob' | 'local' | 'upload' | 'convert';

interface ConvertResult {
  audioUrl: string;
  originalFileName: string;
  originalFileSize: number;
  convertedFileSize: number;
  convertedSampleRate: number;
  filtersApplied: boolean;
  conversionElapsedMs: number;
}
type RunStatus = 'idle' | 'running' | 'success' | 'error';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function scoreColor(score: string | undefined | null): string {
  if (!score) return 'text-gray-500 dark:text-gray-400';
  const n = parseFloat(score);
  if (n >= 0.7) return 'text-error-600 dark:text-error-400';
  if (n >= 0.4) return 'text-warning-600 dark:text-warning-400';
  return 'text-success-600 dark:text-success-400';
}

// ── Component ────────────────────────────────────────────────────────────────

const DamTestBench: React.FC = () => {
  // Form state
  const [mode, setMode] = useState<WorkflowMode>('blob');
  const [userId, setUserId] = useState('test-user-001');
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID() as string);
  const [fileName, setFileName] = useState('');
  const [filePath, setFilePath] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Convert-only state
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);

  // Execution state
  const [status, setStatus] = useState<RunStatus>('idle');
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedDisplay, setElapsedDisplay] = useState<string | null>(null);

  // DAM health
  const [damHealth, setDamHealth] = useState<DamHealthStatus | null>(null);
  const [damHealthLoading, setDamHealthLoading] = useState(false);
  const [damHealthError, setDamHealthError] = useState<string | null>(null);

  // History
  const [history, setHistory] = useState<Array<{ id: string; mode: WorkflowMode; result: PipelineResult; ts: Date }>>([]);
  const [expandedRaw, setExpandedRaw] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiBaseUrl = config.api.baseUrl.endsWith('/')
    ? config.api.baseUrl.slice(0, -1)
    : config.api.baseUrl;

  // ── DAM Health Check ────────────────────────────────────────────────────

  const checkDamHealth = useCallback(async () => {
    setDamHealthLoading(true);
    setDamHealthError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/dam-health`, { method: 'GET' });
      if (!res.ok) {
        // Try direct DAM endpoint (for local dev)
        const directRes = await fetch('http://localhost:8000/health', { method: 'GET' });
        if (!directRes.ok) throw new Error(`DAM health check failed: ${directRes.status}`);
        setDamHealth(await directRes.json());
      } else {
        setDamHealth(await res.json());
      }
    } catch (err) {
      setDamHealthError(err instanceof Error ? err.message : 'Failed to reach DAM service');
    } finally {
      setDamHealthLoading(false);
    }
  }, [apiBaseUrl]);

  // ── Run Convert Only ────────────────────────────────────────────────────

  const runConvertOnly = useCallback(async () => {
    setStatus('running');
    setResult(null);
    setConvertResult(null);
    setError(null);

    const startTime = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedDisplay(formatMs(Date.now() - startTime));
    }, 100);

    abortRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append('file', selectedFile!);

      const res = await fetch(`${apiBaseUrl}/convert-audio`, {
        method: 'POST',
        body: formData,
        signal: abortRef.current.signal,
      });

      if (timerRef.current) clearInterval(timerRef.current);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        setStatus('error');
        setError(errData.message || `Conversion failed: ${res.status}`);
        setElapsedDisplay(formatMs(Date.now() - startTime));
        return;
      }

      const blob = await res.blob();
      // Revoke previous URL if any
      if (convertResult?.audioUrl) URL.revokeObjectURL(convertResult.audioUrl);
      const audioUrl = URL.createObjectURL(blob);

      const elapsed = parseFloat(res.headers.get('X-Conversion-ElapsedMs') ?? '0');
      setElapsedDisplay(elapsed > 0 ? formatMs(elapsed) : formatMs(Date.now() - startTime));

      const cr: ConvertResult = {
        audioUrl,
        originalFileName: res.headers.get('X-Original-FileName') ?? selectedFile!.name,
        originalFileSize: parseInt(res.headers.get('X-Original-FileSize') ?? '0', 10),
        convertedFileSize: parseInt(res.headers.get('X-Converted-FileSize') ?? '0', 10),
        convertedSampleRate: parseInt(res.headers.get('X-Converted-SampleRate') ?? '0', 10),
        filtersApplied: res.headers.get('X-Filters-Applied') === 'True',
        conversionElapsedMs: elapsed,
      };
      setConvertResult(cr);
      setStatus('success');
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      if ((err as Error).name === 'AbortError') {
        setStatus('idle');
        setError(null);
      } else {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Unexpected error');
      }
    }
  }, [selectedFile, apiBaseUrl, convertResult?.audioUrl]);

  // ── Run Pipeline ────────────────────────────────────────────────────────

  const runPipeline = useCallback(async () => {
    if (mode === 'convert') {
      return runConvertOnly();
    }

    setStatus('running');
    setResult(null);
    setConvertResult(null);
    setError(null);

    const startTime = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedDisplay(formatMs(Date.now() - startTime));
    }, 100);

    abortRef.current = new AbortController();

    try {
      let res: Response;

      if (mode === 'upload') {
        const formData = new FormData();
        formData.append('userId', userId);
        formData.append('sessionId', sessionId);
        formData.append('file', selectedFile!);

        res = await fetch(`${apiBaseUrl}/process-audio-upload`, {
          method: 'POST',
          body: formData,
          signal: abortRef.current.signal,
        });
      } else {
        const endpoint = mode === 'blob' ? '/process-audio' : '/process-audio-local';
        const body: PipelineRequest =
          mode === 'blob'
            ? { userId, sessionId, ...(fileName ? { fileName } : {}) }
            : { userId, sessionId, ...(filePath ? { filePath } : {}) };

        res = await fetch(`${apiBaseUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: abortRef.current.signal,
        });
      }

      const data: PipelineResult = await res.json();

      if (timerRef.current) clearInterval(timerRef.current);
      setElapsedDisplay(data.totalElapsedMs ? formatMs(data.totalElapsedMs) : formatMs(Date.now() - startTime));

      if (data.success) {
        setStatus('success');
        setResult(data);
        setHistory((prev) => [
          { id: crypto.randomUUID(), mode, result: data, ts: new Date() },
          ...prev.slice(0, 19),
        ]);
      } else {
        setStatus('error');
        setResult(data);
        setError(data.message || 'Pipeline failed');
      }
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      if ((err as Error).name === 'AbortError') {
        setStatus('idle');
        setError(null);
      } else {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Unexpected error');
      }
    }
  }, [mode, userId, sessionId, fileName, filePath, selectedFile, apiBaseUrl, runConvertOnly]);

  const cancelPipeline = useCallback(() => {
    abortRef.current?.abort();
    if (timerRef.current) clearInterval(timerRef.current);
    setStatus('idle');
  }, []);

  const resetForm = useCallback(() => {
    setSessionId(crypto.randomUUID());
    setFileName('');
    setFilePath('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    // Revoke audio URL if present
    if (convertResult?.audioUrl) URL.revokeObjectURL(convertResult.audioUrl);
    setConvertResult(null);
    setResult(null);
    setError(null);
    setStatus('idle');
    setElapsedDisplay(null);
  }, []);

  const copyJson = useCallback(() => {
    if (result) navigator.clipboard.writeText(JSON.stringify(result, null, 2));
  }, [result]);

  const isFormValid =
    (mode === 'convert'
      ? selectedFile !== null
      : userId.trim() !== '' &&
        sessionId.trim() !== '' &&
        (mode !== 'upload' || selectedFile !== null));

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-100 dark:bg-accent-900">
          <Activity className="w-6 h-6 text-accent-600 dark:text-accent-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            DAM Pipeline Test Bench
          </h1>
          <p className="text-sm text-text-muted-light dark:text-text-muted-dark">
            Test the Semantic Kernel audio processing workflows — blob, local directory, file upload, or convert only
          </p>
        </div>
      </div>

      {/* DAM Health Card */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-text-muted-light dark:text-text-muted-dark" />
            <span className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              DAM Model Health
            </span>
            {damHealth && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  damHealth.model_loaded
                    ? 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300'
                    : 'bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300'
                }`}
              >
                {damHealth.model_loaded ? 'Loaded' : 'Not loaded'}
              </span>
            )}
          </div>
          <button
            onClick={checkDamHealth}
            disabled={damHealthLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
              bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
              text-text-primary-light dark:text-text-primary-dark transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {damHealthLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Check
          </button>
        </div>
        {damHealthError && (
          <p className="mt-2 text-xs text-error-600 dark:text-error-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {damHealthError}
          </p>
        )}
        {damHealth && !damHealthError && (
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-text-muted-light dark:text-text-muted-dark">
            <div>
              <span className="font-medium">Status:</span> {damHealth.status}
            </div>
            {damHealth.model_name && (
              <div className="col-span-2">
                <span className="font-medium">Model:</span> {damHealth.model_name}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workflow Mode Selector */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark p-5 space-y-4">
        <h2 className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
          Audio Source
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => setMode('blob')}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
              mode === 'blob'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Cloud
              className={`w-5 h-5 ${
                mode === 'blob' ? 'text-primary-600 dark:text-primary-400' : 'text-text-muted-light dark:text-text-muted-dark'
              }`}
            />
            <div className="text-left">
              <div
                className={`text-sm font-medium ${
                  mode === 'blob'
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-text-primary-light dark:text-text-primary-dark'
                }`}
              >
                Azure Blob Storage
              </div>
              <div className="text-xs text-text-muted-light dark:text-text-muted-dark">
                Fetch from <code className="px-1 rounded bg-gray-100 dark:bg-gray-800">audio-uploads</code> container
              </div>
            </div>
          </button>
          <button
            onClick={() => setMode('local')}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
              mode === 'local'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <FolderOpen
              className={`w-5 h-5 ${
                mode === 'local'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-text-muted-light dark:text-text-muted-dark'
              }`}
            />
            <div className="text-left">
              <div
                className={`text-sm font-medium ${
                  mode === 'local'
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-text-primary-light dark:text-text-primary-dark'
                }`}
              >
                Local Directory
              </div>
              <div className="text-xs text-text-muted-light dark:text-text-muted-dark">
                Read from <code className="px-1 rounded bg-gray-100 dark:bg-gray-800">./recordings</code> or custom path
              </div>
            </div>
          </button>
          <button
            onClick={() => setMode('upload')}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
              mode === 'upload'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Upload
              className={`w-5 h-5 ${
                mode === 'upload'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-text-muted-light dark:text-text-muted-dark'
              }`}
            />
            <div className="text-left">
              <div
                className={`text-sm font-medium ${
                  mode === 'upload'
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-text-primary-light dark:text-text-primary-dark'
                }`}
              >
                File Upload
              </div>
              <div className="text-xs text-text-muted-light dark:text-text-muted-dark">
                Pick an audio file from your machine
              </div>
            </div>
          </button>
          <button
            onClick={() => setMode('convert')}
            className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
              mode === 'convert'
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Wand2
              className={`w-5 h-5 ${
                mode === 'convert'
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-text-muted-light dark:text-text-muted-dark'
              }`}
            />
            <div className="text-left">
              <div
                className={`text-sm font-medium ${
                  mode === 'convert'
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-text-primary-light dark:text-text-primary-dark'
                }`}
              >
                Convert Only
              </div>
              <div className="text-xs text-text-muted-light dark:text-text-muted-dark">
                FFmpeg cleanup only — play cleaned audio
              </div>
            </div>
          </button>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {mode !== 'convert' && (
            <>
              <div>
                <label className="block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1">
                  User ID <span className="text-error-500">*</span>
                </label>
                <input
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="test-user-001"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                    bg-background-light dark:bg-background-dark
                    text-text-primary-light dark:text-text-primary-dark
                    focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                />
              </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1">
              Session ID <span className="text-error-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="auto-generated UUID"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                  bg-background-light dark:bg-background-dark
                  text-text-primary-light dark:text-text-primary-dark
                  focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              />
              <button
                onClick={() => setSessionId(crypto.randomUUID())}
                title="Generate new UUID"
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                  hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4 text-text-muted-light dark:text-text-muted-dark" />
              </button>
            </div>
          </div>
          </>) /* end mode !== 'convert' */}

          {/* Conditional field based on mode */}
          {mode === 'blob' && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1">
                Blob File Name{' '}
                <span className="text-text-muted-light dark:text-text-muted-dark font-normal">(optional — blank = most recent)</span>
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="e.g. recording.wav"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                  bg-background-light dark:bg-background-dark
                  text-text-primary-light dark:text-text-primary-dark
                  focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          )}
          {mode === 'local' && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1">
                File Path{' '}
                <span className="text-text-muted-light dark:text-text-muted-dark font-normal">
                  (optional — blank = most recent in recordings dir)
                </span>
              </label>
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="e.g. C:/recordings/audio.wav  or  audio.wav"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                  bg-background-light dark:bg-background-dark
                  text-text-primary-light dark:text-text-primary-dark
                  focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
              />
            </div>
          )}
          {mode === 'upload' && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1">
                Audio File <span className="text-error-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.webm"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                    border border-gray-300 dark:border-gray-600
                    bg-background-light dark:bg-background-dark
                    text-text-primary-light dark:text-text-primary-dark
                    hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Browse…
                </button>
                {selectedFile ? (
                  <span className="text-sm text-text-primary-light dark:text-text-primary-dark truncate max-w-md">
                    {selectedFile.name}{' '}
                    <span className="text-text-muted-light dark:text-text-muted-dark">
                      ({formatBytes(selectedFile.size)})
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-text-muted-light dark:text-text-muted-dark">
                    No file selected
                  </span>
                )}
              </div>
            </div>
          )}
          {(mode === 'convert') && (
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1">
                Audio File <span className="text-error-500">*</span>
                <span className="text-text-muted-light dark:text-text-muted-dark font-normal ml-1">
                  (will be cleaned via ffmpeg — no DAM prediction)
                </span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.webm"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                    border border-gray-300 dark:border-gray-600
                    bg-background-light dark:bg-background-dark
                    text-text-primary-light dark:text-text-primary-dark
                    hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Wand2 className="w-4 h-4" />
                  Browse…
                </button>
                {selectedFile ? (
                  <span className="text-sm text-text-primary-light dark:text-text-primary-dark truncate max-w-md">
                    {selectedFile.name}{' '}
                    <span className="text-text-muted-light dark:text-text-muted-dark">
                      ({formatBytes(selectedFile.size)})
                    </span>
                  </span>
                ) : (
                  <span className="text-sm text-text-muted-light dark:text-text-muted-dark">
                    No file selected
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          {status !== 'running' ? (
            <button
              onClick={runPipeline}
              disabled={!isFormValid}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg
                bg-primary-600 hover:bg-primary-700 text-white
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              <Play className="w-4 h-4" />
              Run {mode === 'blob' ? 'Blob' : mode === 'local' ? 'Local' : mode === 'upload' ? 'Upload' : 'Convert'} Pipeline
            </button>
          ) : (
            <button
              onClick={cancelPipeline}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg
                bg-error-600 hover:bg-error-700 text-white transition-colors shadow-sm"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Cancel
            </button>
          )}
          <button
            onClick={resetForm}
            disabled={status === 'running'}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg
              border border-gray-300 dark:border-gray-600
              text-text-primary-light dark:text-text-primary-dark
              hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>

          {status === 'running' && elapsedDisplay && (
            <span className="text-xs text-text-muted-light dark:text-text-muted-dark flex items-center gap-1">
              <Clock className="w-3 h-3" /> {elapsedDisplay}
            </span>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && status === 'error' && (
        <div className="rounded-xl border border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/20 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-error-600 dark:text-error-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-error-700 dark:text-error-300">Pipeline Failed</p>
            <p className="text-sm text-error-600 dark:text-error-400 mt-1">{error}</p>
            {result?.failedStep && (
              <p className="text-xs text-error-500 dark:text-error-500 mt-1">
                Failed at step: <span className="font-mono">{result.failedStep}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Convert-Only Result Card */}
      {convertResult && status === 'success' && mode === 'convert' && (
        <div className="rounded-xl border border-primary-300 dark:border-primary-700 bg-surface-light dark:bg-surface-dark overflow-hidden">
          {/* Header bar */}
          <div className="bg-primary-50 dark:bg-primary-900/20 px-5 py-3 flex items-center justify-between border-b border-primary-200 dark:border-primary-800">
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                Audio Conversion Complete
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-text-muted-light dark:text-text-muted-dark">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {convertResult.conversionElapsedMs ? formatMs(convertResult.conversionElapsedMs) : '—'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 font-medium text-primary-700 dark:text-primary-300">
                Convert Only
              </span>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Audio Player */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark mb-3">
                Cleaned Audio Playback
              </h3>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
                <audio
                  src={convertResult.audioUrl}
                  controls
                  className="w-full mb-3"
                />
                <div className="flex items-center gap-3">
                  <a
                    href={convertResult.audioUrl}
                    download={`converted-${convertResult.originalFileName}`}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg
                      bg-primary-600 hover:bg-primary-700 text-white transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download Converted WAV
                  </a>
                  <span className="text-xs text-text-muted-light dark:text-text-muted-dark">
                    {formatBytes(convertResult.convertedFileSize)}
                  </span>
                </div>
              </div>
            </div>

            {/* Conversion Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark mb-3">
                Conversion Details
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <DetailItem
                  label="Original File"
                  value={convertResult.originalFileName}
                  sub={formatBytes(convertResult.originalFileSize)}
                />
                <DetailItem
                  label="Converted Size"
                  value={formatBytes(convertResult.convertedFileSize)}
                  sub={convertResult.originalFileSize && convertResult.convertedFileSize
                    ? `${((1 - convertResult.convertedFileSize / convertResult.originalFileSize) * 100).toFixed(1)}% ${convertResult.convertedFileSize < convertResult.originalFileSize ? 'smaller' : 'larger'}`
                    : undefined}
                />
                <DetailItem
                  label="Sample Rate"
                  value={convertResult.convertedSampleRate ? `${convertResult.convertedSampleRate} Hz` : '—'}
                />
                <DetailItem
                  label="Filters Applied"
                  value={convertResult.filtersApplied ? 'Yes' : 'No'}
                  sub={convertResult.filtersApplied ? 'highpass, lowpass, silence' : 'clean passthrough'}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Card */}
      {result && result.success && (
        <div className="rounded-xl border border-success-300 dark:border-success-700 bg-surface-light dark:bg-surface-dark overflow-hidden">
          {/* Header bar */}
          <div className="bg-success-50 dark:bg-success-900/20 px-5 py-3 flex items-center justify-between border-b border-success-200 dark:border-success-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" />
              <span className="text-sm font-semibold text-success-700 dark:text-success-300">
                Pipeline Completed
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-text-muted-light dark:text-text-muted-dark">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {result.totalElapsedMs ? formatMs(result.totalElapsedMs) : '—'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 font-medium">
                {result.audioSource === 'local' ? 'Local' : result.audioSource === 'upload' ? 'Upload' : 'Blob'}
              </span>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {/* Prediction Scores */}
            {result.predictionResponse && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark mb-3">
                  DAM Prediction Scores
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <ScoreCard
                    label="Overall"
                    value={result.predictionResponse.predicted_score}
                    icon={<Activity className="w-4 h-4" />}
                  />
                  <ScoreCard
                    label="Depression"
                    value={result.predictionResponse.predicted_score_depression}
                    icon={<Activity className="w-4 h-4" />}
                  />
                  <ScoreCard
                    label="Anxiety"
                    value={result.predictionResponse.predicted_score_anxiety}
                    icon={<Activity className="w-4 h-4" />}
                  />
                </div>
              </div>
            )}

            {/* Pipeline Details */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted-light dark:text-text-muted-dark mb-3">
                Pipeline Details
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <DetailItem label="Source" value={result.audioSource ?? '—'} />
                <DetailItem
                  label="Original File"
                  value={result.originalFileName ?? '—'}
                  sub={result.originalFileSize ? formatBytes(result.originalFileSize) : undefined}
                />
                <DetailItem
                  label="Converted"
                  value={result.convertedSampleRate ? `${result.convertedSampleRate} Hz` : '—'}
                  sub={result.convertedFileSize ? formatBytes(result.convertedFileSize) : undefined}
                />
                <DetailItem
                  label="Conversion Time"
                  value={result.conversionElapsedMs ? formatMs(result.conversionElapsedMs) : '—'}
                  sub={result.filtersApplied ? 'filters applied' : 'no filters'}
                />
                <DetailItem label="Provider" value={result.provider ?? '—'} />
                <DetailItem label="Session" value={result.sessionId ?? '—'} />
                <DetailItem label="User" value={result.userId ?? '—'} />
                <DetailItem
                  label="Prediction Status"
                  value={result.predictionResponse?.status ?? '—'}
                />
                {result.sourceBlobPath && (
                  <DetailItem label="Blob Path" value={result.sourceBlobPath} className="sm:col-span-2" />
                )}
                {result.sourceLocalPath && (
                  <DetailItem label="Local Path" value={result.sourceLocalPath} className="sm:col-span-2" />
                )}
              </div>
            </div>

            {/* Raw JSON */}
            <div>
              <button
                onClick={() => setExpandedRaw(!expandedRaw)}
                className="flex items-center gap-1.5 text-xs font-medium text-text-muted-light dark:text-text-muted-dark
                  hover:text-text-primary-light dark:hover:text-text-primary-dark transition-colors"
              >
                {expandedRaw ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Raw JSON Response
              </button>
              {expandedRaw && (
                <div className="mt-2 relative">
                  <button
                    onClick={copyJson}
                    className="absolute top-2 right-2 p-1.5 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    title="Copy JSON"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                  <pre className="text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 overflow-x-auto max-h-96">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-surface-dark p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
              <FileAudio className="w-4 h-4" />
              Run History
            </h2>
            <button
              onClick={() => setHistory([])}
              className="text-xs text-text-muted-light dark:text-text-muted-dark hover:text-error-500 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {history.map((entry) => (
              <div key={entry.id} className="py-2.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  {entry.result.success ? (
                    <CheckCircle className="w-4 h-4 text-success-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-error-500" />
                  )}
                  <span className="text-text-primary-light dark:text-text-primary-dark font-medium">
                    {entry.result.originalFileName ?? 'Unknown'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-text-muted-light dark:text-text-muted-dark">
                    {entry.mode}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted-light dark:text-text-muted-dark">
                  {entry.result.predictionResponse?.predicted_score && (
                    <span className={scoreColor(entry.result.predictionResponse.predicted_score)}>
                      Score: {parseFloat(entry.result.predictionResponse.predicted_score).toFixed(3)}
                    </span>
                  )}
                  <span>{entry.result.totalElapsedMs ? formatMs(entry.result.totalElapsedMs) : '—'}</span>
                  <span>{entry.ts.toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer note */}
      <p className="text-xs text-text-muted-light dark:text-text-muted-dark text-center">
        This page is not linked in navigation. Access via{' '}
        <code className="px-1 rounded bg-gray-100 dark:bg-gray-800">/dam-test</code> only.
      </p>
    </div>
  );
};

// ── Sub-components ───────────────────────────────────────────────────────────

const ScoreCard: React.FC<{ label: string; value?: string | null; icon: React.ReactNode }> = ({
  label,
  value,
  icon,
}) => {
  const display = value ? parseFloat(value).toFixed(4) : '—';
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 text-center">
      <div className="flex items-center justify-center gap-1.5 text-xs text-text-muted-light dark:text-text-muted-dark mb-2">
        {icon}
        {label}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${scoreColor(value)}`}>{display}</div>
    </div>
  );
};

const DetailItem: React.FC<{ label: string; value: string; sub?: string; className?: string }> = ({
  label,
  value,
  sub,
  className = '',
}) => (
  <div className={className}>
    <dt className="text-xs text-text-muted-light dark:text-text-muted-dark">{label}</dt>
    <dd className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate" title={value}>
      {value}
    </dd>
    {sub && <dd className="text-xs text-text-muted-light dark:text-text-muted-dark">{sub}</dd>}
  </div>
);

export default DamTestBench;
