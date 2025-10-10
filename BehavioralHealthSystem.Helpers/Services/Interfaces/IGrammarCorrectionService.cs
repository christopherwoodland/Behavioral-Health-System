namespace BehavioralHealthSystem.Services;

public interface IGrammarCorrectionService
{
    Task<string?> CorrectTextAsync(string text);
}