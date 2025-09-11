import { AudioProcessor, getAudioProcessor, isFFmpegSupported, convertAudioToWav } from '../audio';

describe('Audio Service', () => {
  describe('FFmpeg Support', () => {
    test('should detect FFmpeg support', () => {
      const isSupported = isFFmpegSupported();
      expect(typeof isSupported).toBe('boolean');
    });
  });

  describe('Audio Processor', () => {
    test('should create audio processor instance', () => {
      const processor = getAudioProcessor();
      expect(processor).toBeInstanceOf(AudioProcessor);
    });
  });

  describe('Audio Conversion', () => {
    test('should be a function', () => {
      expect(typeof convertAudioToWav).toBe('function');
    });
  });
});
