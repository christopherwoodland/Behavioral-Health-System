namespace BehavioralHealthSystem.Services;

/// <summary>
/// Interface for Foundry agent-based grammar correction service
/// </summary>
public interface IFoundryGrammarService
{
    /// <summary>
    /// Corrects grammar using the Azure AI Foundry grammar agent
    /// </summary>
    /// <param name="text">The text to correct</param>
    /// <returns>The corrected text, or null if correction failed</returns>
    Task<string?> CorrectGrammarAsync(string text);

    /// <summary>
    /// Checks if the Foundry grammar service is available and configured
    /// </summary>
    /// <returns>True if the service is available</returns>
    bool IsAvailable();
}
