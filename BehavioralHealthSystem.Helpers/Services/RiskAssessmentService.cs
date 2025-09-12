using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Azure;
using Azure.AI.OpenAI;
using Azure.AI.OpenAI.Chat;
using OpenAI.Chat;
using BehavioralHealthSystem.Configuration;
using BehavioralHealthSystem.Models;
using BehavioralHealthSystem.Services.Interfaces;

namespace BehavioralHealthSystem.Services;

public class RiskAssessmentService : IRiskAssessmentService
{
    private readonly ILogger<RiskAssessmentService> _logger;
    private readonly AzureOpenAIOptions _openAIOptions;
    private readonly ISessionStorageService _sessionStorageService;
    private readonly JsonSerializerOptions _jsonOptions;

    public RiskAssessmentService(
        ILogger<RiskAssessmentService> logger,
        IOptions<AzureOpenAIOptions> openAIOptions,
        ISessionStorageService sessionStorageService)
    {
        _logger = logger;
        _openAIOptions = openAIOptions.Value;
        _sessionStorageService = sessionStorageService;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };
    }

    public async Task<RiskAssessment?> GenerateRiskAssessmentAsync(SessionData sessionData)
    {
        try
        {
            if (!_openAIOptions.Enabled)
            {
                _logger.LogWarning("[{MethodName}] Azure OpenAI is disabled. Skipping risk assessment generation.", nameof(GenerateRiskAssessmentAsync));
                return null;
            }

            if (string.IsNullOrEmpty(_openAIOptions.Endpoint) || string.IsNullOrEmpty(_openAIOptions.ApiKey))
            {
                _logger.LogError("[{MethodName}] Azure OpenAI configuration is incomplete.", nameof(GenerateRiskAssessmentAsync));
                return null;
            }

            var prompt = BuildRiskAssessmentPrompt(sessionData);
            var openAIResponse = await CallAzureOpenAIAsync(prompt);
            
            if (openAIResponse != null)
            {
                var riskAssessment = ParseRiskAssessmentResponse(openAIResponse);
                _logger.LogInformation("[{MethodName}] Risk assessment generated successfully for session {SessionId}", nameof(GenerateRiskAssessmentAsync), sessionData.SessionId);
                return riskAssessment;
            }
            
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error generating risk assessment for session {SessionId}", nameof(GenerateRiskAssessmentAsync), sessionData.SessionId);
            return null;
        }
    }

    public async Task<bool> UpdateSessionWithRiskAssessmentAsync(string sessionId)
    {
        try
        {
            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (sessionData == null)
            {
                _logger.LogWarning("[{MethodName}] Session {SessionId} not found for risk assessment update", nameof(UpdateSessionWithRiskAssessmentAsync), sessionId);
                return false;
            }

            // Generate risk assessment if not already present
            if (sessionData.RiskAssessment == null)
            {
                sessionData.RiskAssessment = await GenerateRiskAssessmentAsync(sessionData);
                
                if (sessionData.RiskAssessment != null)
                {
                    sessionData.UpdatedAt = DateTime.UtcNow.ToString("O");
                    var success = await _sessionStorageService.UpdateSessionDataAsync(sessionData);
                    
                    if (success)
                    {
                        _logger.LogInformation("[{MethodName}] Session {SessionId} updated with risk assessment", nameof(UpdateSessionWithRiskAssessmentAsync), sessionId);
                        return true;
                    }
                }
            }
            
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error updating session {SessionId} with risk assessment", nameof(UpdateSessionWithRiskAssessmentAsync), sessionId);
            return false;
        }
    }

    private string BuildRiskAssessmentPrompt(SessionData sessionData)
    {
        var promptBuilder = new StringBuilder();
        
        promptBuilder.AppendLine("You are a licensed mental health professional AI assistant specializing in risk assessment.");
        promptBuilder.AppendLine("Based on the following clinical data, provide a comprehensive but concise risk assessment.");
        promptBuilder.AppendLine("Your response must be in valid JSON format matching the exact structure specified.");
        promptBuilder.AppendLine();
        
        promptBuilder.AppendLine("## Clinical Data:");
        
        // Add prediction results
        if (sessionData.Prediction != null)
        {
            promptBuilder.AppendLine($"**Depression Score:** {sessionData.Prediction.PredictedScoreDepression}");
            promptBuilder.AppendLine($"**Anxiety Score:** {sessionData.Prediction.PredictedScoreAnxiety}");
            promptBuilder.AppendLine($"**Overall Score:** {sessionData.Prediction.PredictedScore}");
        }
        
        // Add analysis results and insights
        if (sessionData.AnalysisResults != null)
        {
            promptBuilder.AppendLine($"**Risk Level:** {sessionData.AnalysisResults.RiskLevel}");
            promptBuilder.AppendLine($"**Confidence:** {sessionData.AnalysisResults.Confidence}");
            
            if (sessionData.AnalysisResults.Insights.Any())
            {
                promptBuilder.AppendLine("**Clinical Insights:**");
                foreach (var insight in sessionData.AnalysisResults.Insights)
                {
                    promptBuilder.AppendLine($"- {insight}");
                }
            }
        }
        
        // Add demographic metadata if available
        if (sessionData.UserMetadata != null)
        {
            promptBuilder.AppendLine("**Patient Demographics:**");
            if (sessionData.UserMetadata.Age > 0)
                promptBuilder.AppendLine($"- Age: {sessionData.UserMetadata.Age}");
            if (!string.IsNullOrEmpty(sessionData.UserMetadata.Gender))
                promptBuilder.AppendLine($"- Gender: {sessionData.UserMetadata.Gender}");
            if (!string.IsNullOrEmpty(sessionData.UserMetadata.Race))
                promptBuilder.AppendLine($"- Race: {sessionData.UserMetadata.Race}");
            if (!string.IsNullOrEmpty(sessionData.UserMetadata.Ethnicity))
                promptBuilder.AppendLine($"- Ethnicity: {sessionData.UserMetadata.Ethnicity}");
        }
        
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("## Instructions:");
        promptBuilder.AppendLine("Provide a risk assessment that includes:");
        promptBuilder.AppendLine("1. Overall risk level (Low, Moderate, High, Critical)");
        promptBuilder.AppendLine("2. Risk score (1-10 scale where 1=lowest risk, 10=highest risk)");
        promptBuilder.AppendLine("3. Concise but detailed summary of findings");
        promptBuilder.AppendLine("4. Key risk factors identified");
        promptBuilder.AppendLine("5. Clinical recommendations");
        promptBuilder.AppendLine("6. Immediate actions if any");
        promptBuilder.AppendLine("7. Follow-up recommendations");
        promptBuilder.AppendLine("8. Confidence level (0.0-1.0)");
        promptBuilder.AppendLine();
        
        promptBuilder.AppendLine("## Required JSON Response Format:");
        promptBuilder.AppendLine("```json");
        promptBuilder.AppendLine("{");
        promptBuilder.AppendLine("  \"overallRiskLevel\": \"Low|Moderate|High|Critical\",");
        promptBuilder.AppendLine("  \"riskScore\": 1-10,");
        promptBuilder.AppendLine("  \"summary\": \"Detailed but concise clinical summary\",");
        promptBuilder.AppendLine("  \"keyFactors\": [\"factor1\", \"factor2\"],");
        promptBuilder.AppendLine("  \"recommendations\": [\"recommendation1\", \"recommendation2\"],");
        promptBuilder.AppendLine("  \"immediateActions\": [\"action1\", \"action2\"],");
        promptBuilder.AppendLine("  \"followUpRecommendations\": [\"followup1\", \"followup2\"],");
        promptBuilder.AppendLine("  \"confidenceLevel\": 0.0-1.0");
        promptBuilder.AppendLine("}");
        promptBuilder.AppendLine("```");
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("Respond with ONLY the JSON object, no additional text or formatting.");
        
        return promptBuilder.ToString();
    }

    private async Task<string?> CallAzureOpenAIAsync(string prompt)
    {
        try
        {
            var endpoint = new Uri(_openAIOptions.Endpoint);
            var apiKey = _openAIOptions.ApiKey;
            var deploymentName = _openAIOptions.DeploymentName;

            AzureOpenAIClient azureClient = new(
                endpoint,
                new AzureKeyCredential(apiKey));
            ChatClient chatClient = azureClient.GetChatClient(deploymentName);

            // Check if this is a GPT-5 model based on deployment name
            bool isGpt5Model = deploymentName.ToLowerInvariant().Contains("gpt-5");

            // Configure request options with conditional parameters based on model type
            var requestOptions = new ChatCompletionOptions()
            {
                MaxOutputTokenCount = _openAIOptions.MaxTokens
            };

            if (isGpt5Model)
            {
                // GPT-5 model has limited parameter support, using minimal configuration
                // Temperature and TopP use default values (not configurable)
            }
            else
            {
                // Non-GPT-5 models: set parameters for most deterministic results
                requestOptions.Temperature = 0.1f; // Very low temperature for deterministic output
                requestOptions.TopP = 0.1f; // Very low top-p for focused, deterministic responses
                requestOptions.FrequencyPenalty = 0;
                requestOptions.PresencePenalty = 0;
            }

            // Enable the new max_completion_tokens property (required for latest models)
#pragma warning disable AOAI001
            requestOptions.SetNewMaxCompletionTokensPropertyEnabled(true);
#pragma warning restore AOAI001

            // Prepare messages
            List<ChatMessage> messages = new List<ChatMessage>()
            {
                new SystemChatMessage("You are a licensed mental health professional AI assistant. Provide accurate, professional, and ethical clinical assessments."),
                new UserChatMessage(prompt)
            };

            // Set timeout for the HTTP client (30 seconds)
            using var cancellationTokenSource = new CancellationTokenSource(TimeSpan.FromSeconds(30));

            // Make the API call with timeout
            var response = await chatClient.CompleteChatAsync(messages, requestOptions, cancellationTokenSource.Token);
            
            if (response?.Value?.Content?.Count > 0)
            {
                var content = response.Value.Content[0].Text;
                _logger.LogInformation("[{MethodName}] Azure OpenAI API call successful. Model: {Model}, Response length: {Length}", 
                    nameof(CallAzureOpenAIAsync), isGpt5Model ? "GPT-5" : "Non-GPT-5", content?.Length ?? 0);
                
                if (string.IsNullOrWhiteSpace(content))
                {
                    _logger.LogWarning("[{MethodName}] Azure OpenAI returned successful response but content is null or empty", nameof(CallAzureOpenAIAsync));
                    return null;
                }
                
                return content;
            }
            else
            {
                _logger.LogWarning("[{MethodName}] Azure OpenAI API returned empty response. Response is null: {IsNull}, Content count: {Count}", 
                    nameof(CallAzureOpenAIAsync), response?.Value == null, response?.Value?.Content?.Count ?? 0);
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

    private RiskAssessment? ParseRiskAssessmentResponse(string response)
    {
        try
        {
            // Log the raw response for debugging
            _logger.LogDebug("[{MethodName}] Raw OpenAI response: {Response}", nameof(ParseRiskAssessmentResponse), response);
            
            if (string.IsNullOrWhiteSpace(response))
            {
                _logger.LogWarning("[{MethodName}] Received empty or whitespace response from OpenAI", nameof(ParseRiskAssessmentResponse));
                return null;
            }

            // Clean up the response - remove any markdown formatting
            var cleanResponse = response.Trim();
            if (cleanResponse.StartsWith("```json"))
            {
                cleanResponse = cleanResponse.Substring(7);
            }
            if (cleanResponse.EndsWith("```"))
            {
                cleanResponse = cleanResponse.Substring(0, cleanResponse.Length - 3);
            }
            cleanResponse = cleanResponse.Trim();

            _logger.LogDebug("[{MethodName}] Cleaned response for JSON parsing: {CleanedResponse}", nameof(ParseRiskAssessmentResponse), cleanResponse);

            if (string.IsNullOrWhiteSpace(cleanResponse))
            {
                _logger.LogWarning("[{MethodName}] Response became empty after cleaning markdown formatting", nameof(ParseRiskAssessmentResponse));
                return null;
            }

            var riskAssessment = JsonSerializer.Deserialize<RiskAssessment>(cleanResponse, _jsonOptions);
            
            if (riskAssessment != null)
            {
                riskAssessment.GeneratedAt = DateTime.UtcNow.ToString("O");
                riskAssessment.ModelVersion = $"{_openAIOptions.DeploymentName}-{_openAIOptions.ApiVersion}";
                
                // Validate and constrain values
                if (riskAssessment.RiskScore < 1) riskAssessment.RiskScore = 1;
                if (riskAssessment.RiskScore > 10) riskAssessment.RiskScore = 10;
                
                if (riskAssessment.ConfidenceLevel < 0) riskAssessment.ConfidenceLevel = 0;
                if (riskAssessment.ConfidenceLevel > 1) riskAssessment.ConfidenceLevel = 1;
                
                return riskAssessment;
            }
            
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error parsing risk assessment response. Response length: {Length}, Response: {Response}", 
                nameof(ParseRiskAssessmentResponse), response?.Length ?? 0, response);
            return null;
        }
    }
}
