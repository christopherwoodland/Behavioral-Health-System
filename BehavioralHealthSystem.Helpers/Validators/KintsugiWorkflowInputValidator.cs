namespace BehavioralHealthSystem.Validators;

public class KintsugiWorkflowInputValidator : AbstractValidator<KintsugiWorkflowInput>
{
    private const int MinAudioSizeBytes = 1024; // 1KB
    private const int MaxAudioSizeBytes = 50 * 1024 * 1024; // 50MB
    private const int MaxUserIdLength = 100;

    public KintsugiWorkflowInputValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User ID is required")
            .MaximumLength(MaxUserIdLength)
            .WithMessage($"User ID must not exceed {MaxUserIdLength} characters");

        RuleFor(x => x.Metadata)
            .SetValidator(new UserMetadataValidator()!)
            .When(x => x.Metadata != null);

        // Validate that either AudioData OR (AudioFileUrl + AudioFileName) is provided
        RuleFor(x => x)
            .Must(HaveValidAudioInput)
            .WithMessage("Either AudioData or both AudioFileUrl and AudioFileName must be provided");

        // Validate AudioData size when provided
        RuleFor(x => x.AudioData)
            .Must(HaveValidAudioSize)
            .When(x => x.AudioData != null && x.AudioData.Length > 0)
            .WithMessage($"Audio data must be between {MinAudioSizeBytes / 1024}KB and {MaxAudioSizeBytes / (1024 * 1024)}MB");

        // Validate AudioFileUrl when provided
        RuleFor(x => x.AudioFileUrl)
            .Must(BeValidUrl)
            .When(x => !string.IsNullOrEmpty(x.AudioFileUrl))
            .WithMessage("AudioFileUrl must be a valid URL");

        // Validate AudioFileName when provided
        RuleFor(x => x.AudioFileName)
            .NotEmpty()
            .When(x => !string.IsNullOrEmpty(x.AudioFileUrl))
            .WithMessage("AudioFileName is required when AudioFileUrl is provided")
            .Must(HaveValidFileExtension)
            .When(x => !string.IsNullOrEmpty(x.AudioFileName))
            .WithMessage("AudioFileName must have a valid audio file extension (.wav, .mp3, .m4a, .flac)");
    }

    private static bool HaveValidAudioSize(byte[]? audioData)
    {
        if (audioData == null || audioData.Length == 0) return true; // Not validating null/empty here
        return audioData.Length >= MinAudioSizeBytes && audioData.Length <= MaxAudioSizeBytes;
    }

    private static bool HaveValidAudioInput(KintsugiWorkflowInput input)
    {
        // Must have either AudioData OR both AudioFileUrl and AudioFileName
        var hasAudioData = input.AudioData != null && input.AudioData.Length > 0;
        var hasUrlAndFileName = !string.IsNullOrEmpty(input.AudioFileUrl) && !string.IsNullOrEmpty(input.AudioFileName);
        
        return hasAudioData || hasUrlAndFileName;
    }

    private static bool BeValidUrl(string? url)
    {
        if (string.IsNullOrEmpty(url)) return false;
        
        return Uri.TryCreate(url, UriKind.Absolute, out var uri) && 
               (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }

    private static bool HaveValidFileExtension(string? fileName)
    {
        if (string.IsNullOrEmpty(fileName)) return false;
        
        var validExtensions = new[] { ".wav", ".mp3", ".m4a", ".flac" };
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        
        return validExtensions.Contains(extension);
    }
}
