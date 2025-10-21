namespace BehavioralHealthSystem.Functions;

/// <summary>
/// Azure Function for retrieving feature flags configuration.
/// Provides a public endpoint for frontend clients to query feature availability.
/// </summary>
public class FeatureFlagsFunction
{
    private readonly ILogger<FeatureFlagsFunction> _logger;
    private readonly FeatureFlagsService _featureFlagsService;
    private readonly JsonSerializerOptions _jsonOptions;

    /// <summary>
    /// Initializes a new instance of the <see cref="FeatureFlagsFunction"/> class.
    /// </summary>
    /// <param name="logger">Logger for diagnostics and monitoring.</param>
    /// <param name="featureFlagsService">Service for retrieving feature flag status.</param>
    /// <exception cref="ArgumentNullException">Thrown when logger or featureFlagsService is null.</exception>
    public FeatureFlagsFunction(
        ILogger<FeatureFlagsFunction> logger,
        FeatureFlagsService featureFlagsService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _featureFlagsService = featureFlagsService ?? throw new ArgumentNullException(nameof(featureFlagsService));
        _jsonOptions = JsonSerializerOptionsFactory.Default;
    }

    /// <summary>
    /// HTTP endpoint for retrieving all feature flags.
    /// Returns the current status of all available features.
    /// </summary>
    /// <param name="req">The HTTP request.</param>
    /// <returns>
    /// HTTP 200 (OK) with feature flags dictionary.
    /// Example: { "AGENT_MODE_ENABLED": true, "ANOTHER_FEATURE": false }
    /// </returns>
    /// <remarks>
    /// This endpoint is public (AuthorizationLevel.Anonymous) to allow unauthenticated
    /// clients to check feature availability. Feature flags should not contain sensitive information.
    /// </remarks>
    [Function("GetFeatureFlags")]
    public async Task<HttpResponseData> GetFeatureFlags(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "feature-flags")] HttpRequestData req)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Feature flags requested", nameof(GetFeatureFlags));

            var flags = _featureFlagsService.GetAllFeatureFlags();

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json");
            response.Headers.Add("Cache-Control", "public, max-age=300"); // Cache for 5 minutes

            await response.WriteStringAsync(JsonSerializer.Serialize(flags, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error retrieving feature flags", nameof(GetFeatureFlags));

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            var errorResult = new
            {
                Error = "Failed to retrieve feature flags",
                Message = ex.Message
            };

            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(errorResult, _jsonOptions));
            return errorResponse;
        }
    }

    /// <summary>
    /// HTTP endpoint for checking a specific feature flag.
    /// Returns whether a single feature is enabled.
    /// </summary>
    /// <param name="req">The HTTP request.</param>
    /// <param name="flagName">Name of the feature flag to check (e.g., "AGENT_MODE_ENABLED").</param>
    /// <returns>
    /// HTTP 200 (OK) with feature status.
    /// Example: { "AGENT_MODE_ENABLED": true }
    /// </returns>
    [Function("GetFeatureFlag")]
    public async Task<HttpResponseData> GetFeatureFlag(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "feature-flags/{flagName}")] HttpRequestData req,
        string flagName)
    {
        try
        {
            _logger.LogInformation("[{FunctionName}] Checking feature flag: {FlagName}", nameof(GetFeatureFlag), flagName);

            var isEnabled = _featureFlagsService.IsFeatureEnabled(flagName);

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json");
            response.Headers.Add("Cache-Control", "public, max-age=300"); // Cache for 5 minutes

            var result = new Dictionary<string, bool> { { flagName, isEnabled } };
            await response.WriteStringAsync(JsonSerializer.Serialize(result, _jsonOptions));
            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{FunctionName}] Error checking feature flag: {FlagName}", nameof(GetFeatureFlag), flagName);

            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            var errorResult = new
            {
                Error = "Failed to check feature flag",
                Message = ex.Message
            };

            await errorResponse.WriteStringAsync(JsonSerializer.Serialize(errorResult, _jsonOptions));
            return errorResponse;
        }
    }
}
