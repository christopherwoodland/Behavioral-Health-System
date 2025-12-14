using Azure.AI.Projects;
using Azure.Identity;
using BehavioralHealthSystem.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BehavioralHealthSystem.Services;

/// <summary>
/// Service for grammar correction using Azure AI Foundry agents
/// </summary>
public class FoundryGrammarService : IFoundryGrammarService
{
    private readonly ILogger<FoundryGrammarService> _logger;
    private readonly FoundryAgentOptions _options;

    public FoundryGrammarService(
        ILogger<FoundryGrammarService> logger,
        IOptions<FoundryAgentOptions> options)
    {
        _logger = logger;
        _options = options.Value;
    }

    /// <inheritdoc />
    public bool IsAvailable()
    {
        return _options.Enabled && !string.IsNullOrEmpty(_options.ProjectEndpoint);
    }

    /// <inheritdoc />
    public async Task<string?> CorrectGrammarAsync(string text)
    {
        try
        {
            if (!IsAvailable())
            {
                _logger.LogWarning("[{MethodName}] Foundry grammar service is not available. Enabled: {Enabled}, Endpoint configured: {HasEndpoint}",
                    nameof(CorrectGrammarAsync), _options.Enabled, !string.IsNullOrEmpty(_options.ProjectEndpoint));
                return null;
            }

            if (string.IsNullOrWhiteSpace(text))
            {
                _logger.LogWarning("[{MethodName}] Text is null or empty", nameof(CorrectGrammarAsync));
                return text;
            }

            _logger.LogInformation("[{MethodName}] Calling Foundry grammar agent '{AgentName}' for text correction. Text length: {Length}",
                nameof(CorrectGrammarAsync), _options.GrammarAgentName, text.Length);

            // Connect to the Foundry project using DefaultAzureCredential (supports managed identity and local dev)
            var projectClient = new AIProjectClient(
                endpoint: new Uri(_options.ProjectEndpoint),
                tokenProvider: new DefaultAzureCredential());

            // Get the grammar agent
            var agentRecordResult = projectClient.Agents.GetAgent(_options.GrammarAgentName);
            var agentRecord = agentRecordResult.Value;
            _logger.LogDebug("[{MethodName}] Agent retrieved (name: {AgentName}, id: {AgentId})",
                nameof(CorrectGrammarAsync), agentRecord.Name, agentRecord.Id);

            // Get a response client configured for this agent
            var responseClient = projectClient.OpenAI.GetProjectResponsesClientForAgent(agentRecord);

            // Call the agent to correct the grammar
            var responseResult = await responseClient.CreateResponseAsync(text);
            var response = responseResult.Value;

            var correctedText = response.GetOutputText();

            if (string.IsNullOrEmpty(correctedText))
            {
                _logger.LogWarning("[{MethodName}] Agent returned empty response", nameof(CorrectGrammarAsync));
                return null;
            }

            _logger.LogInformation("[{MethodName}] Grammar correction completed successfully. Original length: {OriginalLength}, Corrected length: {CorrectedLength}",
                nameof(CorrectGrammarAsync), text.Length, correctedText.Length);

            return correctedText;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error calling Foundry grammar agent", nameof(CorrectGrammarAsync));
            return null;
        }
    }
}
