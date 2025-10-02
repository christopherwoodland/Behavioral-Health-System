using Azure;
using Azure.AI.OpenAI;
using BehavioralHealthSystem.Models;

namespace BehavioralHealthSystem.Services;

public class RiskAssessmentService : IRiskAssessmentService
{
    private readonly ILogger<RiskAssessmentService> _logger;
    private readonly AzureOpenAIOptions _openAIOptions;
    private readonly ExtendedAssessmentOpenAIOptions _extendedOpenAIOptions;
    private readonly ISessionStorageService _sessionStorageService;
    private readonly JsonSerializerOptions _jsonOptions;

    public RiskAssessmentService(
        ILogger<RiskAssessmentService> logger,
        IOptions<AzureOpenAIOptions> openAIOptions,
        IOptions<ExtendedAssessmentOpenAIOptions> extendedOpenAIOptions,
        ISessionStorageService sessionStorageService)
    {
        _logger = logger;
        _openAIOptions = openAIOptions.Value;
        _extendedOpenAIOptions = extendedOpenAIOptions.Value;
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
        
        // Add audio transcription if available
        if (!string.IsNullOrEmpty(sessionData.Transcription))
        {
            promptBuilder.AppendLine();
            promptBuilder.AppendLine("**Audio Transcription:**");
            promptBuilder.AppendLine("```");
            promptBuilder.AppendLine(sessionData.Transcription);
            promptBuilder.AppendLine("```");
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

            // Configure OpenAI client options for Azure OpenAI
            var clientOptions = new OpenAIClientOptions();

            OpenAIClient client = new OpenAIClient(
                endpoint,
                new AzureKeyCredential(apiKey),
                clientOptions);

            // Check if this is a GPT-5 model based on deployment name
            bool isGpt5Model = deploymentName.ToLowerInvariant().Contains("gpt-5");

            // Configure request options with conditional parameters based on model type
            var requestOptions = new ChatCompletionsOptions()
            {
                MaxTokens = _openAIOptions.MaxTokens,
                DeploymentName = deploymentName
            };

            requestOptions.Messages.Add(new ChatRequestSystemMessage("You are a licensed mental health professional AI assistant. Provide accurate, professional, and ethical clinical assessments."));
            requestOptions.Messages.Add(new ChatRequestUserMessage(prompt));

            if (isGpt5Model)
            {
                // GPT-5 model has limited parameter support, using minimal configuration
                // Temperature and TopP use default values (not configurable)
            }
            else
            {
                // Non-GPT-5 models: set parameters for most deterministic results
                requestOptions.Temperature = 0.1f; // Very low temperature for deterministic output
                requestOptions.NucleusSamplingFactor = 0.1f; // Very low top-p for focused, deterministic responses
                requestOptions.FrequencyPenalty = 0;
                requestOptions.PresencePenalty = 0;
            }

            // Set timeout for the HTTP client (30 seconds)
            using var cancellationTokenSource = new CancellationTokenSource(TimeSpan.FromSeconds(30));

            // Make the API call with timeout
            var response = await client.GetChatCompletionsAsync(requestOptions, cancellationTokenSource.Token);
            
            if (response?.Value?.Choices?.Count > 0)
            {
                var content = response.Value.Choices[0].Message.Content;
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
                _logger.LogWarning("[{MethodName}] Azure OpenAI API returned empty response. Response is null: {IsNull}, Choices count: {Count}", 
                    nameof(CallAzureOpenAIAsync), response?.Value == null, response?.Value?.Choices?.Count ?? 0);
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
    
    #region Extended Risk Assessment (GPT-5 with Schizophrenia Evaluation)
    
    public async Task<ExtendedRiskAssessment?> GenerateExtendedRiskAssessmentAsync(SessionData sessionData)
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        
        try
        {
            // Check if extended assessment is enabled (either dedicated config or fallback)
            bool isConfigured = (_extendedOpenAIOptions.Enabled && 
                                !string.IsNullOrEmpty(_extendedOpenAIOptions.Endpoint) && 
                                !string.IsNullOrEmpty(_extendedOpenAIOptions.ApiKey)) ||
                               (_extendedOpenAIOptions.UseFallbackToStandardConfig && _openAIOptions.Enabled);
            
            if (!isConfigured)
            {
                _logger.LogWarning("[{MethodName}] Extended assessment is not configured. Enable ExtendedAssessmentOpenAI or standard AzureOpenAI configuration.", 
                    nameof(GenerateExtendedRiskAssessmentAsync));
                return null;
            }

            var prompt = BuildExtendedRiskAssessmentPrompt(sessionData);
            
            _logger.LogInformation("[{MethodName}] Starting extended risk assessment for session {SessionId}", 
                nameof(GenerateExtendedRiskAssessmentAsync), sessionData.SessionId);
            
            var openAIResponse = await CallAzureOpenAIForExtendedAssessmentAsync(prompt);
            
            if (openAIResponse != null)
            {
                var extendedRiskAssessment = ParseExtendedRiskAssessmentResponse(openAIResponse);
                
                if (extendedRiskAssessment != null)
                {
                    stopwatch.Stop();
                    extendedRiskAssessment.ProcessingTimeMs = stopwatch.ElapsedMilliseconds;
                    
                    _logger.LogInformation("[{MethodName}] Extended risk assessment generated successfully for session {SessionId} in {ElapsedMs}ms", 
                        nameof(GenerateExtendedRiskAssessmentAsync), sessionData.SessionId, stopwatch.ElapsedMilliseconds);
                    
                    return extendedRiskAssessment;
                }
            }
            
            return null;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "[{MethodName}] Error generating extended risk assessment for session {SessionId} after {ElapsedMs}ms", 
                nameof(GenerateExtendedRiskAssessmentAsync), sessionData.SessionId, stopwatch.ElapsedMilliseconds);
            return null;
        }
    }

    public async Task<bool> UpdateSessionWithExtendedRiskAssessmentAsync(string sessionId)
    {
        try
        {
            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (sessionData == null)
            {
                _logger.LogWarning("[{MethodName}] Session {SessionId} not found for extended risk assessment update", 
                    nameof(UpdateSessionWithExtendedRiskAssessmentAsync), sessionId);
                return false;
            }

            // Generate extended risk assessment if not already present
            if (sessionData.ExtendedRiskAssessment == null)
            {
                _logger.LogInformation("[{MethodName}] Starting extended risk assessment generation for session {SessionId}", 
                    nameof(UpdateSessionWithExtendedRiskAssessmentAsync), sessionId);
                
                sessionData.ExtendedRiskAssessment = await GenerateExtendedRiskAssessmentAsync(sessionData);
                
                if (sessionData.ExtendedRiskAssessment != null)
                {
                    sessionData.UpdatedAt = DateTime.UtcNow.ToString("O");
                    var success = await _sessionStorageService.UpdateSessionDataAsync(sessionData);
                    
                    if (success)
                    {
                        _logger.LogInformation("[{MethodName}] Session {SessionId} updated with extended risk assessment", 
                            nameof(UpdateSessionWithExtendedRiskAssessmentAsync), sessionId);
                        return true;
                    }
                }
                else
                {
                    _logger.LogWarning("[{MethodName}] Extended risk assessment generation returned null for session {SessionId}", 
                        nameof(UpdateSessionWithExtendedRiskAssessmentAsync), sessionId);
                }
            }
            else
            {
                _logger.LogInformation("[{MethodName}] Session {SessionId} already has extended risk assessment", 
                    nameof(UpdateSessionWithExtendedRiskAssessmentAsync), sessionId);
            }
            
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error updating session {SessionId} with extended risk assessment", 
                nameof(UpdateSessionWithExtendedRiskAssessmentAsync), sessionId);
            return false;
        }
    }
    
    private string BuildExtendedRiskAssessmentPrompt(SessionData sessionData)
    {
        var promptBuilder = new StringBuilder();
        
        promptBuilder.AppendLine("You are a licensed mental health professional AI assistant specializing in comprehensive psychiatric assessment.");
        promptBuilder.AppendLine("Based on the following clinical data, provide a comprehensive extended risk assessment including schizophrenia evaluation.");
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
        
        // Add audio transcription if available - CRITICAL for schizophrenia assessment
        if (!string.IsNullOrEmpty(sessionData.Transcription))
        {
            promptBuilder.AppendLine();
            promptBuilder.AppendLine("**Patient Audio Transcription:**");
            promptBuilder.AppendLine("(Analyze speech patterns, organization, thought processes, and content)");
            promptBuilder.AppendLine("```");
            promptBuilder.AppendLine(sessionData.Transcription);
            promptBuilder.AppendLine("```");
        }
        else
        {
            promptBuilder.AppendLine();
            promptBuilder.AppendLine("**Note:** No audio transcription available. Assessment will be limited to available data.");
        }
        
        // Add demographic metadata if available
        if (sessionData.UserMetadata != null)
        {
            promptBuilder.AppendLine();
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
        promptBuilder.AppendLine("## Assessment Requirements:");
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("### Part 1: Standard Risk Assessment");
        promptBuilder.AppendLine("Provide comprehensive risk assessment including:");
        promptBuilder.AppendLine("1. Overall risk level (Low, Moderate, High, Critical)");
        promptBuilder.AppendLine("2. Risk score (1-10 scale)");
        promptBuilder.AppendLine("3. Detailed summary of findings");
        promptBuilder.AppendLine("4. Key risk factors");
        promptBuilder.AppendLine("5. Clinical recommendations");
        promptBuilder.AppendLine("6. Immediate actions");
        promptBuilder.AppendLine("7. Follow-up recommendations");
        promptBuilder.AppendLine("8. Confidence level (0.0-1.0)");
        promptBuilder.AppendLine();
        
        promptBuilder.AppendLine("### Part 2: Schizophrenia Assessment (DSM-5 Criteria 295.90 F20.9)");
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("Evaluate the degree to which the patient's information and transcription relates to schizophrenia based on DSM-5 diagnostic criteria:");
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("**Criterion A - Characteristic Symptoms** (Assess each symptom 0-4 scale where 0=not present, 4=severe):");
        promptBuilder.AppendLine("1. **Delusions** - False beliefs not amenable to change despite conflicting evidence");
        promptBuilder.AppendLine("2. **Hallucinations** - Perception-like experiences without external stimulus (auditory most common)");
        promptBuilder.AppendLine("3. **Disorganized Speech** - Frequent derailment, incoherence, tangentiality");
        promptBuilder.AppendLine("4. **Grossly Disorganized or Catatonic Behavior** - Childlike silliness to unpredictable agitation");
        promptBuilder.AppendLine("5. **Negative Symptoms** - Diminished emotional expression, avolition, alogia, anhedonia, asociality");
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("**Note:** At least TWO symptoms must be present for significant time during 1-month period.");
        promptBuilder.AppendLine("**Note:** At least ONE must be delusions (A1), hallucinations (A2), or disorganized speech (A3).");
        promptBuilder.AppendLine();
        
        promptBuilder.AppendLine("**Criterion B - Functional Impairment:**");
        promptBuilder.AppendLine("Assess level of functioning in major areas:");
        promptBuilder.AppendLine("- Work/occupational functioning");
        promptBuilder.AppendLine("- Interpersonal relations");
        promptBuilder.AppendLine("- Self-care");
        promptBuilder.AppendLine();
        
        promptBuilder.AppendLine("**Criterion C - Duration:**");
        promptBuilder.AppendLine("Note if information suggests continuous signs for at least 6 months (if determinable from data)");
        promptBuilder.AppendLine();
        
        promptBuilder.AppendLine("**Differential Diagnosis Considerations:**");
        promptBuilder.AppendLine("- Rule out schizoaffective disorder");
        promptBuilder.AppendLine("- Rule out depressive or bipolar disorder with psychotic features");
        promptBuilder.AppendLine("- Rule out substance/medication-induced psychotic disorder");
        promptBuilder.AppendLine("- Rule out psychotic disorder due to another medical condition");
        promptBuilder.AppendLine("- Consider autism spectrum disorder or communication disorders");
        promptBuilder.AppendLine();
        
        promptBuilder.AppendLine("**Overall Schizophrenia Likelihood Assessment:**");
        promptBuilder.AppendLine("- None: No evidence of schizophrenia-related symptoms");
        promptBuilder.AppendLine("- Minimal: Very slight indications, likely not clinically significant");
        promptBuilder.AppendLine("- Low: Some symptoms present but not meeting diagnostic criteria");
        promptBuilder.AppendLine("- Moderate: Multiple symptoms present, warrants further evaluation");
        promptBuilder.AppendLine("- High: Strong evidence of multiple criteria being met");
        promptBuilder.AppendLine("- Very High: Clear evidence of meeting DSM-5 diagnostic criteria");
        promptBuilder.AppendLine();
        
        promptBuilder.AppendLine("**IMPORTANT CLINICAL CAVEATS:**");
        promptBuilder.AppendLine("1. This is a preliminary assessment based on limited data");
        promptBuilder.AppendLine("2. Formal diagnosis requires comprehensive clinical interview and observation over time");
        promptBuilder.AppendLine("3. Cultural context must be carefully considered");
        promptBuilder.AppendLine("4. Duration criteria (6 months) cannot be fully assessed from single session data");
        promptBuilder.AppendLine("5. Differential diagnosis requires ruling out other conditions through medical evaluation");
        promptBuilder.AppendLine();
        
        // Add the complete JSON schema
        promptBuilder.AppendLine("## Required JSON Response Format:");
        promptBuilder.AppendLine("```json");
        promptBuilder.AppendLine("{");
        promptBuilder.AppendLine("  \"overallRiskLevel\": \"Low|Moderate|High|Critical\",");
        promptBuilder.AppendLine("  \"riskScore\": 1-10,");
        promptBuilder.AppendLine("  \"summary\": \"Comprehensive clinical summary\",");
        promptBuilder.AppendLine("  \"keyFactors\": [\"factor1\", \"factor2\"],");
        promptBuilder.AppendLine("  \"recommendations\": [\"recommendation1\", \"recommendation2\"],");
        promptBuilder.AppendLine("  \"immediateActions\": [\"action1\"],");
        promptBuilder.AppendLine("  \"followUpRecommendations\": [\"followup1\"],");
        promptBuilder.AppendLine("  \"confidenceLevel\": 0.0-1.0,");
        promptBuilder.AppendLine("  \"isExtended\": true,");
        promptBuilder.AppendLine("  \"schizophreniaAssessment\": {");
        promptBuilder.AppendLine("    \"overallLikelihood\": \"None|Minimal|Low|Moderate|High|Very High\",");
        promptBuilder.AppendLine("    \"confidenceScore\": 0.0-1.0,");
        promptBuilder.AppendLine("    \"assessmentSummary\": \"Detailed assessment narrative\",");
        promptBuilder.AppendLine("    \"criterionAEvaluation\": {");
        promptBuilder.AppendLine("      \"delusions\": {");
        promptBuilder.AppendLine("        \"presenceLevel\": \"Not Present|Possible|Likely|Present|Clearly Present\",");
        promptBuilder.AppendLine("        \"severity\": 0-4,");
        promptBuilder.AppendLine("        \"evidence\": [\"evidence1\"],");
        promptBuilder.AppendLine("        \"notes\": \"Additional notes\"");
        promptBuilder.AppendLine("      },");
        promptBuilder.AppendLine("      \"hallucinations\": { /* same structure */ },");
        promptBuilder.AppendLine("      \"disorganizedSpeech\": { /* same structure */ },");
        promptBuilder.AppendLine("      \"disorganizedBehavior\": { /* same structure */ },");
        promptBuilder.AppendLine("      \"negativeSymptoms\": { /* same structure */ },");
        promptBuilder.AppendLine("      \"totalSymptomsPresent\": 0-5,");
        promptBuilder.AppendLine("      \"criterionAMet\": true|false");
        promptBuilder.AppendLine("    },");
        promptBuilder.AppendLine("    \"functionalImpairment\": {");
        promptBuilder.AppendLine("      \"impairmentLevel\": \"None|Mild|Moderate|Marked|Severe\",");
        promptBuilder.AppendLine("      \"workFunctioning\": \"Assessment text\",");
        promptBuilder.AppendLine("      \"interpersonalRelations\": \"Assessment text\",");
        promptBuilder.AppendLine("      \"selfCare\": \"Assessment text\",");
        promptBuilder.AppendLine("      \"criterionBMet\": true|false");
        promptBuilder.AppendLine("    },");
        promptBuilder.AppendLine("    \"durationAssessment\": \"Assessment of duration criteria\",");
        promptBuilder.AppendLine("    \"differentialDiagnosis\": [\"consideration1\"],");
        promptBuilder.AppendLine("    \"riskFactorsIdentified\": [\"risk factor1\"],");
        promptBuilder.AppendLine("    \"recommendedActions\": [\"action1\"],");
        promptBuilder.AppendLine("    \"clinicalNotes\": [\"note1\"]");
        promptBuilder.AppendLine("  }");
        promptBuilder.AppendLine("}");
        promptBuilder.AppendLine("```");
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("Respond with ONLY the complete JSON object matching this structure. No additional text or formatting.");
        
        return promptBuilder.ToString();
    }
    
    private async Task<string?> CallAzureOpenAIForExtendedAssessmentAsync(string prompt)
    {
        try
        {
            // Determine which configuration to use
            ExtendedAssessmentOpenAIOptions effectiveConfig;
            
            if (_extendedOpenAIOptions.Enabled && 
                !string.IsNullOrEmpty(_extendedOpenAIOptions.Endpoint) && 
                !string.IsNullOrEmpty(_extendedOpenAIOptions.ApiKey))
            {
                // Use dedicated extended assessment configuration
                effectiveConfig = _extendedOpenAIOptions;
                _logger.LogInformation("[{MethodName}] Using dedicated extended assessment OpenAI configuration. Endpoint: {Endpoint}, Deployment: {Deployment}", 
                    nameof(CallAzureOpenAIForExtendedAssessmentAsync), 
                    effectiveConfig.Endpoint, 
                    effectiveConfig.DeploymentName);
            }
            else if (_extendedOpenAIOptions.UseFallbackToStandardConfig && _openAIOptions.Enabled)
            {
                // Fall back to standard configuration
                effectiveConfig = new ExtendedAssessmentOpenAIOptions
                {
                    Endpoint = _openAIOptions.Endpoint,
                    ApiKey = _openAIOptions.ApiKey,
                    DeploymentName = _openAIOptions.DeploymentName,
                    ApiVersion = _openAIOptions.ApiVersion,
                    MaxTokens = Math.Max(_openAIOptions.MaxTokens, 4000),
                    Temperature = 0.2,
                    TimeoutSeconds = 120,
                    Enabled = true
                };
                
                _logger.LogWarning("[{MethodName}] Extended assessment configuration not fully configured. Falling back to standard AzureOpenAI configuration.", 
                    nameof(CallAzureOpenAIForExtendedAssessmentAsync));
            }
            else
            {
                _logger.LogError("[{MethodName}] Neither extended assessment nor standard Azure OpenAI configuration is available or enabled.", 
                    nameof(CallAzureOpenAIForExtendedAssessmentAsync));
                return null;
            }

            var endpoint = new Uri(effectiveConfig.Endpoint);
            var apiKey = effectiveConfig.ApiKey;
            var deploymentName = effectiveConfig.DeploymentName;

            // Configure OpenAI client options for Azure OpenAI
            var clientOptions = new OpenAIClientOptions();

            OpenAIClient client = new OpenAIClient(
                endpoint,
                new AzureKeyCredential(apiKey),
                clientOptions);

            // GPT-5/O3 models have limited parameter support
            bool isAdvancedModel = deploymentName.ToLowerInvariant().Contains("gpt-5") || 
                                   deploymentName.ToLowerInvariant().Contains("o3");

            // Create request options - GPT-5/O3 doesn't support max_tokens parameter
            var requestOptions = new ChatCompletionsOptions()
            {
                DeploymentName = deploymentName
            };

            // Only set MaxTokens for non-GPT-5/O3 models
            // GPT-5/O3 uses max_completion_tokens which is not supported by this SDK version
            if (!isAdvancedModel)
            {
                requestOptions.MaxTokens = effectiveConfig.MaxTokens;
            }

            requestOptions.Messages.Add(new ChatRequestSystemMessage(
                "You are a highly experienced licensed psychiatrist and clinical psychologist with expertise in DSM-5 diagnostic criteria, " +
                "risk assessment, and differential diagnosis. Provide thorough, evidence-based, professional clinical assessments while " +
                "acknowledging the limitations of assessment based on available data."));
            requestOptions.Messages.Add(new ChatRequestUserMessage(prompt));

            // Set other parameters only for non-advanced models
            if (!isAdvancedModel)
            {
                requestOptions.Temperature = (float)effectiveConfig.Temperature;
                requestOptions.NucleusSamplingFactor = 0.2f;
                requestOptions.FrequencyPenalty = 0;
                requestOptions.PresencePenalty = 0;
            }

            // Use configured timeout
            using var cancellationTokenSource = new CancellationTokenSource(TimeSpan.FromSeconds(effectiveConfig.TimeoutSeconds));

            _logger.LogInformation("[{MethodName}] Calling Azure OpenAI for extended assessment. Model: {Model}, Deployment: {Deployment}, MaxTokens: {MaxTokens}, Timeout: {Timeout}s", 
                nameof(CallAzureOpenAIForExtendedAssessmentAsync), 
                isAdvancedModel ? "GPT-5/O3" : "Standard", 
                deploymentName,
                isAdvancedModel ? "omitted (GPT-5/O3 limitation)" : effectiveConfig.MaxTokens.ToString(),
                effectiveConfig.TimeoutSeconds);

            var response = await client.GetChatCompletionsAsync(requestOptions, cancellationTokenSource.Token);
            
            if (response?.Value?.Choices?.Count > 0)
            {
                var content = response.Value.Choices[0].Message.Content;
                _logger.LogInformation("[{MethodName}] Extended assessment API call successful. Response length: {Length}", 
                    nameof(CallAzureOpenAIForExtendedAssessmentAsync), content?.Length ?? 0);
                
                if (string.IsNullOrWhiteSpace(content))
                {
                    _logger.LogWarning("[{MethodName}] Azure OpenAI returned successful response but content is null or empty", 
                        nameof(CallAzureOpenAIForExtendedAssessmentAsync));
                    return null;
                }
                
                return content;
            }
            else
            {
                _logger.LogWarning("[{MethodName}] Azure OpenAI API returned empty response", 
                    nameof(CallAzureOpenAIForExtendedAssessmentAsync));
                return null;
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogError("[{MethodName}] Extended assessment API call timed out after {Timeout} seconds", 
                nameof(CallAzureOpenAIForExtendedAssessmentAsync),
                _extendedOpenAIOptions.TimeoutSeconds);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error calling Azure OpenAI API for extended assessment", 
                nameof(CallAzureOpenAIForExtendedAssessmentAsync));
            return null;
        }
    }
    
    private ExtendedRiskAssessment? ParseExtendedRiskAssessmentResponse(string response)
    {
        try
        {
            _logger.LogDebug("[{MethodName}] Parsing extended risk assessment response. Length: {Length}", 
                nameof(ParseExtendedRiskAssessmentResponse), response?.Length ?? 0);
            
            if (string.IsNullOrWhiteSpace(response))
            {
                _logger.LogWarning("[{MethodName}] Received empty or whitespace response", nameof(ParseExtendedRiskAssessmentResponse));
                return null;
            }

            // Clean up the response
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

            if (string.IsNullOrWhiteSpace(cleanResponse))
            {
                _logger.LogWarning("[{MethodName}] Response became empty after cleaning", nameof(ParseExtendedRiskAssessmentResponse));
                return null;
            }

            var extendedAssessment = JsonSerializer.Deserialize<ExtendedRiskAssessment>(cleanResponse, _jsonOptions);
            
            if (extendedAssessment != null)
            {
                extendedAssessment.GeneratedAt = DateTime.UtcNow.ToString("O");
                
                // Use extended config if enabled, otherwise use fallback standard config
                if (_extendedOpenAIOptions.Enabled && 
                    !string.IsNullOrEmpty(_extendedOpenAIOptions.Endpoint) && 
                    !string.IsNullOrEmpty(_extendedOpenAIOptions.ApiKey))
                {
                    extendedAssessment.ModelVersion = $"{_extendedOpenAIOptions.DeploymentName}-{_extendedOpenAIOptions.ApiVersion}";
                }
                else
                {
                    extendedAssessment.ModelVersion = $"{_openAIOptions.DeploymentName}-{_openAIOptions.ApiVersion}";
                }
                
                extendedAssessment.IsExtended = true;
                
                // Validate and constrain values
                if (extendedAssessment.RiskScore < 1) extendedAssessment.RiskScore = 1;
                if (extendedAssessment.RiskScore > 10) extendedAssessment.RiskScore = 10;
                
                if (extendedAssessment.ConfidenceLevel < 0) extendedAssessment.ConfidenceLevel = 0;
                if (extendedAssessment.ConfidenceLevel > 1) extendedAssessment.ConfidenceLevel = 1;
                
                // Validate schizophrenia assessment if present
                if (extendedAssessment.SchizophreniaAssessment != null)
                {
                    if (extendedAssessment.SchizophreniaAssessment.ConfidenceScore < 0) 
                        extendedAssessment.SchizophreniaAssessment.ConfidenceScore = 0;
                    if (extendedAssessment.SchizophreniaAssessment.ConfidenceScore > 1) 
                        extendedAssessment.SchizophreniaAssessment.ConfidenceScore = 1;
                }
                
                _logger.LogInformation("[{MethodName}] Extended risk assessment parsed successfully", 
                    nameof(ParseExtendedRiskAssessmentResponse));
                
                return extendedAssessment;
            }
            
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error parsing extended risk assessment response. Response length: {Length}", 
                nameof(ParseExtendedRiskAssessmentResponse), response?.Length ?? 0);
            return null;
        }
    }
    
    #endregion
    
    #region Multi-Condition Assessment Methods
    
    public async Task<MultiConditionExtendedRiskAssessment?> GenerateMultiConditionAssessmentAsync(SessionData sessionData, List<string> selectedConditions, AssessmentOptions? options = null)
    {
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        
        try
        {
            _logger.LogInformation("[{MethodName}] Starting multi-condition assessment for session {SessionId} with {ConditionCount} conditions", 
                nameof(GenerateMultiConditionAssessmentAsync), sessionData.SessionId, selectedConditions.Count);

            if (!selectedConditions.Any())
            {
                _logger.LogWarning("[{MethodName}] No conditions selected for assessment", nameof(GenerateMultiConditionAssessmentAsync));
                return null;
            }

            // Check if extended assessment is available
            bool isConfigured = (_extendedOpenAIOptions.Enabled && 
                                !string.IsNullOrEmpty(_extendedOpenAIOptions.Endpoint) && 
                                !string.IsNullOrEmpty(_extendedOpenAIOptions.ApiKey)) ||
                               (_extendedOpenAIOptions.UseFallbackToStandardConfig && _openAIOptions.Enabled);
            
            if (!isConfigured)
            {
                _logger.LogWarning("[{MethodName}] Extended assessment is not available. Cannot perform multi-condition assessment.", 
                    nameof(GenerateMultiConditionAssessmentAsync));
                return null;
            }

            // Get DSM-5 condition data (this would normally use the DSM5DataService)
            var conditionData = await GetConditionDataAsync(selectedConditions);
            
            // Build the multi-condition assessment prompt
            var prompt = BuildMultiConditionAssessmentPrompt(sessionData, conditionData, options);
            
            // Call extended Azure OpenAI
            var openAIResponse = await CallAzureOpenAIForExtendedAssessmentAsync(prompt);
            
            if (openAIResponse != null)
            {
                var multiConditionAssessment = ParseMultiConditionAssessmentResponse(openAIResponse, selectedConditions);
                
                if (multiConditionAssessment != null)
                {
                    stopwatch.Stop();
                    multiConditionAssessment.ProcessingTimeMs = stopwatch.ElapsedMilliseconds;
                    multiConditionAssessment.EvaluatedConditions = selectedConditions;
                    multiConditionAssessment.IsMultiCondition = true;
                    
                    _logger.LogInformation("[{MethodName}] Multi-condition assessment generated successfully for session {SessionId} in {ElapsedMs}ms", 
                        nameof(GenerateMultiConditionAssessmentAsync), sessionData.SessionId, stopwatch.ElapsedMilliseconds);
                    
                    return multiConditionAssessment;
                }
            }
            
            return null;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            _logger.LogError(ex, "[{MethodName}] Error generating multi-condition assessment for session {SessionId} in {ElapsedMs}ms", 
                nameof(GenerateMultiConditionAssessmentAsync), sessionData.SessionId, stopwatch.ElapsedMilliseconds);
            return null;
        }
    }

    public async Task<bool> UpdateSessionWithMultiConditionAssessmentAsync(string sessionId, List<string> selectedConditions, AssessmentOptions? options = null)
    {
        try
        {
            var sessionData = await _sessionStorageService.GetSessionDataAsync(sessionId);
            if (sessionData == null)
            {
                _logger.LogWarning("[{MethodName}] Session {SessionId} not found for multi-condition assessment update", 
                    nameof(UpdateSessionWithMultiConditionAssessmentAsync), sessionId);
                return false;
            }

            // Generate multi-condition assessment if not already present
            if (sessionData.MultiConditionAssessment == null)
            {
                sessionData.MultiConditionAssessment = await GenerateMultiConditionAssessmentAsync(sessionData, selectedConditions, options);
                
                if (sessionData.MultiConditionAssessment != null)
                {
                    sessionData.UpdatedAt = DateTime.UtcNow.ToString("O");
                    var success = await _sessionStorageService.UpdateSessionDataAsync(sessionData);
                    
                    if (success)
                    {
                        _logger.LogInformation("[{MethodName}] Session {SessionId} updated with multi-condition assessment", 
                            nameof(UpdateSessionWithMultiConditionAssessmentAsync), sessionId);
                        return true;
                    }
                }
            }
            else
            {
                _logger.LogInformation("[{MethodName}] Session {SessionId} already has multi-condition assessment", 
                    nameof(UpdateSessionWithMultiConditionAssessmentAsync), sessionId);
                return true;
            }
            
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error updating session {SessionId} with multi-condition assessment", 
                nameof(UpdateSessionWithMultiConditionAssessmentAsync), sessionId);
            return false;
        }
    }

    private async Task<Dictionary<string, DSM5ConditionData>> GetConditionDataAsync(List<string> conditionIds)
    {
        // This would normally call the DSM5DataService
        // For now, return a placeholder - this will be implemented when DSM5DataService is integrated
        var conditionData = new Dictionary<string, DSM5ConditionData>();
        
        foreach (var conditionId in conditionIds)
        {
            // Create placeholder condition data
            conditionData[conditionId] = new DSM5ConditionData
            {
                Id = conditionId,
                Name = $"Condition {conditionId}",
                Code = "000.00 (F00.0)",
                Category = "Mental Health Condition",
                Description = "Placeholder description for condition",
                DiagnosticCriteria = new List<DSM5DiagnosticCriterion>
                {
                    new DSM5DiagnosticCriterion
                    {
                        CriterionId = "A",
                        Title = "Primary Criterion",
                        Description = "Primary diagnostic criterion for this condition",
                        IsRequired = true
                    }
                }
            };
        }
        
        return conditionData;
    }

    private string BuildMultiConditionAssessmentPrompt(SessionData sessionData, Dictionary<string, DSM5ConditionData> conditionData, AssessmentOptions? options)
    {
        var promptBuilder = new StringBuilder();
        
        promptBuilder.AppendLine("# Multi-Condition Mental Health Assessment");
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("You are a clinical AI assistant specializing in comprehensive mental health assessments. Evaluate the patient's data against multiple DSM-5 conditions simultaneously.");
        promptBuilder.AppendLine();
        
        // Add session data context
        promptBuilder.AppendLine("## Patient Data:");
        promptBuilder.AppendLine();
        
        if (sessionData.Prediction != null)
        {
            promptBuilder.AppendLine($"**Depression Score:** {sessionData.Prediction.PredictedScoreDepression}");
            promptBuilder.AppendLine($"**Anxiety Score:** {sessionData.Prediction.PredictedScoreAnxiety}");
            promptBuilder.AppendLine($"**Risk Level:** {sessionData.Prediction.PredictedScore}");
            promptBuilder.AppendLine();
        }

        if (!string.IsNullOrEmpty(sessionData.Transcription))
        {
            promptBuilder.AppendLine("**Audio Transcription:**");
            promptBuilder.AppendLine(sessionData.Transcription);
            promptBuilder.AppendLine();
        }
        
        if (sessionData.UserMetadata != null)
        {
            promptBuilder.AppendLine("**Demographics:**");
            promptBuilder.AppendLine($"Age: {sessionData.UserMetadata.Age}");
            promptBuilder.AppendLine($"Gender: {sessionData.UserMetadata.Gender}");
            promptBuilder.AppendLine($"Ethnicity: {sessionData.UserMetadata.Ethnicity}");
            promptBuilder.AppendLine();
        }

        // Add conditions to evaluate
        promptBuilder.AppendLine("## DSM-5 Conditions to Evaluate:");
        promptBuilder.AppendLine();
        
        foreach (var condition in conditionData.Values)
        {
            promptBuilder.AppendLine($"### {condition.Name} ({condition.Code})");
            promptBuilder.AppendLine($"**Category:** {condition.Category}");
            promptBuilder.AppendLine($"**Description:** {condition.Description}");
            promptBuilder.AppendLine();
            
            promptBuilder.AppendLine("**Diagnostic Criteria:**");
            foreach (var criterion in condition.DiagnosticCriteria)
            {
                promptBuilder.AppendLine($"**Criterion {criterion.CriterionId}** ({(criterion.IsRequired ? "Required" : "Optional")}): {criterion.Title}");
                promptBuilder.AppendLine($"  {criterion.Description}");
                
                if (criterion.SubCriteria.Any())
                {
                    foreach (var subCriterion in criterion.SubCriteria)
                    {
                        promptBuilder.AppendLine($"  {subCriterion.Id}. {subCriterion.Name}: {subCriterion.Description}");
                    }
                }
                promptBuilder.AppendLine();
            }
        }

        // Add assessment instructions
        promptBuilder.AppendLine("## Assessment Instructions:");
        promptBuilder.AppendLine();
        promptBuilder.AppendLine("For each condition, provide a comprehensive evaluation including:");
        promptBuilder.AppendLine("1. Overall likelihood assessment (None, Minimal, Low, Moderate, High, Very High)");
        promptBuilder.AppendLine("2. Confidence score (0.0-1.0)");
        promptBuilder.AppendLine("3. Risk score for the condition (1-10)");
        promptBuilder.AppendLine("4. Detailed assessment summary");
        promptBuilder.AppendLine("5. Evaluation of each diagnostic criterion");
        promptBuilder.AppendLine("6. Evidence supporting or contradicting the diagnosis");
        promptBuilder.AppendLine("7. Recommended clinical actions");
        promptBuilder.AppendLine("8. Differential diagnosis considerations");
        promptBuilder.AppendLine();
        
        promptBuilder.AppendLine("Provide your response in valid JSON format matching the MultiConditionExtendedRiskAssessment structure.");
        
        return promptBuilder.ToString();
    }

    private MultiConditionExtendedRiskAssessment? ParseMultiConditionAssessmentResponse(string response, List<string> selectedConditions)
    {
        try
        {
            _logger.LogDebug("[{MethodName}] Parsing multi-condition assessment response. Length: {Length}", 
                nameof(ParseMultiConditionAssessmentResponse), response.Length);

            // Extract JSON from response if it contains markdown formatting
            var jsonContent = response.Trim();
            if (jsonContent.StartsWith("```json"))
            {
                jsonContent = jsonContent.Substring(7);
            }
            if (jsonContent.EndsWith("```"))
            {
                jsonContent = jsonContent.Substring(0, jsonContent.Length - 3);
            }
            jsonContent = jsonContent.Trim();
            
            if (string.IsNullOrEmpty(jsonContent))
            {
                _logger.LogWarning("[{MethodName}] No valid JSON found in response", nameof(ParseMultiConditionAssessmentResponse));
                return null;
            }

            var assessment = JsonSerializer.Deserialize<MultiConditionExtendedRiskAssessment>(jsonContent, _jsonOptions);
            
            if (assessment != null)
            {
                // Ensure basic properties are set
                assessment.IsExtended = true;
                assessment.IsMultiCondition = true;
                assessment.GeneratedAt = DateTime.UtcNow.ToString("O");
                
                // Validate and populate missing data
                ValidateMultiConditionAssessment(assessment, selectedConditions);
                
                _logger.LogInformation("[{MethodName}] Successfully parsed multi-condition assessment with {ConditionCount} evaluations", 
                    nameof(ParseMultiConditionAssessmentResponse), assessment.ConditionAssessments.Count);
                
                return assessment;
            }
            
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "[{MethodName}] Error parsing multi-condition assessment response. Response length: {Length}", 
                nameof(ParseMultiConditionAssessmentResponse), response?.Length ?? 0);
            return null;
        }
    }

    private void ValidateMultiConditionAssessment(MultiConditionExtendedRiskAssessment assessment, List<string> selectedConditions)
    {
        // Ensure we have assessments for all selected conditions
        var missingConditions = selectedConditions.Except(assessment.ConditionAssessments.Select(c => c.ConditionId)).ToList();
        
        foreach (var missingCondition in missingConditions)
        {
            _logger.LogWarning("[{MethodName}] Missing assessment for condition: {ConditionId}", 
                nameof(ValidateMultiConditionAssessment), missingCondition);
            
            // Add placeholder assessment
            assessment.ConditionAssessments.Add(new ConditionAssessmentResult
            {
                ConditionId = missingCondition,
                ConditionName = $"Condition {missingCondition}",
                OverallLikelihood = "None",
                ConfidenceScore = 0.0,
                AssessmentSummary = "Assessment could not be completed for this condition"
            });
        }
        
        // Calculate overall risk based on highest individual risk
        if (assessment.ConditionAssessments.Any())
        {
            var highestRisk = assessment.ConditionAssessments.Max(c => c.ConditionRiskScore);
            assessment.RiskScore = Math.Max(assessment.RiskScore, highestRisk);
            
            var highestRiskCondition = assessment.ConditionAssessments
                .OrderByDescending(c => c.ConditionRiskScore)
                .FirstOrDefault();
            
            if (highestRiskCondition != null)
            {
                assessment.HighestRiskCondition = highestRiskCondition.ConditionName;
            }
        }
    }
    
    #endregion
}
