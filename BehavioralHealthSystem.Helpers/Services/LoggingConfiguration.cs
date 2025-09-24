using Microsoft.Extensions.DependencyInjection;

namespace BehavioralHealthSystem.Services;

/// <summary>
/// Logging configuration and setup service for consistent application-wide logging
/// </summary>
public static class LoggingConfiguration
{
    /// <summary>
    /// Configure structured logging with consistent patterns
    /// </summary>
    public static void ConfigureStructuredLogging(
        IServiceCollection services,
        bool isDevelopment = false)
    {
        // Configure logging levels
        services.Configure<LoggerFilterOptions>(options =>
        {
            // Clear default rules
            options.Rules.Clear();
            
            // Set minimum log levels
            options.Rules.Add(new LoggerFilterRule(null, null, LogLevel.Information, null));
            
            // Reduce noise from framework components
            options.Rules.Add(new LoggerFilterRule("Microsoft", null, LogLevel.Warning, null));
            options.Rules.Add(new LoggerFilterRule("Microsoft.Hosting.Lifetime", null, LogLevel.Information, null));
            options.Rules.Add(new LoggerFilterRule("System", null, LogLevel.Warning, null));
            
            // Enable detailed logging for our application
            options.Rules.Add(new LoggerFilterRule("BehavioralHealthSystem", null, 
                isDevelopment ? LogLevel.Debug : LogLevel.Information, null));
            
            // Enable detailed HTTP client logging in development
            if (isDevelopment)
            {
                options.Rules.Add(new LoggerFilterRule("System.Net.Http.HttpClient", null, LogLevel.Debug, null));
            }
            
            // Performance-related logging
            options.Rules.Add(new LoggerFilterRule("BehavioralHealthSystem.Performance", null, LogLevel.Information, null));
            
            // Security-related logging (always enabled)
            options.Rules.Add(new LoggerFilterRule("BehavioralHealthSystem.Security", null, LogLevel.Warning, null));
        });

        // Register structured logging service
        services.AddSingleton<StructuredLoggingService>();
        services.AddSingleton<IPerformanceLogger, PerformanceLogger>();
    }

    /// <summary>
    /// Get standard logging configuration for the application
    /// </summary>
    public static LoggerFilterOptions GetStandardLoggingConfiguration(bool isDevelopment = false)
    {
        var options = new LoggerFilterOptions();
        
        // Set minimum log levels
        options.Rules.Add(new LoggerFilterRule(null, null, LogLevel.Information, null));
        
        // Reduce noise from framework components
        options.Rules.Add(new LoggerFilterRule("Microsoft", null, LogLevel.Warning, null));
        options.Rules.Add(new LoggerFilterRule("Microsoft.Hosting.Lifetime", null, LogLevel.Information, null));
        options.Rules.Add(new LoggerFilterRule("System", null, LogLevel.Warning, null));
        
        // Enable detailed logging for our application
        options.Rules.Add(new LoggerFilterRule("BehavioralHealthSystem", null, 
            isDevelopment ? LogLevel.Debug : LogLevel.Information, null));
        
        // Performance and security logging
        options.Rules.Add(new LoggerFilterRule("BehavioralHealthSystem.Performance", null, LogLevel.Information, null));
        options.Rules.Add(new LoggerFilterRule("BehavioralHealthSystem.Security", null, LogLevel.Warning, null));
        
        return options;
    }
}

/// <summary>
/// Performance logger for tracking operation metrics
/// </summary>
public interface IPerformanceLogger
{
    void LogOperationPerformance(string operation, TimeSpan duration, Dictionary<string, object>? context = null);
    void LogMemoryUsage(string operation, long memoryBytes);
    void LogSlowOperation(string operation, TimeSpan duration, Dictionary<string, object>? context = null);
}

/// <summary>
/// Implementation of performance logger
/// </summary>
public class PerformanceLogger : IPerformanceLogger
{
    private readonly ILogger<PerformanceLogger> _logger;
    private readonly StructuredLoggingService _structuredLogger;

    public PerformanceLogger(ILogger<PerformanceLogger> logger, StructuredLoggingService structuredLogger)
    {
        _logger = logger;
        _structuredLogger = structuredLogger;
    }

    public void LogOperationPerformance(string operation, TimeSpan duration, Dictionary<string, object>? context = null)
    {
        var memoryBefore = GC.GetTotalMemory(false);
        var memoryAfter = GC.GetTotalMemory(false);
        var memoryUsed = Math.Max(0, memoryAfter - memoryBefore);

        _structuredLogger.LogPerformanceMetrics(
            operation, 
            (long)duration.TotalMilliseconds, 
            memoryUsed, 
            context?.GetValueOrDefault(LogContextKeys.CorrelationId)?.ToString(),
            context);

        // Log slow operations with warning level
        if (duration.TotalMilliseconds > ApplicationConstants.Performance.SlowOperationThresholdMs)
        {
            LogSlowOperation(operation, duration, context);
        }
    }

    public void LogMemoryUsage(string operation, long memoryBytes)
    {
        var memoryMB = memoryBytes / (1024 * 1024);
        
        var logLevel = memoryMB > ApplicationConstants.Performance.MemoryWarningThresholdMB 
            ? LogLevel.Warning 
            : LogLevel.Information;

        using var scope = _logger.BeginScope(new Dictionary<string, object>
        {
            [LogContextKeys.Operation] = operation,
            [LogContextKeys.MemoryUsageBytes] = memoryBytes
        });

        _logger.Log(logLevel, "[{Category}] Memory usage for {Operation}: {MemoryMB}MB", 
            LogCategories.Performance, operation, memoryMB);
    }

    public void LogSlowOperation(string operation, TimeSpan duration, Dictionary<string, object>? context = null)
    {
        var logContext = new Dictionary<string, object>
        {
            [LogContextKeys.Operation] = operation,
            [LogContextKeys.ElapsedMs] = duration.TotalMilliseconds
        };

        if (context != null)
        {
            foreach (var item in context)
                logContext[item.Key] = item.Value;
        }

        using var scope = _logger.BeginScope(logContext);
        
        var logLevel = duration.TotalMilliseconds > ApplicationConstants.Performance.VerySlowOperationThresholdMs 
            ? LogLevel.Error 
            : LogLevel.Warning;

        _logger.Log(logLevel, "[{Category}] Slow operation detected: {Operation} took {ElapsedMs}ms", 
            LogCategories.Performance, operation, duration.TotalMilliseconds);
    }
}