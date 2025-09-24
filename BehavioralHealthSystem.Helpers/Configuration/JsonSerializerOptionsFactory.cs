namespace BehavioralHealthSystem.Configuration;

/// <summary>
/// Factory for creating standardized JsonSerializerOptions instances.
/// Eliminates duplication of JsonSerializerOptions configuration across the application.
/// </summary>
public static class JsonSerializerOptionsFactory
{
    /// <summary>
    /// Default JSON serializer options used throughout the application.
    /// Configured with camelCase property naming and case-insensitive deserialization.
    /// </summary>
    public static JsonSerializerOptions Default { get; } = new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    /// <summary>
    /// JSON serializer options for API responses.
    /// Includes default configuration plus indented formatting for readability.
    /// </summary>
    public static JsonSerializerOptions PrettyPrint { get; } = new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true
    };

    /// <summary>
    /// Creates a new instance of JsonSerializerOptions with default configuration.
    /// Use this when you need to modify options without affecting the shared instances.
    /// </summary>
    /// <returns>A new JsonSerializerOptions instance with default settings</returns>
    public static JsonSerializerOptions CreateDefault()
    {
        return new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };
    }
}