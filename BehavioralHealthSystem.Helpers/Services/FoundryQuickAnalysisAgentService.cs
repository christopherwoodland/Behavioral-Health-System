using Azure.Core;
using Azure.Identity;

namespace BehavioralHealthSystem.Services;

public class FoundryQuickAnalysisAgentService : IQuickAnalysisAgentService
{
    private static readonly string[] TokenScopes = ["https://ai.azure.com/.default"];
    private readonly HttpClient _httpClient;
    private readonly TokenCredential _credential;
    private readonly FoundryQuickAnalysisOptions _options;
    private readonly ILogger<FoundryQuickAnalysisAgentService> _logger;

    public FoundryQuickAnalysisAgentService(
        HttpClient httpClient,
        IOptions<FoundryQuickAnalysisOptions> options,
        ILogger<FoundryQuickAnalysisAgentService> logger)
        : this(httpClient, new DefaultAzureCredential(), options, logger)
    {
    }

    internal FoundryQuickAnalysisAgentService(
        HttpClient httpClient,
        TokenCredential credential,
        IOptions<FoundryQuickAnalysisOptions> options,
        ILogger<FoundryQuickAnalysisAgentService> logger)
    {
        _httpClient = httpClient;
        _credential = credential;
        _options = options.Value;
        _logger = logger;
        _httpClient.Timeout = TimeSpan.FromSeconds(Math.Max(1, _options.TimeoutSeconds));
    }

    public bool IsEnabled =>
        _options.Enabled &&
        Uri.TryCreate(_options.ProjectEndpoint, UriKind.Absolute, out _) &&
        !string.IsNullOrWhiteSpace(_options.AgentName);

    public string ModelVersion => string.IsNullOrWhiteSpace(_options.AgentVersion)
        ? $"foundry-agent:{_options.AgentName}@latest"
        : $"foundry-agent:{_options.AgentName}@{_options.AgentVersion}";

    public async Task<string?> GenerateAssessmentAsync(string clinicalData, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
        {
            return null;
        }

        try
        {
            var token = await _credential.GetTokenAsync(
                new TokenRequestContext(TokenScopes),
                cancellationToken);
            var endpoint = _options.ProjectEndpoint.TrimEnd('/');
            var agentName = Uri.EscapeDataString(_options.AgentName);
            var requestUri = $"{endpoint}/agents/{agentName}/endpoint/protocols/openai/responses?api-version=v1";

            using var request = new HttpRequestMessage(HttpMethod.Post, requestUri);
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token.Token);
            request.Content = new StringContent(
                JsonSerializer.Serialize(new
                {
                    input = new[]
                    {
                        new { role = "user", content = clinicalData }
                    }
                }),
                Encoding.UTF8,
                "application/json");

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError(
                    "Foundry quick-analysis agent {AgentName} returned {StatusCode}: {ResponseBody}",
                    _options.AgentName,
                    (int)response.StatusCode,
                    responseBody);
                return null;
            }

            return ExtractOutputText(responseBody);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogError("Foundry quick-analysis agent {AgentName} timed out", _options.AgentName);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error invoking Foundry quick-analysis agent {AgentName}", _options.AgentName);
            return null;
        }
    }

    private string? ExtractOutputText(string responseBody)
    {
        using var document = JsonDocument.Parse(responseBody);
        if (!document.RootElement.TryGetProperty("output", out var output) || output.ValueKind != JsonValueKind.Array)
        {
            _logger.LogWarning("Foundry quick-analysis response did not contain an output array");
            return null;
        }

        foreach (var item in output.EnumerateArray())
        {
            if (!item.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var block in content.EnumerateArray())
            {
                if (block.TryGetProperty("type", out var type) &&
                    type.GetString() == "output_text" &&
                    block.TryGetProperty("text", out var text) &&
                    !string.IsNullOrWhiteSpace(text.GetString()))
                {
                    return text.GetString();
                }
            }
        }

        _logger.LogWarning("Foundry quick-analysis response did not contain output text");
        return null;
    }
}
