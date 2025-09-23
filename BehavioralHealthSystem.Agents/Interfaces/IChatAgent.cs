namespace BehavioralHealthSystem.Agents.Interfaces;

/// <summary>
/// Chat agent interface for compatibility
/// </summary>
public interface IChatAgent
{
    string Name { get; }
    string Instructions { get; }
    Task<string> ProcessMessageAsync(string message, CancellationToken cancellationToken = default);
}