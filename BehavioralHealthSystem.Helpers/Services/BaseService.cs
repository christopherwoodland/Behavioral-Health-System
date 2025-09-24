namespace BehavioralHealthSystem.Services;

/// <summary>
/// Base class for services that need common dependency injection patterns and lifecycle management
/// </summary>
public abstract class BaseService : IDisposable
{
    protected readonly ILogger _logger;
    protected readonly StructuredLoggingService? _structuredLogger;
    protected readonly IPerformanceLogger? _performanceLogger;
    protected readonly IConfiguration Configuration;
    private bool _disposed;

    protected BaseService(
        ILogger logger, 
        IConfiguration configuration,
        StructuredLoggingService? structuredLogger = null,
        IPerformanceLogger? performanceLogger = null)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        Configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
        
        // For now, make these nullable until we can properly inject them
        _structuredLogger = structuredLogger;
        _performanceLogger = performanceLogger;
    }

    /// <summary>
    /// Initialize service with async operations
    /// </summary>
    public virtual async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[{ClassName}] Initializing service", GetType().Name);
        
        try
        {
            await OnInitializeAsync(cancellationToken);
            _logger.LogInformation("[{ClassName}] Service initialized successfully", GetType().Name);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ClassName}] Failed to initialize service", GetType().Name);
            throw;
        }
    }

    /// <summary>
    /// Override this method to implement service-specific initialization
    /// </summary>
    protected virtual Task OnInitializeAsync(CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    /// <summary>
    /// Check if service is properly initialized
    /// </summary>
    public virtual bool IsInitialized { get; protected set; } = false;

    /// <summary>
    /// Validate required configuration values
    /// </summary>
    protected void ValidateRequiredConfiguration(params string[] configKeys)
    {
        var missingConfigs = new List<string>();
        
        foreach (var key in configKeys)
        {
            var value = Configuration[key];
            if (string.IsNullOrEmpty(value))
            {
                missingConfigs.Add(key);
            }
        }

        if (missingConfigs.Any())
        {
            var message = $"Missing required configuration values: {string.Join(", ", missingConfigs)}";
            _logger.LogError("[{ClassName}] {Message}", GetType().Name, message);
            throw new InvalidOperationException(message);
        }
    }

    /// <summary>
    /// Get configuration value with optional default
    /// </summary>
    protected T? GetConfigurationValue<T>(string key, T? defaultValue = default)
    {
        try
        {
            var value = Configuration[key];
            if (string.IsNullOrEmpty(value))
            {
                _logger.LogDebug("[{ClassName}] Configuration key '{Key}' not found, using default: {DefaultValue}", 
                    GetType().Name, key, defaultValue);
                return defaultValue;
            }

            if (typeof(T) == typeof(string))
            {
                return (T)(object)value;
            }

            if (typeof(T) == typeof(int) || typeof(T) == typeof(int?))
            {
                if (int.TryParse(value, out var intValue))
                {
                    return (T)(object)intValue;
                }
            }

            if (typeof(T) == typeof(bool) || typeof(T) == typeof(bool?))
            {
                if (bool.TryParse(value, out var boolValue))
                {
                    return (T)(object)boolValue;
                }
            }

            if (typeof(T) == typeof(TimeSpan) || typeof(T) == typeof(TimeSpan?))
            {
                if (TimeSpan.TryParse(value, out var timeSpanValue))
                {
                    return (T)(object)timeSpanValue;
                }
            }

            // Try generic conversion
            var convertedValue = (T)Convert.ChangeType(value, typeof(T));
            return convertedValue;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[{ClassName}] Error converting configuration key '{Key}' to type {Type}, using default: {DefaultValue}", 
                GetType().Name, key, typeof(T).Name, defaultValue);
            return defaultValue;
        }
    }

    /// <summary>
    /// Log service configuration for debugging
    /// </summary>
    protected void LogServiceConfiguration(string serviceName, Dictionary<string, object?> configValues)
    {
        var configSummary = string.Join(", ", configValues.Select(kvp => 
        {
            var value = kvp.Value switch
            {
                string str when str.Contains("key", StringComparison.OrdinalIgnoreCase) || 
                                str.Contains("secret", StringComparison.OrdinalIgnoreCase) ||
                                str.Contains("password", StringComparison.OrdinalIgnoreCase) ||
                                str.Contains("token", StringComparison.OrdinalIgnoreCase) => "[REDACTED]",
                string str => str,
                null => "[NULL]",
                _ => kvp.Value.ToString()
            };
            return $"{kvp.Key}={value}";
        }));

        _logger.LogInformation("[{ClassName}] {ServiceName} configured: {Configuration}", 
            GetType().Name, serviceName, configSummary);
    }

    /// <summary>
    /// Execute operation with standard error handling and logging
    /// </summary>
    protected async Task<TResult> ExecuteWithLoggingAsync<TResult>(
        Func<Task<TResult>> operation,
        string operationName,
        Dictionary<string, object>? context = null)
    {
        var contextInfo = context != null ? string.Join(", ", context.Select(kvp => $"{kvp.Key}={kvp.Value}")) : "";
        
        try
        {
            _logger.LogInformation("[{ClassName}] Starting {Operation} {Context}", 
                GetType().Name, operationName, contextInfo);
            
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            var result = await operation();
            stopwatch.Stop();
            
            _logger.LogInformation("[{ClassName}] Completed {Operation} in {ElapsedMs}ms {Context}", 
                GetType().Name, operationName, stopwatch.ElapsedMilliseconds, contextInfo);
            
            return result;
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("[{ClassName}] {Operation} was cancelled {Context}", 
                GetType().Name, operationName, contextInfo);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ClassName}] Error in {Operation} {Context}", 
                GetType().Name, operationName, contextInfo);
            throw;
        }
    }

    /// <summary>
    /// Execute operation with standard error handling and logging (void return)
    /// </summary>
    protected async Task ExecuteWithLoggingAsync(
        Func<Task> operation,
        string operationName,
        Dictionary<string, object>? context = null)
    {
        var contextInfo = context != null ? string.Join(", ", context.Select(kvp => $"{kvp.Key}={kvp.Value}")) : "";
        
        try
        {
            _logger.LogInformation("[{ClassName}] Starting {Operation} {Context}", 
                GetType().Name, operationName, contextInfo);
            
            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            await operation();
            stopwatch.Stop();
            
            _logger.LogInformation("[{ClassName}] Completed {Operation} in {ElapsedMs}ms {Context}", 
                GetType().Name, operationName, stopwatch.ElapsedMilliseconds, contextInfo);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("[{ClassName}] {Operation} was cancelled {Context}", 
                GetType().Name, operationName, contextInfo);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{ClassName}] Error in {Operation} {Context}", 
                GetType().Name, operationName, contextInfo);
            throw;
        }
    }

    /// <summary>
    /// Ensure service is initialized before operation
    /// </summary>
    protected void EnsureInitialized()
    {
        if (!IsInitialized)
        {
            var message = "Service not initialized. Call InitializeAsync first.";
            _logger.LogError("[{ClassName}] {Message}", GetType().Name, message);
            throw new InvalidOperationException(message);
        }
    }

    /// <summary>
    /// Create scoped logger for specific operations
    /// </summary>
    protected IDisposable? CreateLogScope(string operationName, Dictionary<string, object>? properties = null)
    {
        var scope = new Dictionary<string, object>
        {
            ["Operation"] = operationName,
            ["Service"] = GetType().Name
        };

        if (properties != null)
        {
            foreach (var prop in properties)
            {
                scope[prop.Key] = prop.Value;
            }
        }

        return _logger.BeginScope(scope);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed && disposing)
        {
            _logger.LogInformation("[{ClassName}] Disposing service", GetType().Name);
            OnDispose();
            _disposed = true;
        }
    }

    /// <summary>
    /// Override this method to implement service-specific cleanup
    /// </summary>
    protected virtual void OnDispose()
    {
        // Override in derived classes for cleanup
    }

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }
}
