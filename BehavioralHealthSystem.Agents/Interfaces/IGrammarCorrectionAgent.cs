namespace BehavioralHealthSystem.Agents.Interfaces;

/// <summary>
/// Interface for the Grammar Correction Agent.
/// Provides methods for correcting grammar in user-provided text.
/// </summary>
public interface IGrammarCorrectionAgent
{
    /// <summary>
    /// Corrects grammar in the provided text.
    /// </summary>
    /// <param name="text">The text to correct.</param>
    /// <param name="includeExplanations">Whether to include explanations of corrections.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The grammar correction result.</returns>
    Task<GrammarCorrectionResult> CorrectGrammarAsync(
        string text,
        bool includeExplanations = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Corrects grammar in the provided text with streaming response.
    /// </summary>
    /// <param name="text">The text to correct.</param>
    /// <param name="includeExplanations">Whether to include explanations of corrections.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>An async enumerable of response updates.</returns>
    IAsyncEnumerable<string> CorrectGrammarStreamingAsync(
        string text,
        bool includeExplanations = false,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks if the agent is properly configured and available.
    /// </summary>
    /// <returns>True if the agent is available, false otherwise.</returns>
    bool IsAvailable { get; }
}

/// <summary>
/// Result of a grammar correction operation.
/// </summary>
public class GrammarCorrectionResult
{
    /// <summary>
    /// The corrected text with proper grammar.
    /// </summary>
    public string CorrectedText { get; set; } = string.Empty;

    /// <summary>
    /// The original text that was submitted for correction.
    /// </summary>
    public string OriginalText { get; set; } = string.Empty;

    /// <summary>
    /// Explanations of the corrections made (if requested).
    /// </summary>
    public string? Explanations { get; set; }

    /// <summary>
    /// Alternative phrasings suggested (if enabled).
    /// </summary>
    public List<string>? AlternativeSuggestions { get; set; }

    /// <summary>
    /// Whether the operation was successful.
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Error message if the operation failed.
    /// </summary>
    public string? ErrorMessage { get; set; }

    /// <summary>
    /// Number of corrections made.
    /// </summary>
    public int CorrectionCount { get; set; }

    /// <summary>
    /// Creates a successful result.
    /// </summary>
    public static GrammarCorrectionResult Successful(string originalText, string correctedText, string? explanations = null)
    {
        return new GrammarCorrectionResult
        {
            OriginalText = originalText,
            CorrectedText = correctedText,
            Explanations = explanations,
            Success = true
        };
    }

    /// <summary>
    /// Creates a failed result.
    /// </summary>
    public static GrammarCorrectionResult Failed(string originalText, string errorMessage)
    {
        return new GrammarCorrectionResult
        {
            OriginalText = originalText,
            CorrectedText = string.Empty,
            ErrorMessage = errorMessage,
            Success = false
        };
    }
}
