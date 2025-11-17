namespace BehavioralHealthSystem.Functions.Services;

/// <summary>
/// Service for managing and retrieving feature flags from environment configuration
/// </summary>
public class FeatureFlagsService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<FeatureFlagsService> _logger;
    private readonly Dictionary<string, bool> _featureFlagsCache;

    public FeatureFlagsService(IConfiguration configuration, ILogger<FeatureFlagsService> logger)
    {
        _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _featureFlagsCache = [];
    }

    /// <summary>
    /// Check if a feature flag is enabled
    /// </summary>
    /// <param name="flagName">Name of the feature flag (e.g., "AGENT_MODE_ENABLED")</param>
    /// <param name="defaultValue">Default value if flag not found</param>
    /// <returns>True if feature is enabled, false otherwise</returns>
    public bool IsFeatureEnabled(string flagName, bool defaultValue = true)
    {
        // Check cache first
        if (_featureFlagsCache.TryGetValue(flagName, out var cachedValue))
        {
            return cachedValue;
        }

        // Try to get from configuration
        try
        {
            var configValue = _configuration[$"Values:{flagName}"]
                ?? _configuration[flagName]
                ?? (defaultValue ? "true" : "false");

            var isEnabled = bool.TryParse(configValue, out var result)
                ? result
                : defaultValue;

            // Cache the value
            _featureFlagsCache[flagName] = isEnabled;

            _logger.LogDebug("Feature flag '{FlagName}' is {Status}", flagName, isEnabled ? "ENABLED" : "DISABLED");

            return isEnabled;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error reading feature flag '{FlagName}', using default value", flagName);
            return defaultValue;
        }
    }

    /// <summary>
    /// Get all available feature flags
    /// </summary>
    /// <returns>Dictionary of feature flag names and their enabled states</returns>
    public Dictionary<string, bool> GetAllFeatureFlags()
    {
        var flags = new Dictionary<string, bool>();

        try
        {
            // Define all known feature flags
            var knownFlags = new[]
            {
                "AGENT_MODE_ENABLED",
                "AZURE_OPENAI_ENABLED",
                "EXTENDED_ASSESSMENT_OPENAI_ENABLED"
            };

            foreach (var flagName in knownFlags)
            {
                flags[flagName] = IsFeatureEnabled(flagName);
            }

            _logger.LogDebug("Retrieved {Count} feature flags", flags.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving feature flags");
        }

        return flags;
    }

    /// <summary>
    /// Clear the feature flags cache (useful for testing or dynamic updates)
    /// </summary>
    public void ClearCache()
    {
        _featureFlagsCache.Clear();
        _logger.LogDebug("Feature flags cache cleared");
    }
}
