using System.ComponentModel;
using Microsoft.SemanticKernel;

namespace BehavioralHealthSystem.Agents.Plugins;

/// <summary>
/// Semantic Kernel native function plugin for retrieving audio files from a local directory.
/// Alternative to AudioRetrievalPlugin (blob storage) for local/dev workflows.
/// Step 1 of the audio processing pipeline: Fetch (local).
/// </summary>
public class LocalFileRetrievalPlugin
{
    private readonly ILogger<LocalFileRetrievalPlugin> _logger;
    private readonly LocalFileRetrievalOptions _options;

    /// <summary>Supported audio file extensions for directory scanning.</summary>
    private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".wav", ".mp3", ".mp4", ".m4a", ".aac", ".flac", ".ogg", ".webm", ".mkv", ".avi", ".mov"
    };

    public LocalFileRetrievalPlugin(
        ILogger<LocalFileRetrievalPlugin> logger,
        IOptions<LocalFileRetrievalOptions> options)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _options = options?.Value ?? new LocalFileRetrievalOptions();
    }

    /// <summary>
    /// Retrieves an audio file from a local directory.
    /// If filePath is a full path, reads it directly.
    /// If filePath is just a file name, searches the configured recordings directory.
    /// If filePath is null/empty, retrieves the most recently modified audio file in the directory.
    /// </summary>
    [KernelFunction("GetAudioFromLocalDirectory")]
    [Description("Retrieves an audio file from a local directory. Can read a specific file path, search by file name, or pick the most recent audio file.")]
    public async Task<AudioFile> GetAudioFromLocalDirectoryAsync(
        [Description("The user ID (for metadata tracking)")] string userId,
        [Description("The session ID (for metadata tracking)")] string sessionId,
        [Description("File path or file name. If a full path, reads directly. If a file name, searches the recordings directory. If null, picks the most recent audio file.")] string? filePath = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(userId, nameof(userId));
        ArgumentException.ThrowIfNullOrWhiteSpace(sessionId, nameof(sessionId));

        _logger.LogInformation(
            "[{PluginName}] Fetching audio from local directory. UserId={UserId}, SessionId={SessionId}, FilePath={FilePath}, BaseDir={BaseDir}",
            nameof(LocalFileRetrievalPlugin), userId, sessionId, filePath ?? "(latest)", _options.RecordingsDirectory);

        string resolvedPath;

        if (!string.IsNullOrWhiteSpace(filePath))
        {
            resolvedPath = ResolveFilePath(filePath);
        }
        else
        {
            resolvedPath = FindLatestAudioFile(sessionId);
        }

        if (!File.Exists(resolvedPath))
        {
            throw new FileNotFoundException(
                $"Audio file not found at resolved path: '{resolvedPath}'.", resolvedPath);
        }

        var fileInfo = new FileInfo(resolvedPath);
        var data = await File.ReadAllBytesAsync(resolvedPath, cancellationToken);

        var audioFile = new AudioFile
        {
            Data = data,
            FileName = fileInfo.Name,
            ContentType = InferContentType(fileInfo.Name),
            BlobPath = string.Empty, // Not from blob
            SourcePath = resolvedPath,
            Source = AudioFileSource.LocalDirectory,
            UserId = userId,
            SessionId = sessionId
        };

        _logger.LogInformation(
            "[{PluginName}] Read local audio: {FilePath}, Size={Size} bytes, ContentType={ContentType}",
            nameof(LocalFileRetrievalPlugin), resolvedPath, audioFile.FileSize, audioFile.ContentType);

        return audioFile;
    }

    /// <summary>
    /// Resolves a file path that may be absolute, relative, or just a filename.
    /// </summary>
    private string ResolveFilePath(string filePath)
    {
        // If it's already a rooted/absolute path, use it directly
        if (Path.IsPathRooted(filePath))
        {
            _logger.LogDebug("[{PluginName}] Using absolute path: {Path}",
                nameof(LocalFileRetrievalPlugin), filePath);
            return filePath;
        }

        // Otherwise, treat it as relative to the recordings directory
        var baseDir = _options.RecordingsDirectory;
        if (string.IsNullOrWhiteSpace(baseDir))
        {
            throw new InvalidOperationException(
                "RecordingsDirectory is not configured. Set the LOCAL_RECORDINGS_DIRECTORY environment variable " +
                "or provide a full file path.");
        }

        var resolved = Path.Combine(baseDir, filePath);
        _logger.LogDebug("[{PluginName}] Resolved relative path '{RelativePath}' to '{ResolvedPath}'",
            nameof(LocalFileRetrievalPlugin), filePath, resolved);
        return resolved;
    }

    /// <summary>
    /// Finds the most recently modified audio file in the recordings directory,
    /// optionally filtered by session ID in the filename.
    /// </summary>
    private string FindLatestAudioFile(string? sessionId)
    {
        var baseDir = _options.RecordingsDirectory;
        if (string.IsNullOrWhiteSpace(baseDir) || !Directory.Exists(baseDir))
        {
            throw new DirectoryNotFoundException(
                $"Recordings directory not found or not configured: '{baseDir}'. " +
                "Set the LOCAL_RECORDINGS_DIRECTORY environment variable.");
        }

        _logger.LogInformation(
            "[{PluginName}] Scanning directory '{Directory}' for audio files matching session '{SessionId}'",
            nameof(LocalFileRetrievalPlugin), baseDir, sessionId ?? "(any)");

        var searchOption = _options.SearchSubdirectories
            ? SearchOption.AllDirectories
            : SearchOption.TopDirectoryOnly;

        var audioFiles = Directory.EnumerateFiles(baseDir, "*.*", searchOption)
            .Where(f => SupportedExtensions.Contains(Path.GetExtension(f)))
            .Select(f => new FileInfo(f))
            .OrderByDescending(f => f.LastWriteTimeUtc);

        // Filter by session ID if provided
        FileInfo? match;
        if (!string.IsNullOrWhiteSpace(sessionId))
        {
            match = audioFiles.FirstOrDefault(f =>
                f.Name.Contains(sessionId, StringComparison.OrdinalIgnoreCase));

            // Fall back to most recent if no session match
            match ??= audioFiles.FirstOrDefault();
        }
        else
        {
            match = audioFiles.FirstOrDefault();
        }

        if (match == null)
        {
            throw new FileNotFoundException(
                $"No audio files found in directory '{baseDir}'. " +
                $"Searched for extensions: {string.Join(", ", SupportedExtensions)}");
        }

        _logger.LogInformation(
            "[{PluginName}] Found latest local audio: {FileName}, LastModified={LastModified}, Size={Size}",
            nameof(LocalFileRetrievalPlugin), match.FullName, match.LastWriteTimeUtc, match.Length);

        return match.FullName;
    }

    private static string InferContentType(string fileName)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension switch
        {
            ".wav" => "audio/wav",
            ".mp3" => "audio/mpeg",
            ".mp4" or ".m4a" => "audio/mp4",
            ".ogg" => "audio/ogg",
            ".webm" => "audio/webm",
            ".flac" => "audio/flac",
            ".aac" => "audio/aac",
            _ => "application/octet-stream"
        };
    }
}

/// <summary>
/// Configuration options for local file retrieval.
/// </summary>
public class LocalFileRetrievalOptions
{
    /// <summary>Base directory to search for audio recordings. Defaults to "./recordings".</summary>
    public string RecordingsDirectory { get; set; } = "./recordings";

    /// <summary>Whether to search subdirectories when scanning for audio files.</summary>
    public bool SearchSubdirectories { get; set; } = true;
}
