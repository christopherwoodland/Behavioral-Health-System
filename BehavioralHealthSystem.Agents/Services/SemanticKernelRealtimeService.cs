using System.ClientModel;
using System.Net.WebSockets;

namespace BehavioralHealthSystem.Agents.Services;

/// <summary>
/// Semantic Kernel service for interfacing with Azure AI Foundry GPT-Realtime endpoint
/// Provides real-time speech interaction capabilities with agent handoff support
/// </summary>
public class SemanticKernelRealtimeService : IDisposable
{
    private readonly ILogger<SemanticKernelRealtimeService> _logger;
    private readonly Kernel _kernel;
    private readonly RealtimeConfig _config;
    private ClientWebSocket? _webSocket;
    private CancellationTokenSource? _cancellationTokenSource;
    private bool _isConnected;
    private readonly List<byte[]> _audioBuffer = new();
    private string _currentAgent = "coordinator";
    private readonly SemaphoreSlim _connectionSemaphore = new(1, 1);

    // Events
    public event EventHandler<SessionCreatedEventArgs>? SessionCreated;
    public event EventHandler<AudioReceivedEventArgs>? AudioReceived;
    public event EventHandler<ConversationItemEventArgs>? ConversationItemCompleted;
    public event EventHandler<AgentHandoffEventArgs>? AgentHandoffRequested;
    public event EventHandler<ErrorEventArgs>? ErrorOccurred;
    public event EventHandler? Connected;
    public event EventHandler? Disconnected;

    public SemanticKernelRealtimeService(
        ILogger<SemanticKernelRealtimeService> logger,
        RealtimeConfig config,
        Kernel kernel)
    {
        _logger = logger;
        _config = config;
        _kernel = kernel;
        SetupHandoffFunctions();
    }

    /// <summary>
    /// Connect to Azure AI Foundry GPT-Realtime endpoint
    /// </summary>
    public async Task<bool> ConnectAsync(CancellationToken cancellationToken = default)
    {
        await _connectionSemaphore.WaitAsync(cancellationToken);
        try
        {
            if (_isConnected)
            {
                return true;
            }

            _cancellationTokenSource = new CancellationTokenSource();
            _webSocket = new ClientWebSocket();
            
            // Add authorization header
            _webSocket.Options.SetRequestHeader("Authorization", $"Bearer {_config.ApiKey}");
            _webSocket.Options.SetRequestHeader("OpenAI-Beta", "realtime=v1");

            var uri = new Uri(_config.Endpoint);
            await _webSocket.ConnectAsync(uri, cancellationToken);

            _isConnected = true;
            _logger.LogInformation("Connected to GPT-Realtime endpoint: {Endpoint}", _config.Endpoint);

            // Start listening for messages
            _ = Task.Run(() => ListenForMessagesAsync(_cancellationTokenSource.Token), cancellationToken);

            // Initialize session
            await InitializeSessionAsync(cancellationToken);

            Connected?.Invoke(this, EventArgs.Empty);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to connect to GPT-Realtime endpoint");
            ErrorOccurred?.Invoke(this, new ErrorEventArgs(ex.Message));
            return false;
        }
        finally
        {
            _connectionSemaphore.Release();
        }
    }

    /// <summary>
    /// Initialize the GPT-Realtime session with agent instructions
    /// </summary>
    private async Task InitializeSessionAsync(CancellationToken cancellationToken)
    {
        var sessionConfig = new
        {
            type = "session.update",
            session = new
            {
                modalities = new[] { "text", "audio" },
                instructions = GetAgentInstructions(_currentAgent),
                voice = _config.Voice,
                input_audio_format = "pcm16",
                output_audio_format = "pcm16",
                input_audio_transcription = new
                {
                    model = "whisper-1"
                },
                turn_detection = new
                {
                    type = "server_vad",
                    threshold = 0.5,
                    prefix_padding_ms = 300,
                    silence_duration_ms = 200
                },
                tools = GetHandoffTools()
            }
        };

        await SendMessageAsync(sessionConfig, cancellationToken);
        _logger.LogInformation("Session initialized with {Agent} agent", _currentAgent);
    }

    /// <summary>
    /// Send audio data to GPT-Realtime
    /// </summary>
    public async Task SendAudioAsync(byte[] audioData, CancellationToken cancellationToken = default)
    {
        if (!_isConnected || _webSocket == null)
        {
            _logger.LogWarning("Cannot send audio: not connected");
            return;
        }

        try
        {
            var base64Audio = Convert.ToBase64String(audioData);
            var message = new
            {
                type = "input_audio_buffer.append",
                audio = base64Audio
            };

            await SendMessageAsync(message, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending audio data");
            ErrorOccurred?.Invoke(this, new ErrorEventArgs(ex.Message));
        }
    }

    /// <summary>
    /// Commit audio buffer and trigger response generation
    /// </summary>
    public async Task CommitAudioAsync(CancellationToken cancellationToken = default)
    {
        if (!_isConnected || _webSocket == null)
        {
            return;
        }

        try
        {
            var commitMessage = new { type = "input_audio_buffer.commit" };
            await SendMessageAsync(commitMessage, cancellationToken);

            var responseMessage = new
            {
                type = "response.create",
                response = new
                {
                    modalities = new[] { "text", "audio" },
                    instructions = GetAgentInstructions(_currentAgent)
                }
            };

            await SendMessageAsync(responseMessage, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error committing audio");
            ErrorOccurred?.Invoke(this, new ErrorEventArgs(ex.Message));
        }
    }

    /// <summary>
    /// Send text message to GPT-Realtime
    /// </summary>
    public async Task SendTextMessageAsync(string text, CancellationToken cancellationToken = default)
    {
        if (!_isConnected || _webSocket == null)
        {
            return;
        }

        try
        {
            var message = new
            {
                type = "conversation.item.create",
                item = new
                {
                    type = "message",
                    role = "user",
                    content = new[]
                    {
                        new
                        {
                            type = "input_text",
                            text = text
                        }
                    }
                }
            };

            await SendMessageAsync(message, cancellationToken);
            await CreateResponseAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending text message");
            ErrorOccurred?.Invoke(this, new ErrorEventArgs(ex.Message));
        }
    }

    /// <summary>
    /// Switch to a different agent
    /// </summary>
    public async Task SwitchAgentAsync(string agentName, string reason, object? context = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var previousAgent = _currentAgent;
            _currentAgent = agentName;

            // Update session with new agent instructions
            var sessionUpdate = new
            {
                type = "session.update",
                session = new
                {
                    instructions = GetAgentInstructions(_currentAgent),
                    tools = GetHandoffTools()
                }
            };

            await SendMessageAsync(sessionUpdate, cancellationToken);

            _logger.LogInformation("Switched from {PreviousAgent} to {CurrentAgent}: {Reason}", 
                previousAgent, _currentAgent, reason);

            // Raise handoff event
            AgentHandoffRequested?.Invoke(this, new AgentHandoffEventArgs
            {
                FromAgent = previousAgent,
                ToAgent = _currentAgent,
                Reason = reason,
                Context = context
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error switching agent");
            ErrorOccurred?.Invoke(this, new ErrorEventArgs(ex.Message));
        }
    }

    /// <summary>
    /// Listen for incoming WebSocket messages
    /// </summary>
    private async Task ListenForMessagesAsync(CancellationToken cancellationToken)
    {
        var buffer = new byte[8192];
        var messageBuffer = new StringBuilder();

        try
        {
            while (_webSocket != null && _webSocket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
            {
                var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    messageBuffer.Append(message);

                    if (result.EndOfMessage)
                    {
                        await ProcessRealtimeMessageAsync(messageBuffer.ToString());
                        messageBuffer.Clear();
                    }
                }
                else if (result.MessageType == WebSocketMessageType.Close)
                {
                    _logger.LogInformation("WebSocket closed by server");
                    break;
                }
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("Message listening cancelled");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error listening for messages");
            ErrorOccurred?.Invoke(this, new ErrorEventArgs(ex.Message));
        }
        finally
        {
            _isConnected = false;
            Disconnected?.Invoke(this, EventArgs.Empty);
        }
    }

    /// <summary>
    /// Process incoming realtime messages
    /// </summary>
    private async Task ProcessRealtimeMessageAsync(string messageJson)
    {
        try
        {
            using var document = JsonDocument.Parse(messageJson);
            var root = document.RootElement;

            if (!root.TryGetProperty("type", out var typeProperty))
            {
                return;
            }

            var messageType = typeProperty.GetString();
            _logger.LogDebug("Received message type: {MessageType}", messageType);

            switch (messageType)
            {
                case "session.created":
                    SessionCreated?.Invoke(this, new SessionCreatedEventArgs { SessionId = root.GetProperty("session").GetProperty("id").GetString() ?? "" });
                    break;

                case "response.audio.delta":
                    if (root.TryGetProperty("delta", out var deltaProperty))
                    {
                        var base64Audio = deltaProperty.GetString();
                        if (!string.IsNullOrEmpty(base64Audio))
                        {
                            var audioData = Convert.FromBase64String(base64Audio);
                            AudioReceived?.Invoke(this, new AudioReceivedEventArgs { AudioData = audioData });
                        }
                    }
                    break;

                case "conversation.item.completed":
                    await HandleConversationItemCompletedAsync(root);
                    break;

                case "response.function_call_arguments.done":
                    await HandleFunctionCallAsync(root);
                    break;

                case "error":
                    var errorMessage = root.TryGetProperty("error", out var errorProp) 
                        ? errorProp.GetProperty("message").GetString() ?? "Unknown error"
                        : "Unknown error";
                    _logger.LogError("GPT-Realtime error: {Error}", errorMessage);
                    ErrorOccurred?.Invoke(this, new ErrorEventArgs(errorMessage));
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing realtime message: {Message}", messageJson);
        }
    }

    /// <summary>
    /// Handle completed conversation items
    /// </summary>
    private async Task HandleConversationItemCompletedAsync(JsonElement root)
    {
        try
        {
            var item = root.GetProperty("item");
            var role = item.GetProperty("role").GetString();
            var content = "";

            if (item.TryGetProperty("content", out var contentArray) && contentArray.ValueKind == JsonValueKind.Array)
            {
                foreach (var contentItem in contentArray.EnumerateArray())
                {
                    if (contentItem.TryGetProperty("text", out var textProp))
                    {
                        content += textProp.GetString();
                    }
                    else if (contentItem.TryGetProperty("transcript", out var transcriptProp))
                    {
                        content += transcriptProp.GetString();
                    }
                }
            }

            ConversationItemCompleted?.Invoke(this, new ConversationItemEventArgs
            {
                Role = role ?? "",
                Content = content,
                Agent = _currentAgent
            });

            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling conversation item completed");
        }
    }

    /// <summary>
    /// Handle function calls for agent handoff
    /// </summary>
    private async Task HandleFunctionCallAsync(JsonElement root)
    {
        try
        {
            if (!root.TryGetProperty("name", out var nameProperty))
            {
                return;
            }

            var functionName = nameProperty.GetString();
            if (functionName != "handoff_to_agent")
            {
                return;
            }

            if (root.TryGetProperty("arguments", out var argsProperty))
            {
                var arguments = JsonSerializer.Deserialize<HandoffArguments>(argsProperty.GetString() ?? "{}");
                if (arguments != null)
                {
                    await SwitchAgentAsync(arguments.TargetAgent, arguments.Reason, arguments.Context);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error handling function call");
        }
    }

    /// <summary>
    /// Send message to WebSocket
    /// </summary>
    private async Task SendMessageAsync(object message, CancellationToken cancellationToken)
    {
        if (_webSocket == null || _webSocket.State != WebSocketState.Open)
        {
            return;
        }

        var json = JsonSerializer.Serialize(message);
        var bytes = Encoding.UTF8.GetBytes(json);
        await _webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cancellationToken);
    }

    /// <summary>
    /// Create response request
    /// </summary>
    private async Task CreateResponseAsync(CancellationToken cancellationToken)
    {
        var message = new
        {
            type = "response.create",
            response = new
            {
                modalities = new[] { "text", "audio" },
                instructions = GetAgentInstructions(_currentAgent)
            }
        };

        await SendMessageAsync(message, cancellationToken);
    }

    /// <summary>
    /// Get agent-specific instructions
    /// </summary>
    private string GetAgentInstructions(string agentType)
    {
        return agentType switch
        {
            "coordinator" => @"
You are the Maestro, a compassionate coordinator for behavioral health services. Your role is to:
1. Welcome users and understand their needs
2. Provide general mental health support and information  
3. Assess when specialized agents are needed
4. Hand off to appropriate specialists (PHQ-2 for depression screening, comedian for mood lifting)
5. Maintain conversation flow and context

Guidelines:
- Be warm, empathetic, and professional
- Ask open-ended questions to understand user needs
- Recognize when PHQ-2 screening might be helpful
- Use humor appropriately but defer to comedian agent for intentional comedy
- Always prioritize user safety and well-being
- If user expresses suicidal thoughts, provide crisis resources immediately

Use the handoff_to_agent function when:
- User mentions depression, sadness, loss of interest → handoff to 'phq2'
- User specifically requests humor or mood lifting → handoff to 'comedian'",

            "phq2" => @"
You are a specialized agent for conducting PHQ-2 depression screenings through voice interaction.

PHQ-2 Questions:
1. 'Over the last 2 weeks, how often have you been bothered by little interest or pleasure in doing things?'
2. 'Over the last 2 weeks, how often have you been bothered by feeling down, depressed, or hopeless?'

Response options for each question:
- Not at all (0 points)
- Several days (1 point)  
- More than half the days (2 points)
- Nearly every day (3 points)

Protocol:
1. Explain the PHQ-2 screening process clearly
2. Ask questions one at a time, wait for complete responses
3. Clarify responses if unclear
4. Calculate total score (0-6)
5. Provide appropriate feedback based on score:
   - 0-2: Low risk, provide general wellness resources
   - 3+: Suggest further evaluation, provide mental health resources
6. Hand back to coordinator with results using handoff_to_agent function

Be empathetic, non-judgmental, and professional throughout the screening.",

            "comedian" => @"
You are a therapeutic comedian agent designed to provide appropriate humor and mood lifting for mental health contexts.

Guidelines:
- Use clean, uplifting humor
- Avoid sensitive topics (mental illness, trauma, etc.)
- Focus on wordplay, observational humor, and light-hearted stories
- Be responsive to user's mood and adjust humor accordingly
- Know when to be serious - mental health is important
- Always check if user wants to continue with humor
- Hand back to coordinator when humor session is complete using handoff_to_agent function

Remember: Your goal is therapeutic benefit through appropriate levity, not entertainment.",

            _ => "You are a helpful behavioral health assistant."
        };
    }

    /// <summary>
    /// Setup handoff functions for Semantic Kernel
    /// </summary>
    private void SetupHandoffFunctions()
    {
        // The handoff tools are defined in GetHandoffTools() method
        // Semantic Kernel will handle function registration automatically
    }

    /// <summary>
    /// Get handoff tools definition
    /// </summary>
    private object[] GetHandoffTools()
    {
        return new object[]
        {
            new
            {
                type = "function",
                name = "handoff_to_agent",
                description = "Hand off the conversation to a specialized agent",
                parameters = new
                {
                    type = "object",
                    properties = new
                    {
                        target_agent = new
                        {
                            type = "string",
                            @enum = new[] { "coordinator", "phq2", "comedian" },
                            description = "The agent to hand off to"
                        },
                        reason = new
                        {
                            type = "string",
                            description = "Reason for the handoff"
                        },
                        context = new
                        {
                            type = "object",
                            description = "Additional context for the handoff"
                        }
                    },
                    required = new[] { "target_agent", "reason" }
                }
            }
        };
    }

    /// <summary>
    /// Disconnect from GPT-Realtime
    /// </summary>
    public async Task DisconnectAsync()
    {
        await _connectionSemaphore.WaitAsync();
        try
        {
            _cancellationTokenSource?.Cancel();

            if (_webSocket != null)
            {
                if (_webSocket.State == WebSocketState.Open)
                {
                    await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Disconnecting", CancellationToken.None);
                }
                _webSocket.Dispose();
                _webSocket = null;
            }

            _isConnected = false;
            _logger.LogInformation("Disconnected from GPT-Realtime");
        }
        finally
        {
            _connectionSemaphore.Release();
        }
    }

    public void Dispose()
    {
        DisconnectAsync().GetAwaiter().GetResult();
        _connectionSemaphore.Dispose();
        _cancellationTokenSource?.Dispose();
    }
}

// Configuration and Event Args
public class RealtimeConfig
{
    public string Endpoint { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gpt-realtime";
    public string Voice { get; set; } = "alloy";
    public double Temperature { get; set; } = 0.7;
    public int MaxTokens { get; set; } = 1500;
}

public class SessionCreatedEventArgs : EventArgs
{
    public string SessionId { get; set; } = string.Empty;
}

public class AudioReceivedEventArgs : EventArgs
{
    public byte[] AudioData { get; set; } = Array.Empty<byte>();
}

public class ConversationItemEventArgs : EventArgs
{
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Agent { get; set; } = string.Empty;
}

public class AgentHandoffEventArgs : EventArgs
{
    public string FromAgent { get; set; } = string.Empty;
    public string ToAgent { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public object? Context { get; set; }
}

public class ErrorEventArgs : EventArgs
{
    public string Message { get; set; }

    public ErrorEventArgs(string message)
    {
        Message = message;
    }
}

public class HandoffArguments
{
    public string TargetAgent { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public object? Context { get; set; }
}