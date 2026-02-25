import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { config } from '@/config/constants';
import { createAppError } from '@/utils';
import type { AudioConversionOptions, SilenceRemovalOptions } from '@/types';
// import type { AppError } from '@/types'; // Commented out until used

export interface ConversionProgress {
  stage: 'loading' | 'converting' | 'completed';
  progress: number;
  message: string;
}

export class AudioProcessor {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;
  private loadingPromise: Promise<void> | null = null;

  constructor() {
    this.ffmpeg = new FFmpeg();
  }

  private async loadFFmpeg(): Promise<void> {
    if (this.isLoaded) return;

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this.doLoadFFmpeg();
    return this.loadingPromise;
  }

  private async doLoadFFmpeg(): Promise<void> {
    if (!this.ffmpeg) {
      throw createAppError(
        'FFMPEG_INIT_ERROR',
        'Failed to initialize FFmpeg'
      );
    }

    try {
      // Load FFmpeg with CDN URLs for better reliability
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      this.isLoaded = true;
    } catch (error) {
      this.loadingPromise = null;
      throw createAppError(
        'FFMPEG_LOAD_ERROR',
        'Failed to load FFmpeg. Please check your internet connection and try again.',
        { originalError: error }
      );
    }
  }

  async convertAudio(
    file: File,
    options: AudioConversionOptions = {
      outputFormat: 'wav',
      sampleRate: 16000,
      channels: 1,
      silenceRemoval: {
        enabled: config.audio.silenceRemoval.enabled,
        thresholdDb: config.audio.silenceRemoval.thresholdDb,
        minDuration: config.audio.silenceRemoval.minDuration,
      },
    },
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<File> {
    try {
      // Notify loading stage
      onProgress?.({
        stage: 'loading',
        progress: 0,
        message: 'Loading audio processor...',
      });

      await this.loadFFmpeg();

      if (!this.ffmpeg) {
        throw createAppError('FFMPEG_NOT_LOADED', 'FFmpeg not properly loaded');
      }

      // Setup progress callback
      this.ffmpeg.on('progress', ({ progress }) => {
        onProgress?.({
          stage: 'converting',
          progress: Math.round(progress * 100),
          message: `Converting audio... ${Math.round(progress * 100)}%`,
        });
      });

      onProgress?.({
        stage: 'converting',
        progress: 0,
        message: 'Preparing audio file...',
      });

      // Write input file
      const inputExtension = this.getFileExtension(file.name);
      const inputName = 'input.' + inputExtension;
      await this.ffmpeg.writeFile(inputName, await fetchFile(file));

      // Check if this is a video format that needs audio extraction
      const videoFormats = ['mp4', 'webm', 'mkv', 'avi', 'mov'];
      const isVideoFormat = videoFormats.includes(inputExtension.toLowerCase());

      if (isVideoFormat) {
        onProgress?.({
          stage: 'converting',
          progress: 5,
          message: 'Extracting audio from video file...',
        });
      }

      // Build FFmpeg command
      const outputName = `output.${options.outputFormat}`;
      const command = [
        '-i', inputName,
      ];

      // For video formats, explicitly extract only the audio stream
      if (isVideoFormat) {
        command.push('-vn'); // No video - extract audio only
        command.push('-acodec', 'pcm_s16le'); // Use PCM codec for WAV output
      }

      // Set audio channels and sample rate
      command.push(
        '-ac', options.channels.toString(),
        '-ar', options.sampleRate.toString()
      );

      // Build audio filter chain for speech enhancement and cleanup
      // NOTE: FFmpeg.wasm 0.12.6 has limited filter support - complex filters like
      // anlmdn (non-local means denoising) and equalizer cause empty output.
      // Using only simple, compatible filters.
      const audioFilters: string[] = [];

      // Simple filters that work with FFmpeg.wasm:
      // - highpass/lowpass: basic frequency filtering
      // - silenceremove: silence detection and removal

      // 1. Basic frequency cleanup (if speech enhancement enabled)
      if (config.audio.speechEnhancement.enabled) {
        // highpass: Remove low frequency rumble (below 80Hz)
        audioFilters.push('highpass=f=80');

        // lowpass: Remove high frequency hiss (above 12kHz)
        audioFilters.push('lowpass=f=12000');
      }

      // 2. Silence removal filter (if enabled)
      if (options.silenceRemoval?.enabled) {
        const thresholdDb = options.silenceRemoval.thresholdDb;
        const minDuration = options.silenceRemoval.minDuration;
        // silenceremove filter: stop_periods=-1 means remove all silence periods
        audioFilters.push(`silenceremove=stop_periods=-1:stop_threshold=${thresholdDb}dB:stop_duration=${minDuration}`);
      }

      // Apply combined filter chain
      if (audioFilters.length > 0) {
        command.push('-af', audioFilters.join(','));
      }

      command.push('-f', options.outputFormat, outputName);

      // Execute conversion
      console.log('🔵 FFmpeg: Executing command:', command.join(' '));
      await this.ffmpeg.exec(command);

      // Read output file
      const outputData = await this.ffmpeg.readFile(outputName);
      console.log('🔵 FFmpeg: Output data type:', typeof outputData, 'Length:', (outputData as Uint8Array).length || 'N/A');

      const outputBlob = new Blob([outputData as unknown as ArrayBuffer], { type: `audio/${options.outputFormat}` });
      console.log('🔵 FFmpeg: Output blob size:', outputBlob.size, 'bytes');

      // Validate output is not empty
      if (outputBlob.size === 0) {
        console.error('🔴 FFmpeg: Conversion produced empty output!', {
          inputFile: file.name,
          inputSize: file.size,
          inputType: file.type,
          command: command.join(' ')
        });
        throw createAppError(
          'AUDIO_CONVERSION_ERROR',
          'Audio conversion produced empty output. The file may not contain valid audio.',
          { fileName: file.name, fileSize: file.size }
        );
      }

      // Create new File object with converted audio
      const convertedFile = new File(
        [outputBlob],
        `${this.getFileNameWithoutExtension(file.name)}.${options.outputFormat}`,
        { type: `audio/${options.outputFormat}` }
      );
      console.log('🟢 FFmpeg: Conversion successful, output file size:', convertedFile.size, 'bytes');

      // Clean up temporary files
      await this.ffmpeg.deleteFile(inputName);
      await this.ffmpeg.deleteFile(outputName);

      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'Audio conversion completed',
      });

      return convertedFile;

    } catch (error) {
      throw createAppError(
        'AUDIO_CONVERSION_ERROR',
        'Failed to convert audio file. Please try with a different file.',
        {
          originalError: error,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type
        }
      );
    }
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot + 1).toLowerCase() : '';
  }

  private getFileNameWithoutExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(0, lastDot) : filename;
  }

  async isFormatSupported(file: File): Promise<boolean> {
    try {
      await this.loadFFmpeg();

      // Check if file extension is in supported formats (audio + video with audio tracks)
      const supportedFormats = ['wav', 'mp3', 'mp4', 'm4a', 'aac', 'flac', 'ogg', 'webm', 'mkv', 'avi', 'mov'];
      const extension = this.getFileExtension(file.name);

      return supportedFormats.includes(extension);
    } catch {
      return false;
    }
  }

  dispose(): void {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
      this.ffmpeg = null;
    }
    this.isLoaded = false;
    this.loadingPromise = null;
  }
}

// Singleton instance
let audioProcessorInstance: AudioProcessor | null = null;

export const getAudioProcessor = (): AudioProcessor => {
  if (!audioProcessorInstance) {
    audioProcessorInstance = new AudioProcessor();
  }
  return audioProcessorInstance;
};

// Fallback for browsers that don't support SharedArrayBuffer or other requirements
export const isFFmpegSupported = (): boolean => {
  try {
    // Check for SharedArrayBuffer support (required for FFmpeg.wasm)
    if (typeof SharedArrayBuffer === 'undefined') {
      return false;
    }

    // Check if in a secure context (required for some FFmpeg features)
    if (!window.isSecureContext) {
      return false;
    }

    return config.features.enableFFmpegWorker;
  } catch {
    return false;
  }
};

// Server fallback (for when FFmpeg.wasm is not supported)
export const convertAudioOnServer = async (
  file: File,
  _options: AudioConversionOptions
): Promise<File> => {
  // This would be implemented as a backend endpoint
  // For now, return the original file as fallback
  return file;
};

// Convenience function for the Upload & Analyze page
export const convertAudioToWav = async (
  file: File,
  onProgress?: (progress: number) => void,
  silenceRemovalOverride?: Partial<SilenceRemovalOptions>
): Promise<Blob> => {
  const processor = getAudioProcessor();

  // Use config defaults for silence removal, allow override
  const silenceRemoval: SilenceRemovalOptions = {
    enabled: silenceRemovalOverride?.enabled ?? config.audio.silenceRemoval.enabled,
    thresholdDb: silenceRemovalOverride?.thresholdDb ?? config.audio.silenceRemoval.thresholdDb,
    minDuration: silenceRemovalOverride?.minDuration ?? config.audio.silenceRemoval.minDuration,
  };

  const convertedFile = await processor.convertAudio(
    file,
    {
      outputFormat: 'wav',
      sampleRate: 44100,
      channels: 1,
      silenceRemoval,
    },
    onProgress ? (progress) => onProgress(progress.progress) : undefined
  );

  // Convert File to Blob
  return new Blob([convertedFile], { type: 'audio/wav' });
};
