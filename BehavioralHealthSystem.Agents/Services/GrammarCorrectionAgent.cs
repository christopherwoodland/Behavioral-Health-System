using System.Runtime.CompilerServices;

namespace BehavioralHealthSystem.Agents.Services;

/// <summary>
/// Grammar Correction Agent using the Microsoft Agent Framework.
/// Corrects grammar, syntax, and structure while preserving original meaning.
/// </summary>
public class GrammarCorrectionAgent : IGrammarCorrectionAgent
{
    private readonly ILogger<GrammarCorrectionAgent> _logger;
    private readonly AgentOptions _agentOptions;
    private readonly GrammarAgentOptions _grammarOptions;
    private readonly AIAgent? _agent;
    private readonly bool _isAvailable;

    private const string DefaultInstructions = """
        You are a professional grammar correction assistant. Your role is to take user-provided text
        and return a corrected version with proper grammar, syntax, and structure while preserving
        the original meaning and tone.

        ## Core Functions:
        1. **Grammar Correction**: Fix subject-verb agreement, punctuation, capitalization, and tense errors.
        2. **Spelling Correction**: Correct any spelling mistakes.
        3. **Structural Improvement**: Ensure logical sentence flow and readability.
        4. **Non-Intrusive Changes**: Do NOT alter the intended meaning or add new content.

        ## Guidelines:
        - Preserve the original tone (formal, casual, technical, etc.)
        - Maintain the original paragraph structure and formatting
        - Do not add information that wasn't in the original text
        - Do not change the meaning of sentences
        - Be conservative with changes - only fix clear errors
        - If the text is already correct, return it unchanged

        ## Response Format:
        - Return ONLY the corrected text
        - Do not include explanations unless specifically requested
        - Do not add introductory phrases like "Here is the corrected text:"
        """;

    private const string InstructionsWithExplanations = """
        You are a professional grammar correction assistant. Your role is to take user-provided text
        and return a corrected version with proper grammar, syntax, and structure while preserving
        the original meaning and tone.

        ## Core Functions:
        1. **Grammar Correction**: Fix subject-verb agreement, punctuation, capitalization, and tense errors.
        2. **Spelling Correction**: Correct any spelling mistakes.
        3. **Structural Improvement**: Ensure logical sentence flow and readability.
        4. **Non-Intrusive Changes**: Do NOT alter the intended meaning or add new content.

        ## Guidelines:
        - Preserve the original tone (formal, casual, technical, etc.)
        - Maintain the original paragraph structure and formatting
        - Do not add information that wasn't in the original text
        - Do not change the meaning of sentences
        - Be conservative with changes - only fix clear errors
        - If the text is already correct, state that no changes were needed

        ## Response Format:
        Provide your response in two sections:

        **CORRECTED TEXT:**
        [The corrected text here]

        **CORRECTIONS MADE:**
        [Brief list of corrections made, or "No corrections needed" if the text was already correct]
        """;

    public GrammarCorrectionAgent(
        ILogger<GrammarCorrectionAgent> logger,
        IOptions<AgentOptions> agentOptions,
        IOptions<GrammarAgentOptions> grammarOptions)
    {
        _logger = logger;
        _agentOptions = agentOptions.Value;
        _grammarOptions = grammarOptions.Value;

        try
        {
            if (!_agentOptions.Enabled)
            {
                _logger.LogInformation("Agents are disabled via configuration");
                _isAvailable = false;
                return;
            }

            if (string.IsNullOrWhiteSpace(_agentOptions.Endpoint))
            {
                _logger.LogWarning("Agent endpoint is not configured");
                _isAvailable = false;
                return;
            }

            _agent = CreateAgent();
            _isAvailable = _agent != null;

            if (_isAvailable)
            {
                _logger.LogInformation(
                    "Grammar Correction Agent initialized successfully. Endpoint: {Endpoint}, Model: {Model}, UseApiKey: {UseApiKey}",
                    _agentOptions.Endpoint,
                    _agentOptions.ModelDeployment,
                    _agentOptions.UseApiKey);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize Grammar Correction Agent");
            _isAvailable = false;
        }
    }

    public bool IsAvailable => _isAvailable;

    public async Task<GrammarCorrectionResult> CorrectGrammarAsync(
        string text,
        bool includeExplanations = false,
        CancellationToken cancellationToken = default)
    {
        if (!_isAvailable || _agent == null)
        {
            return GrammarCorrectionResult.Failed(text, "Grammar correction agent is not available");
        }

        if (string.IsNullOrWhiteSpace(text))
        {
            return GrammarCorrectionResult.Successful(text, text);
        }

        try
        {
            _logger.LogDebug("Correcting grammar for text of length {Length}", text.Length);

            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(_agentOptions.TimeoutSeconds));

            // Use the appropriate agent based on whether explanations are requested
            var agent = includeExplanations ? CreateAgentWithExplanations() : _agent;

            var response = await agent.RunAsync(text);
            var correctedText = response?.Text ?? text;

            if (includeExplanations)
            {
                return ParseResponseWithExplanations(text, correctedText);
            }

            return GrammarCorrectionResult.Successful(text, correctedText);
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Grammar correction timed out after {Timeout} seconds", _agentOptions.TimeoutSeconds);
            return GrammarCorrectionResult.Failed(text, "Grammar correction request timed out");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during grammar correction");
            return GrammarCorrectionResult.Failed(text, $"Grammar correction failed: {ex.Message}");
        }
    }

    public async IAsyncEnumerable<string> CorrectGrammarStreamingAsync(
        string text,
        bool includeExplanations = false,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        if (!_isAvailable || _agent == null)
        {
            yield return "Error: Grammar correction agent is not available";
            yield break;
        }

        if (string.IsNullOrWhiteSpace(text))
        {
            yield return text;
            yield break;
        }

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(TimeSpan.FromSeconds(_agentOptions.TimeoutSeconds));

        var agent = includeExplanations ? CreateAgentWithExplanations() : _agent;

        await foreach (var update in agent.RunStreamingAsync(text).WithCancellation(cts.Token))
        {
            if (!string.IsNullOrEmpty(update?.Text))
            {
                yield return update.Text;
            }
        }
    }

    private AIAgent CreateAgent()
    {
        var instructions = _grammarOptions.CustomInstructions ?? DefaultInstructions;
        var chatClient = CreateIChatClient();

        // Create the ChatClientAgent directly using IChatClient
        return new ChatClientAgent(
            chatClient,
            new ChatClientAgentOptions
            {
                Name = _grammarOptions.AgentName,
                ChatOptions = CreateChatOptions(instructions)
            });
    }

    private AIAgent CreateAgentWithExplanations()
    {
        var chatClient = CreateIChatClient();

        // Create the ChatClientAgent directly using IChatClient
        return new ChatClientAgent(
            chatClient,
            new ChatClientAgentOptions
            {
                Name = $"{_grammarOptions.AgentName}_WithExplanations",
                ChatOptions = CreateChatOptions(InstructionsWithExplanations)
            });
    }

    /// <summary>
    /// Creates ChatOptions with model-specific parameters.
    /// Only includes Temperature and MaxTokens if the model supports them.
    /// </summary>
    private ChatOptions CreateChatOptions(string instructions)
    {
        var options = new ChatOptions
        {
            Instructions = instructions
        };

        // Only set temperature if the model supports it and a value is configured
        if (_agentOptions.SupportsTemperature && _agentOptions.Temperature.HasValue)
        {
            options.Temperature = _agentOptions.Temperature.Value;
        }

        // Only set max tokens if the model supports it and a value is configured
        if (_agentOptions.SupportsMaxTokens && _agentOptions.MaxTokens.HasValue)
        {
            options.MaxOutputTokens = _agentOptions.MaxTokens.Value;
        }

        return options;
    }

    /// <summary>
    /// Creates an IChatClient from Azure OpenAI.
    /// Uses API key authentication for local development and managed identity for production.
    /// </summary>
    private IChatClient CreateIChatClient()
    {
        AzureOpenAIClient azureClient;

        if (_agentOptions.UseApiKey)
        {
            _logger.LogDebug("Creating Azure OpenAI client with API key authentication");
            azureClient = new AzureOpenAIClient(
                new Uri(_agentOptions.Endpoint),
                new AzureKeyCredential(_agentOptions.ApiKey!));
        }
        else
        {
            _logger.LogDebug("Creating Azure OpenAI client with DefaultAzureCredential (managed identity)");
            azureClient = new AzureOpenAIClient(
                new Uri(_agentOptions.Endpoint),
                new DefaultAzureCredential());
        }

        // Get the ChatClient and convert to IChatClient
        return azureClient.GetChatClient(_agentOptions.ModelDeployment).AsIChatClient();
    }

    private static GrammarCorrectionResult ParseResponseWithExplanations(string originalText, string response)
    {
        const string correctedTextMarker = "**CORRECTED TEXT:**";
        const string correctionsMarker = "**CORRECTIONS MADE:**";

        var correctedTextIndex = response.IndexOf(correctedTextMarker, StringComparison.OrdinalIgnoreCase);
        var correctionsIndex = response.IndexOf(correctionsMarker, StringComparison.OrdinalIgnoreCase);

        if (correctedTextIndex == -1 || correctionsIndex == -1)
        {
            // If the response doesn't follow the expected format, treat the whole thing as corrected text
            return GrammarCorrectionResult.Successful(originalText, response.Trim());
        }

        var correctedTextStart = correctedTextIndex + correctedTextMarker.Length;
        var correctedText = response[correctedTextStart..correctionsIndex].Trim();
        var explanations = response[(correctionsIndex + correctionsMarker.Length)..].Trim();

        return new GrammarCorrectionResult
        {
            OriginalText = originalText,
            CorrectedText = correctedText,
            Explanations = explanations,
            Success = true
        };
    }
}
