namespace BehavioralHealthSystem.Agents.Models;

/// <summary>
/// Realtime session state
/// </summary>
public enum RealtimeSessionState
{
    Idle,
    Listening,
    Processing,
    Speaking,
    Error
}