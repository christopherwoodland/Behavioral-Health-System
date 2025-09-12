import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { config } from '@/config/constants';
import { createAppError } from '@/utils';
import type { AudioConversionOptions } from '@/types';
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
      sampleRate: 44100,
      channels: 1,
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
      const inputName = 'input.' + this.getFileExtension(file.name);
      await this.ffmpeg.writeFile(inputName, await fetchFile(file));

      // Build FFmpeg command
      const outputName = `output.${options.outputFormat}`;
      const command = [
        '-i', inputName,
        '-ac', options.channels.toString(),
        '-ar', options.sampleRate.toString(),
        '-f', options.outputFormat,
        outputName
      ];

      // Execute conversion
      await this.ffmpeg.exec(command);

      // Read output file
      const outputData = await this.ffmpeg.readFile(outputName);
      const outputBlob = new Blob([outputData as unknown as ArrayBuffer], { type: `audio/${options.outputFormat}` });
      
      // Create new File object with converted audio
      const convertedFile = new File(
        [outputBlob],
        `${this.getFileNameWithoutExtension(file.name)}.${options.outputFormat}`,
        { type: `audio/${options.outputFormat}` }
      );

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
      
      // Check if file extension is in supported formats
      const supportedFormats = ['wav', 'mp3', 'mp4', 'm4a', 'aac', 'flac', 'ogg'];
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
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  const processor = getAudioProcessor();
  
  const convertedFile = await processor.convertAudio(
    file,
    {
      outputFormat: 'wav',
      sampleRate: 44100,
      channels: 1,
    },
    onProgress ? (progress) => onProgress(progress.progress) : undefined
  );

  // Convert File to Blob
  return new Blob([convertedFile], { type: 'audio/wav' });
};
