using Microsoft.Azure.Functions.Worker.Middleware;

namespace BehavioralHealthSystem.Functions.Services;

public sealed class EasyAuthAuthorizationMiddleware : IFunctionsWorkerMiddleware
{
    private readonly IApiKeyValidationService _validationService;
    private readonly ILogger<EasyAuthAuthorizationMiddleware> _logger;
    private readonly bool _isEasyAuthEnabled;

    public EasyAuthAuthorizationMiddleware(
        IApiKeyValidationService validationService,
        IConfiguration configuration,
        ILogger<EasyAuthAuthorizationMiddleware> logger)
    {
        _validationService = validationService ?? throw new ArgumentNullException(nameof(validationService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _isEasyAuthEnabled = configuration.GetValue<bool>("WEBSITE_AAD_ENABLE_MISE");
    }

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        var request = await context.GetHttpRequestDataAsync();
        if (request is null
            || !_isEasyAuthEnabled
            || request.Method.Equals("OPTIONS", StringComparison.OrdinalIgnoreCase)
            || IsPublicPath(request.Url.AbsolutePath))
        {
            await next(context);
            return;
        }

        var validation = await _validationService.ValidateRequestAsync(request);
        if (validation.IsValid)
        {
            await next(context);
            return;
        }

        _logger.LogWarning(
            "EasyAuth authorization rejected {Method} {Path} with status {StatusCode}.",
            request.Method,
            request.Url.AbsolutePath,
            (int)validation.FailureStatusCode);

        var response = request.CreateResponse(validation.FailureStatusCode);
        response.Headers.Add("Content-Type", "application/json");
        await response.WriteStringAsync(JsonSerializer.Serialize(new
        {
            error = validation.ErrorMessage ?? "Authorization failed."
        }));
        context.GetInvocationResult().Value = response;
    }

    private static bool IsPublicPath(string path)
    {
        var normalizedPath = path.TrimEnd('/');
        return normalizedPath.Equals("/api/health", StringComparison.OrdinalIgnoreCase)
            || normalizedPath.Equals("/api/feature-flags", StringComparison.OrdinalIgnoreCase)
            || normalizedPath.StartsWith("/api/feature-flags/", StringComparison.OrdinalIgnoreCase);
    }
}
