using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using NAudio.Wave;
using NAudio.Lame;
using NAudio.CoreAudioApi;

namespace BehavioralHealthSystem.Agents.Services;

/// <summary>
/// C# Audio Processing Service for WebRTC-like functionality
/// Handles audio capture, processing, voice activity detection, and real-time streaming
/// Designed for integration with Azure AI Foundry GPT-Realtime model
/// </summary>
public class AudioProcessingService : IDisposable
{
    private readonly ILogger<AudioProcessingService> _logger;
    private readonly AudioConfig _config;
    
    // Audio capture and playback
    private WaveInEvent? _waveIn;
    private WaveOutEvent? _waveOut;
    private BufferedWaveProvider? _playbackBuffer;
    
    // Audio processing
    private readonly ConcurrentQueue<byte[]> _audioQueue = new();
    private readonly List<byte> _audioBuffer = new();
    private bool _isRecording;
    private bool _isPlaying;
    
    // Voice Activity Detection (VAD)
    private readonly VoiceActivityDetector _vadDetector;
    private bool _isSpeaking;
    private DateTime _lastSpeechTime;
    private readonly TimeSpan _speechTimeout = TimeSpan.FromMilliseconds(800);
    
    // Audio format conversion
    private readonly WaveFormat _inputFormat;
    private readonly WaveFormat _outputFormat;
    
    // Events
    public event EventHandler<AudioCapturedEventArgs>? AudioCaptured;
    public event EventHandler<VoiceActivityEventArgs>? VoiceActivityChanged;
    public event EventHandler<AudioErrorEventArgs>? AudioError;
    public event EventHandler? RecordingStarted;
    public event EventHandler? RecordingStopped;
    public event EventHandler? PlaybackStarted;
    public event EventHandler? PlaybackStopped;

    public AudioProcessingService(
        ILogger<AudioProcessingService> logger,
        AudioConfig? config = null)
    {
        _logger = logger;
        _config = config ?? new AudioConfig();
        
        // Initialize audio formats for GPT-Realtime (16kHz, 16-bit, mono PCM)
        _inputFormat = new WaveFormat(_config.SampleRate, _config.BitsPerSample, _config.Channels);
        _outputFormat = new WaveFormat(_config.SampleRate, _config.BitsPerSample, _config.Channels);
        
        // Initialize Voice Activity Detector
        _vadDetector = new VoiceActivityDetector(_config.VadThreshold, _config.VadSilenceDuration);
        
        InitializeAudioDevices();
    }

    /// <summary>
    /// Initialize audio capture and playback devices
    /// </summary>
    private void InitializeAudioDevices()
    {
        try
        {
            // Initialize audio capture
            _waveIn = new WaveInEvent
            {
                WaveFormat = _inputFormat,
                BufferMilliseconds = _config.BufferSize,
                NumberOfBuffers = 3
            };
            _waveIn.DataAvailable += OnAudioDataAvailable;
            _waveIn.RecordingStopped += OnRecordingStopped;

            // Initialize audio playback
            _waveOut = new WaveOutEvent();
            _playbackBuffer = new BufferedWaveProvider(_outputFormat)
            {
                BufferLength = _config.PlaybackBufferSize,
                DiscardOnBufferOverflow = true
            };
            _waveOut.Init(_playbackBuffer);
            _waveOut.PlaybackStopped += OnPlaybackStopped;

            _logger.LogInformation("Audio devices initialized - Sample Rate: {SampleRate}Hz, Channels: {Channels}, Bits: {BitsPerSample}", 
                _inputFormat.SampleRate, _inputFormat.Channels, _inputFormat.BitsPerSample);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize audio devices");
            AudioError?.Invoke(this, new AudioErrorEventArgs(ex.Message));
            throw;
        }
    }

    /// <summary>
    /// Start audio recording
    /// </summary>
    public async Task StartRecordingAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            if (_isRecording)
            {
                _logger.LogWarning("Recording is already in progress");
                return;
            }

            if (_waveIn == null)
            {
                throw new InvalidOperationException("Audio capture device not initialized");
            }

            _audioBuffer.Clear();
            _audioQueue.Clear();
            _isSpeaking = false;
            _lastSpeechTime = DateTime.UtcNow;

            _waveIn.StartRecording();
            _isRecording = true;

            _logger.LogInformation("Audio recording started");
            RecordingStarted?.Invoke(this, EventArgs.Empty);

            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start audio recording");
            AudioError?.Invoke(this, new AudioErrorEventArgs(ex.Message));
            throw;
        }
    }

    /// <summary>
    /// Stop audio recording
    /// </summary>
    public async Task StopRecordingAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            if (!_isRecording)
            {
                _logger.LogWarning("Recording is not in progress");
                return;
            }

            _waveIn?.StopRecording();
            _isRecording = false;

            _logger.LogInformation("Audio recording stopped");
            RecordingStopped?.Invoke(this, EventArgs.Empty);

            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to stop audio recording");
            AudioError?.Invoke(this, new AudioErrorEventArgs(ex.Message));
        }
    }

    /// <summary>
    /// Start audio playback
    /// </summary>
    public async Task StartPlaybackAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            if (_isPlaying)
            {
                _logger.LogWarning("Playback is already in progress");
                return;
            }

            if (_waveOut == null || _playbackBuffer == null)
            {
                throw new InvalidOperationException("Audio playback device not initialized");
            }

            _waveOut.Play();
            _isPlaying = true;

            _logger.LogInformation("Audio playback started");
            PlaybackStarted?.Invoke(this, EventArgs.Empty);

            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to start audio playback");
            AudioError?.Invoke(this, new AudioErrorEventArgs(ex.Message));
            throw;
        }
    }

    /// <summary>
    /// Stop audio playback
    /// </summary>
    public async Task StopPlaybackAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            if (!_isPlaying)
            {
                return;
            }

            _waveOut?.Stop();
            _playbackBuffer?.ClearBuffer();
            _isPlaying = false;

            _logger.LogInformation("Audio playback stopped");
            PlaybackStopped?.Invoke(this, EventArgs.Empty);

            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to stop audio playback");
            AudioError?.Invoke(this, new AudioErrorEventArgs(ex.Message));
        }
    }

    /// <summary>
    /// Play received audio data
    /// </summary>
    public async Task PlayAudioAsync(byte[] audioData, CancellationToken cancellationToken = default)
    {
        try
        {
            if (_playbackBuffer == null)
            {
                _logger.LogWarning("Playback buffer not initialized");
                return;
            }

            // Convert and add to playback buffer
            var convertedData = ConvertAudioFormat(audioData, _inputFormat, _outputFormat);
            _playbackBuffer.AddSamples(convertedData, 0, convertedData.Length);

            if (!_isPlaying)
            {
                await StartPlaybackAsync(cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to play audio data");
            AudioError?.Invoke(this, new AudioErrorEventArgs(ex.Message));
        }
    }

    /// <summary>
    /// Get current audio levels for visualization
    /// </summary>
    public AudioLevels GetAudioLevels()
    {
        try
        {
            // Calculate RMS and peak levels from recent audio data
            if (_audioBuffer.Count < 100)
            {
                return new AudioLevels { RmsLevel = 0, PeakLevel = 0, IsSpeaking = _isSpeaking };
            }

            var recentSamples = _audioBuffer.TakeLast(1000).ToArray();
            var rmsLevel = CalculateRmsLevel(recentSamples);
            var peakLevel = CalculatePeakLevel(recentSamples);

            return new AudioLevels
            {
                RmsLevel = rmsLevel,
                PeakLevel = peakLevel,
                IsSpeaking = _isSpeaking
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to calculate audio levels");
            return new AudioLevels();
        }
    }

    /// <summary>
    /// Get available audio devices
    /// </summary>
    public List<AudioDevice> GetAvailableInputDevices()
    {
        var devices = new List<AudioDevice>();

        try
        {
            for (int i = 0; i < WaveInEvent.DeviceCount; i++)
            {
                var capabilities = WaveInEvent.GetCapabilities(i);
                devices.Add(new AudioDevice
                {
                    Id = i,
                    Name = capabilities.ProductName,
                    Channels = capabilities.Channels,
                    Type = "Input"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to enumerate input devices");
        }

        return devices;
    }

    /// <summary>
    /// Get available output devices
    /// </summary>
    public List<AudioDevice> GetAvailableOutputDevices()
    {
        var devices = new List<AudioDevice>();

        try
        {
            for (int i = 0; i < WaveOutEvent.DeviceCount; i++)
            {
                var capabilities = WaveOutEvent.GetCapabilities(i);
                devices.Add(new AudioDevice
                {
                    Id = i,
                    Name = capabilities.ProductName,
                    Channels = capabilities.Channels,
                    Type = "Output"
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to enumerate output devices");
        }

        return devices;
    }

    /// <summary>
    /// Handle incoming audio data
    /// </summary>
    private void OnAudioDataAvailable(object? sender, WaveInEventArgs e)
    {
        try
        {
            if (!_isRecording || e.BytesRecorded == 0)
            {
                return;
            }

            // Add to buffer for processing
            var audioData = new byte[e.BytesRecorded];
            Array.Copy(e.Buffer, 0, audioData, 0, e.BytesRecorded);
            _audioBuffer.AddRange(audioData);

            // Voice Activity Detection
            var hasVoiceActivity = _vadDetector.DetectVoiceActivity(audioData);
            
            if (hasVoiceActivity != _isSpeaking)
            {
                _isSpeaking = hasVoiceActivity;
                _lastSpeechTime = DateTime.UtcNow;
                
                VoiceActivityChanged?.Invoke(this, new VoiceActivityEventArgs
                {
                    IsSpeaking = _isSpeaking,
                    Confidence = _vadDetector.GetConfidence(),
                    Timestamp = DateTime.UtcNow
                });
            }

            // Update last speech time if currently speaking
            if (_isSpeaking)
            {
                _lastSpeechTime = DateTime.UtcNow;
            }

            // Check for speech timeout
            if (_isSpeaking && DateTime.UtcNow - _lastSpeechTime > _speechTimeout)
            {
                _isSpeaking = false;
                VoiceActivityChanged?.Invoke(this, new VoiceActivityEventArgs
                {
                    IsSpeaking = false,
                    Confidence = 0,
                    Timestamp = DateTime.UtcNow
                });
            }

            // Convert to GPT-Realtime format and emit
            var convertedData = ConvertToGptRealtimeFormat(audioData);
            AudioCaptured?.Invoke(this, new AudioCapturedEventArgs
            {
                AudioData = convertedData,
                SampleRate = _inputFormat.SampleRate,
                Channels = _inputFormat.Channels,
                BitsPerSample = _inputFormat.BitsPerSample,
                HasVoiceActivity = _isSpeaking,
                Timestamp = DateTime.UtcNow
            });

            // Manage buffer size
            if (_audioBuffer.Count > _config.MaxBufferSize)
            {
                var excess = _audioBuffer.Count - _config.MaxBufferSize;
                _audioBuffer.RemoveRange(0, excess);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing audio data");
            AudioError?.Invoke(this, new AudioErrorEventArgs(ex.Message));
        }
    }

    /// <summary>
    /// Convert audio data to GPT-Realtime format (16kHz, 16-bit, mono PCM)
    /// </summary>
    private byte[] ConvertToGptRealtimeFormat(byte[] audioData)
    {
        try
        {
            // If already in correct format, return as-is
            if (_inputFormat.SampleRate == 16000 && _inputFormat.BitsPerSample == 16 && _inputFormat.Channels == 1)
            {
                return audioData;
            }

            // Convert sample rate, bit depth, and channels as needed
            return ConvertAudioFormat(audioData, _inputFormat, new WaveFormat(16000, 16, 1));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to convert audio to GPT-Realtime format");
            return audioData; // Return original data as fallback
        }
    }

    /// <summary>
    /// Convert audio between different formats
    /// </summary>
    private byte[] ConvertAudioFormat(byte[] inputData, WaveFormat inputFormat, WaveFormat outputFormat)
    {
        try
        {
            using var inputStream = new MemoryStream(inputData);
            using var inputProvider = new RawSourceWaveStream(inputStream, inputFormat);
            
            // Resample if needed
            ISampleProvider sampleProvider = inputProvider.ToSampleProvider();
            
            if (inputFormat.SampleRate != outputFormat.SampleRate)
            {
                sampleProvider = new WdlResamplingSampleProvider(sampleProvider, outputFormat.SampleRate);
            }

            // Convert channels if needed
            if (inputFormat.Channels != outputFormat.Channels)
            {
                if (outputFormat.Channels == 1 && inputFormat.Channels > 1)
                {
                    sampleProvider = sampleProvider.ToMono();
                }
                else if (outputFormat.Channels == 2 && inputFormat.Channels == 1)
                {
                    sampleProvider = sampleProvider.ToStereo();
                }
            }

            // Convert to output format
            using var outputStream = new MemoryStream();
            using var waveProvider = sampleProvider.ToWaveProvider16();
            
            var buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = waveProvider.Read(buffer, 0, buffer.Length)) > 0)
            {
                outputStream.Write(buffer, 0, bytesRead);
            }

            return outputStream.ToArray();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to convert audio format");
            return inputData; // Return original as fallback
        }
    }

    /// <summary>
    /// Calculate RMS level for audio visualization
    /// </summary>
    private double CalculateRmsLevel(byte[] audioData)
    {
        if (audioData.Length == 0) return 0;

        long sum = 0;
        int sampleCount = audioData.Length / 2; // 16-bit samples

        for (int i = 0; i < audioData.Length - 1; i += 2)
        {
            short sample = (short)(audioData[i] | (audioData[i + 1] << 8));
            sum += sample * sample;
        }

        return Math.Sqrt((double)sum / sampleCount) / 32768.0; // Normalize to 0-1
    }

    /// <summary>
    /// Calculate peak level for audio visualization
    /// </summary>
    private double CalculatePeakLevel(byte[] audioData)
    {
        if (audioData.Length == 0) return 0;

        short maxSample = 0;

        for (int i = 0; i < audioData.Length - 1; i += 2)
        {
            short sample = Math.Abs((short)(audioData[i] | (audioData[i + 1] << 8)));
            if (sample > maxSample)
            {
                maxSample = sample;
            }
        }

        return (double)maxSample / 32768.0; // Normalize to 0-1
    }

    // Event handlers
    private void OnRecordingStopped(object? sender, StoppedEventArgs e)
    {
        _isRecording = false;
        if (e.Exception != null)
        {
            _logger.LogError(e.Exception, "Recording stopped due to error");
            AudioError?.Invoke(this, new AudioErrorEventArgs(e.Exception.Message));
        }
    }

    private void OnPlaybackStopped(object? sender, StoppedEventArgs e)
    {
        _isPlaying = false;
        if (e.Exception != null)
        {
            _logger.LogError(e.Exception, "Playback stopped due to error");
            AudioError?.Invoke(this, new AudioErrorEventArgs(e.Exception.Message));
        }
    }

    public void Dispose()
    {
        try
        {
            StopRecordingAsync().GetAwaiter().GetResult();
            StopPlaybackAsync().GetAwaiter().GetResult();

            _waveIn?.Dispose();
            _waveOut?.Dispose();
            _playbackBuffer?.ClearBuffer();

            _audioBuffer.Clear();
            while (_audioQueue.TryDequeue(out _)) { }

            _logger.LogInformation("Audio processing service disposed");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error disposing audio processing service");
        }
    }
}

/// <summary>
/// Voice Activity Detector for real-time speech detection
/// </summary>
public class VoiceActivityDetector
{
    private readonly double _threshold;
    private readonly TimeSpan _silenceDuration;
    private readonly List<double> _energyHistory = new();
    private DateTime _lastVoiceTime = DateTime.MinValue;
    private double _currentConfidence;

    public VoiceActivityDetector(double threshold = 0.01, double silenceDurationMs = 300)
    {
        _threshold = threshold;
        _silenceDuration = TimeSpan.FromMilliseconds(silenceDurationMs);
    }

    public bool DetectVoiceActivity(byte[] audioData)
    {
        var energy = CalculateEnergy(audioData);
        _energyHistory.Add(energy);

        // Keep only recent history
        if (_energyHistory.Count > 50)
        {
            _energyHistory.RemoveAt(0);
        }

        // Calculate adaptive threshold
        var avgEnergy = _energyHistory.Count > 10 ? _energyHistory.Take(_energyHistory.Count - 5).Average() : 0;
        var adaptiveThreshold = Math.Max(_threshold, avgEnergy * 2);

        var hasVoice = energy > adaptiveThreshold;
        
        if (hasVoice)
        {
            _lastVoiceTime = DateTime.UtcNow;
            _currentConfidence = Math.Min(energy / adaptiveThreshold, 1.0);
        }
        else
        {
            _currentConfidence = 0;
        }

        // Check silence duration
        return hasVoice || (DateTime.UtcNow - _lastVoiceTime < _silenceDuration);
    }

    public double GetConfidence() => _currentConfidence;

    private double CalculateEnergy(byte[] audioData)
    {
        if (audioData.Length == 0) return 0;

        long sum = 0;
        int sampleCount = audioData.Length / 2;

        for (int i = 0; i < audioData.Length - 1; i += 2)
        {
            short sample = (short)(audioData[i] | (audioData[i + 1] << 8));
            sum += sample * sample;
        }

        return (double)sum / sampleCount / (32768.0 * 32768.0); // Normalize
    }
}

// Configuration and Data Classes
public class AudioConfig
{
    public int SampleRate { get; set; } = 16000; // GPT-Realtime requires 16kHz
    public int BitsPerSample { get; set; } = 16; // GPT-Realtime requires 16-bit
    public int Channels { get; set; } = 1; // GPT-Realtime requires mono
    public int BufferSize { get; set; } = 100; // milliseconds
    public int PlaybackBufferSize { get; set; } = 8192; // bytes
    public int MaxBufferSize { get; set; } = 160000; // 10 seconds at 16kHz 16-bit mono
    public double VadThreshold { get; set; } = 0.01;
    public double VadSilenceDuration { get; set; } = 300; // milliseconds
}

public class AudioLevels
{
    public double RmsLevel { get; set; }
    public double PeakLevel { get; set; }
    public bool IsSpeaking { get; set; }
}

public class AudioDevice
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Channels { get; set; }
    public string Type { get; set; } = string.Empty; // "Input" or "Output"
}

// Event Args
public class AudioCapturedEventArgs : EventArgs
{
    public byte[] AudioData { get; set; } = Array.Empty<byte>();
    public int SampleRate { get; set; }
    public int Channels { get; set; }
    public int BitsPerSample { get; set; }
    public bool HasVoiceActivity { get; set; }
    public DateTime Timestamp { get; set; }
}

public class VoiceActivityEventArgs : EventArgs
{
    public bool IsSpeaking { get; set; }
    public double Confidence { get; set; }
    public DateTime Timestamp { get; set; }
}

public class AudioErrorEventArgs : EventArgs
{
    public string Message { get; set; }

    public AudioErrorEventArgs(string message)
    {
        Message = message;
    }
}