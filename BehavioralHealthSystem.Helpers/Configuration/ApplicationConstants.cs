namespace BehavioralHealthSystem.Configuration;

/// <summary>
/// Application-wide constants to eliminate magic numbers and strings.
/// Provides centralized configuration for timeouts, limits, and common values.
/// </summary>
public static class ApplicationConstants
{
    /// <summary>
    /// HTTP client and request timeout configurations
    /// </summary>
    public static class Timeouts
    {
        /// <summary>
        /// Default HTTP client timeout for API calls (5 minutes)
        /// </summary>
        public static readonly TimeSpan HttpClientTimeout = TimeSpan.FromMinutes(5);
        
        /// <summary>
        /// Extended timeout for file download operations (10 minutes)
        /// </summary>
        public static readonly TimeSpan FileDownloadTimeout = TimeSpan.FromMinutes(10);
        
        /// <summary>
        /// Default API request timeout for Kintsugi API calls (5 minutes)
        /// </summary>
        public static readonly TimeSpan ApiRequestTimeout = TimeSpan.FromMinutes(5);
        
        /// <summary>
        /// Agent conversation estimated duration (3 minutes for comedian agent)
        /// </summary>
        public static readonly TimeSpan ComedianAgentDuration = TimeSpan.FromMinutes(3);
        
        /// <summary>
        /// Coordinator agent conversation duration (5 minutes)
        /// </summary>
        public static readonly TimeSpan CoordinatorAgentDuration = TimeSpan.FromMinutes(5);
        
        /// <summary>
        /// PHQ-2 assessment estimated duration (2 minutes)
        /// </summary>
        public static readonly TimeSpan Phq2AgentDuration = TimeSpan.FromMinutes(2);

        /// <summary>
        /// UI polling delay for batch processing status updates (2 seconds)
        /// </summary>
        public static readonly TimeSpan UiPollingDelay = TimeSpan.FromMilliseconds(2000);
    }

    /// <summary>
    /// Content type constants for HTTP requests and responses
    /// </summary>
    public static class ContentTypes
    {
        /// <summary>
        /// Application JSON content type header value
        /// </summary>
        public const string ApplicationJson = "application/json";
        
        /// <summary>
        /// Application JSON with UTF-8 charset
        /// </summary>
        public const string ApplicationJsonUtf8 = "application/json; charset=utf-8";
    }

    /// <summary>
    /// User input validation limits
    /// </summary>
    public static class UserLimits
    {
        /// <summary>
        /// Minimum allowed age for users
        /// </summary>
        public const int MinAge = 18;
        
        /// <summary>
        /// Maximum allowed age for users
        /// </summary>
        public const int MaxAge = 130;
        
        /// <summary>
        /// Minimum weight in pounds/kg depending on context
        /// </summary>
        public const int MinWeight = 10;
        
        /// <summary>
        /// Maximum weight in pounds/kg depending on context  
        /// </summary>
        public const int MaxWeight = 1000;
        
        /// <summary>
        /// Minimum age for batch processing forms
        /// </summary>
        public const int BatchProcessingMinAge = 1;
        
        /// <summary>
        /// Maximum age for batch processing forms
        /// </summary>
        public const int BatchProcessingMaxAge = 150;
    }

    /// <summary>
    /// Configuration defaults for various application settings
    /// </summary>
    public static class Defaults
    {
        /// <summary>
        /// Default Kintsugi API timeout in seconds
        /// </summary>
        public const int KintsugiTimeoutSeconds = 300;
        
        /// <summary>
        /// Default maximum retry attempts for API calls
        /// </summary>
        public const int MaxRetryAttempts = 3;
        
        /// <summary>
        /// Default retry delay in milliseconds
        /// </summary>
        public const int RetryDelayMilliseconds = 1000;
        
        /// <summary>
        /// Default polling interval for UI updates in milliseconds
        /// </summary>
        public const int PollIntervalMilliseconds = 3000;
        
        /// <summary>
        /// Maximum tokens for AI model responses
        /// </summary>
        public const int MaxTokens = 2000;

        /// <summary>
        /// Whether to include detailed error information in responses (debug mode)
        /// </summary>
        public const bool IncludeErrorDetails = false;

        /// <summary>
        /// Default culture for formatting and localization
        /// </summary>
        public const string DefaultCulture = "en-US";

        /// <summary>
        /// Default page size for paginated results
        /// </summary>
        public const int DefaultPageSize = 50;

        /// <summary>
        /// Maximum page size for paginated results
        /// </summary>
        public const int MaxPageSize = 1000;
    }

    /// <summary>
    /// Performance monitoring and alerting thresholds
    /// </summary>
    public static class Performance
    {
        /// <summary>
        /// Threshold for slow operation warnings in milliseconds (5 seconds)
        /// </summary>
        public const long SlowOperationThresholdMs = 5000;
        
        /// <summary>
        /// Threshold for very slow operation errors in milliseconds (30 seconds)
        /// </summary>
        public const long VerySlowOperationThresholdMs = 30000;
        
        /// <summary>
        /// Memory usage threshold for warnings in MB
        /// </summary>
        public const long MemoryWarningThresholdMB = 500;
        
        /// <summary>
        /// Memory usage threshold for errors in MB
        /// </summary>
        public const long MemoryErrorThresholdMB = 1000;
        
        /// <summary>
        /// Database query slow threshold in milliseconds
        /// </summary>
        public const long SlowQueryThresholdMs = 2000;
        
        /// <summary>
        /// External API slow threshold in milliseconds  
        /// </summary>
        public const long SlowApiThresholdMs = 3000;
        
        /// <summary>
        /// File operation slow threshold in milliseconds
        /// </summary>
        public const long SlowFileOperationThresholdMs = 1000;
    }

    /// <summary>
    /// Test data constants used in unit tests and examples
    /// </summary>
    public static class TestData
    {
        /// <summary>
        /// Default test ZIP code
        /// </summary>
        public const string DefaultZipCode = "12345";
        
        /// <summary>
        /// Example ZIP code used in documentation
        /// </summary>
        public const string ExampleZipCode = "90210";
    }
}