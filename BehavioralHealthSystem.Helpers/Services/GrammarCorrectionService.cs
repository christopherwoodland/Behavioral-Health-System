using System.ClientModel;
using Azure;
using Azure.AI.OpenAI;
using Azure.Identity;
using OpenAI.Chat;

namespace BehavioralHealthSystem.Services;

public class GrammarCorrectionService : IGrammarCorrectionService
{
    private readonly ILogger<GrammarCorrectionService> _logger;
    private readonly AzureOpenAIOptions _openAIOptions;

    public GrammarCorrectionService(
        ILogger<GrammarCorrectionService> logger,
        IOptions<AzureOpenAIOptions> openAIOptions)
    {
        _logger = logger;
        _openAIOptions = openAIOptions.Value;
    }

    public async Task<string?> CorrectTextAsync(string text)
    {
        try
        {
            if (!_openAIOptions.Enabled)
            {
                _logger.LogWarning("[{MethodName}] Azure OpenAI is disabled. Skipping grammar correction.", nameof(CorrectTextAsync));
                return text; // Return original text if service is disabled
            }

            if (string.IsNullOrEmpty(_openAIOptions.Endpoint))
            {
                _logger.LogError("[{MethodName}] Azure OpenAI configuration is incomplete.", nameof(CorrectTextAsync));
                return null;
            }

            var prompt = BuildGrammarCorrectionPrompt(text);
            var correctedText = await CallAzureOpenAIAsync(prompt);

            if (correctedText != null)
            {
                _logger.LogInformation("[{MethodName}] Grammar correction completed successfully", nameof(CorrectTextAsync));
                return correctedText;
            }
            else
            {
                _logger.LogWarning("[{MethodName}] Azure OpenAI returned null response", nameof(CorrectTextAsync));
                return null;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error correcting text grammar", nameof(CorrectTextAsync));
            return null;
        }
    }

    private string BuildGrammarCorrectionPrompt(string text)
    {
        return $@"Please correct the grammar, spelling, and punctuation in the following text while preserving the original meaning and tone.
Return only the corrected text without any explanations or additional comments.

Text to correct:
{text}

Corrected text:";
    }

    private async Task<string?> CallAzureOpenAIAsync(string prompt)
    {
        try
        {
            var endpoint = new Uri(_openAIOptions.Endpoint);
            var deploymentName = _openAIOptions.DeploymentName;

            // Use managed identity authentication (DefaultAzureCredential) or API key (local dev)
            AzureOpenAIClient azureClient = !string.IsNullOrEmpty(_openAIOptions.ApiKey)
                ? new AzureOpenAIClient(endpoint, new ApiKeyCredential(_openAIOptions.ApiKey))
                : new AzureOpenAIClient(endpoint, new DefaultAzureCredential());

            var chatClient = azureClient.GetChatClient(deploymentName);

            // Check if this is a GPT-5 model based on deployment name
            bool isGpt5Model = deploymentName.ToLowerInvariant().Contains("gpt-5");

            // Build messages
            var messages = new List<ChatMessage>
            {
                new SystemChatMessage("You are an expert editor and proofreader. Your task is to correct grammar, spelling, and punctuation while preserving the original meaning and tone. Return only the corrected text without any explanations."),
                new UserChatMessage(prompt)
            };

            // Configure request options
            // GPT-5 models don't support max_tokens - they use max_completion_tokens internally
            var requestOptions = new ChatCompletionOptions();

            if (!isGpt5Model)
            {
                // Non-GPT-5 models: set max tokens and parameters for most deterministic results
                requestOptions.MaxOutputTokenCount = 1000;
                requestOptions.Temperature = 0.2f;
                requestOptions.TopP = 0.2f;
                requestOptions.FrequencyPenalty = 0;
                requestOptions.PresencePenalty = 0;
            }

            // Set timeout for the HTTP client (30 seconds)
            using var cancellationTokenSource = new CancellationTokenSource(TimeSpan.FromSeconds(30));

            // Make the API call with timeout
            ClientResult<ChatCompletion> response = await chatClient.CompleteChatAsync(messages, requestOptions, cancellationTokenSource.Token);

            if (response?.Value != null)
            {
                var content = response.Value.Content?.Count > 0 ? response.Value.Content[0].Text : null;
                _logger.LogInformation("[{MethodName}] Azure OpenAI API call successful. Model: {Model}, Response length: {Length}",
                    nameof(CallAzureOpenAIAsync), isGpt5Model ? "GPT-5" : "Non-GPT-5", content?.Length ?? 0);

                if (string.IsNullOrWhiteSpace(content))
                {
                    _logger.LogWarning("[{MethodName}] Azure OpenAI returned successful response but content is null or empty", nameof(CallAzureOpenAIAsync));
                    return null;
                }

                return content.Trim();
            }
            else
            {
                _logger.LogWarning("[{MethodName}] Azure OpenAI API returned empty response.",
                    nameof(CallAzureOpenAIAsync));
                return null;
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogError("[{MethodName}] Azure OpenAI API call timed out after 30 seconds", nameof(CallAzureOpenAIAsync));
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error calling Azure OpenAI API", nameof(CallAzureOpenAIAsync));
            return null;
        }
    }
}
