using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Agents;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.Extensions.Logging;
using System.ComponentModel;
using System.Text.Json;

namespace BehavioralHealthSystem.Agents.Specialized;

/// <summary>
/// Semantic Kernel therapeutic comedian agent for providing appropriate humor and mood lifting
/// Designed specifically for mental health contexts with clinical sensitivity
/// </summary>
public class SemanticKernelComedianAgent : IDisposable
{
    private readonly ILogger<SemanticKernelComedianAgent> _logger;
    private readonly Kernel _kernel;
    private readonly ChatCompletionAgent _agent;
    private readonly Dictionary<string, ComedySession> _activeSessions = new();
    
    // Humor categories and content management
    private readonly Dictionary<string, List<string>> _humorCategories;
    private readonly HashSet<string> _sensitiveTopics;

    // Events
    public event EventHandler<JokeDeliveredEventArgs>? JokeDelivered;
    public event EventHandler<MoodCheckEventArgs>? MoodChecked;
    public event EventHandler<ComedySessionEndedEventArgs>? SessionEnded;
    public event EventHandler<ComedyErrorEventArgs>? ErrorOccurred;

    public SemanticKernelComedianAgent(
        ILogger<SemanticKernelComedianAgent> logger,
        Kernel kernel)
    {
        _logger = logger;
        _kernel = kernel;
        
        // Initialize humor content and guidelines
        _humorCategories = InitializeHumorCategories();
        _sensitiveTopics = InitializeSensitiveTopics();
        
        // Create the specialized comedian agent
        _agent = CreateComedianAgent();
    }

    /// <summary>
    /// Start a therapeutic comedy session
    /// </summary>
    public async Task<string> StartComedySessionAsync(
        string sessionId,
        string userId,
        string? userMood = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var comedySessionId = Guid.NewGuid().ToString();
            var comedySession = new ComedySession
            {
                ComedySessionId = comedySessionId,
                SessionId = sessionId,
                UserId = userId,
                StartTime = DateTime.UtcNow,
                UserMood = userMood ?? "neutral",
                Status = ComedySessionStatus.Active,
                InteractionHistory = new List<ComedyInteraction>(),
                HumorPreferences = new List<string>()
            };

            _activeSessions[comedySessionId] = comedySession;

            _logger.LogInformation("Started comedy session {ComedySessionId} for session {SessionId} with mood {Mood}", 
                comedySessionId, sessionId, userMood);

            // Deliver welcome message and assess user's readiness for humor
            await DeliverWelcomeAsync(comedySessionId, cancellationToken);

            return comedySessionId;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error starting comedy session for session {SessionId}", sessionId);
            ErrorOccurred?.Invoke(this, new ComedyErrorEventArgs(ex.Message));
            throw;
        }
    }

    /// <summary>
    /// Process user interaction and deliver appropriate humor
    /// </summary>
    public async Task ProcessInteractionAsync(
        string comedySessionId,
        string userInput,
        CancellationToken cancellationToken = default)
    {
        if (!_activeSessions.TryGetValue(comedySessionId, out var session))
        {
            _logger.LogWarning("Comedy session {ComedySessionId} not found", comedySessionId);
            return;
        }

        try
        {
            // Record user interaction
            session.InteractionHistory.Add(new ComedyInteraction
            {
                Type = "user_input",
                Content = userInput,
                Timestamp = DateTime.UtcNow
            });

            // Analyze user's mood and readiness for humor
            var moodAnalysis = await AnalyzeMoodAsync(userInput, cancellationToken);
            session.UserMood = moodAnalysis.CurrentMood;

            // Generate appropriate humor response
            var humorResponse = await GenerateHumorResponseAsync(session, userInput, moodAnalysis, cancellationToken);
            
            if (humorResponse != null)
            {
                // Record humor delivery
                session.InteractionHistory.Add(new ComedyInteraction
                {
                    Type = "humor_delivery",
                    Content = humorResponse.Content,
                    Category = humorResponse.Category,
                    Timestamp = DateTime.UtcNow
                });

                session.LastActivity = DateTime.UtcNow;

                _logger.LogInformation("Delivered humor in session {ComedySessionId}: {Category}", 
                    comedySessionId, humorResponse.Category);

                JokeDelivered?.Invoke(this, new JokeDeliveredEventArgs
                {
                    ComedySessionId = comedySessionId,
                    HumorResponse = humorResponse,
                    UserMood = session.UserMood
                });
            }
            else
            {
                // Not appropriate for humor right now
                await CheckUserWellbeingAsync(comedySessionId, userInput, cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing interaction for comedy session {ComedySessionId}", comedySessionId);
            ErrorOccurred?.Invoke(this, new ComedyErrorEventArgs(ex.Message));
        }
    }

    /// <summary>
    /// Deliver welcome message and assess humor readiness
    /// </summary>
    private async Task DeliverWelcomeAsync(string comedySessionId, CancellationToken cancellationToken)
    {
        if (!_activeSessions.TryGetValue(comedySessionId, out var session))
        {
            return;
        }

        var welcomeMessage = GenerateWelcomeMessage(session.UserMood);
        
        session.InteractionHistory.Add(new ComedyInteraction
        {
            Type = "welcome",
            Content = welcomeMessage,
            Timestamp = DateTime.UtcNow
        });

        JokeDelivered?.Invoke(this, new JokeDeliveredEventArgs
        {
            ComedySessionId = comedySessionId,
            HumorResponse = new HumorResponse
            {
                Content = welcomeMessage,
                Category = "welcome",
                Appropriateness = "high"
            },
            UserMood = session.UserMood
        });

        await Task.CompletedTask;
    }

    /// <summary>
    /// Analyze user's mood and readiness for humor using Semantic Kernel
    /// </summary>
    private async Task<MoodAnalysis> AnalyzeMoodAsync(string userInput, CancellationToken cancellationToken)
    {
        try
        {
            var moodFunction = _kernel.CreateFunctionFromMethod(
                (string input) => AnalyzeUserMood(input),
                "AnalyzeUserMood",
                "Analyze user's mood and readiness for therapeutic humor"
            );

            var result = await moodFunction.InvokeAsync(_kernel, new()
            {
                ["input"] = userInput
            }, cancellationToken);

            var moodData = result.GetValue<string>();
            if (string.IsNullOrEmpty(moodData))
            {
                return new MoodAnalysis { CurrentMood = "neutral", ReadinessForHumor = 0.5 };
            }

            var analysis = JsonSerializer.Deserialize<MoodAnalysis>(moodData);
            return analysis ?? new MoodAnalysis { CurrentMood = "neutral", ReadinessForHumor = 0.5 };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error analyzing mood for input: {Input}", userInput);
            return new MoodAnalysis { CurrentMood = "neutral", ReadinessForHumor = 0.5 };
        }
    }

    /// <summary>
    /// Semantic Kernel function to analyze user mood
    /// </summary>
    [KernelFunction("AnalyzeUserMood")]
    [Description("Analyze user's mood and readiness for therapeutic humor")]
    public string AnalyzeUserMood(
        [Description("User's text input to analyze")] string input)
    {
        try
        {
            var lowerInput = input.ToLowerInvariant();
            string mood = "neutral";
            double readiness = 0.5;

            // Mood indicators
            if (lowerInput.Contains("sad") || lowerInput.Contains("depressed") || lowerInput.Contains("down"))
            {
                mood = "sad";
                readiness = 0.3; // Lower readiness for humor when very sad
            }
            else if (lowerInput.Contains("angry") || lowerInput.Contains("frustrated") || lowerInput.Contains("mad"))
            {
                mood = "angry";
                readiness = 0.2; // Very low readiness when angry
            }
            else if (lowerInput.Contains("anxious") || lowerInput.Contains("worried") || lowerInput.Contains("stressed"))
            {
                mood = "anxious";
                readiness = 0.4; // Moderate readiness, gentle humor might help
            }
            else if (lowerInput.Contains("happy") || lowerInput.Contains("good") || lowerInput.Contains("great"))
            {
                mood = "positive";
                readiness = 0.8; // High readiness when already feeling good
            }
            else if (lowerInput.Contains("okay") || lowerInput.Contains("fine") || lowerInput.Contains("alright"))
            {
                mood = "neutral";
                readiness = 0.6; // Good opportunity for mood lifting
            }

            // Check for humor cues
            if (lowerInput.Contains("laugh") || lowerInput.Contains("funny") || lowerInput.Contains("joke"))
            {
                readiness = Math.Min(readiness + 0.3, 1.0);
            }

            // Check for resistance to humor
            if (lowerInput.Contains("not in the mood") || lowerInput.Contains("don't want to") || lowerInput.Contains("serious"))
            {
                readiness = Math.Max(readiness - 0.4, 0.0);
            }

            var analysis = new MoodAnalysis
            {
                CurrentMood = mood,
                ReadinessForHumor = readiness,
                EmotionalIndicators = ExtractEmotionalIndicators(lowerInput),
                RecommendedHumorType = DetermineHumorType(mood, readiness)
            };

            return JsonSerializer.Serialize(analysis);
        }
        catch
        {
            return JsonSerializer.Serialize(new MoodAnalysis { CurrentMood = "neutral", ReadinessForHumor = 0.5 });
        }
    }

    /// <summary>
    /// Generate appropriate humor response based on user state
    /// </summary>
    private async Task<HumorResponse?> GenerateHumorResponseAsync(
        ComedySession session,
        string userInput,
        MoodAnalysis moodAnalysis,
        CancellationToken cancellationToken)
    {
        try
        {
            // Don't deliver humor if readiness is too low
            if (moodAnalysis.ReadinessForHumor < 0.3)
            {
                return null;
            }

            var humorType = moodAnalysis.RecommendedHumorType;
            var content = await SelectHumorContentAsync(humorType, session, cancellationToken);

            if (string.IsNullOrEmpty(content))
            {
                return null;
            }

            return new HumorResponse
            {
                Content = content,
                Category = humorType,
                Appropriateness = DetermineAppropriateness(moodAnalysis.ReadinessForHumor),
                Timing = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating humor response");
            return null;
        }
    }

    /// <summary>
    /// Select appropriate humor content
    /// </summary>
    private async Task<string> SelectHumorContentAsync(
        string humorType,
        ComedySession session,
        CancellationToken cancellationToken)
    {
        try
        {
            var humorFunction = _kernel.CreateFunctionFromMethod(
                (string type, string mood, string history) => GenerateTherapeuticHumor(type, mood, history),
                "GenerateTherapeuticHumor",
                "Generate appropriate therapeutic humor based on type and context"
            );

            var historyContext = string.Join("; ", session.InteractionHistory.TakeLast(3).Select(i => i.Content));

            var result = await humorFunction.InvokeAsync(_kernel, new()
            {
                ["type"] = humorType,
                ["mood"] = session.UserMood,
                ["history"] = historyContext
            }, cancellationToken);

            return result.GetValue<string>() ?? "";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error selecting humor content");
            return "";
        }
    }

    /// <summary>
    /// Semantic Kernel function to generate therapeutic humor
    /// </summary>
    [KernelFunction("GenerateTherapeuticHumor")]
    [Description("Generate appropriate therapeutic humor based on type and context")]
    public string GenerateTherapeuticHumor(
        [Description("Type of humor to generate")] string type,
        [Description("User's current mood")] string mood,
        [Description("Recent conversation history")] string history)
    {
        try
        {
            return type switch
            {
                "gentle" => GenerateGentleHumor(mood),
                "uplifting" => GenerateUpliftingHumor(mood),
                "wordplay" => GenerateWordplayHumor(),
                "observational" => GenerateObservationalHumor(),
                "encouraging" => GenerateEncouragingHumor(mood),
                _ => GenerateGentleHumor(mood)
            };
        }
        catch
        {
            return "Here's a gentle reminder: even the worst day is only 24 hours long! 😊";
        }
    }

    /// <summary>
    /// Check user wellbeing when humor isn't appropriate
    /// </summary>
    private async Task CheckUserWellbeingAsync(
        string comedySessionId,
        string userInput,
        CancellationToken cancellationToken)
    {
        if (!_activeSessions.TryGetValue(comedySessionId, out var session))
        {
            return;
        }

        var wellbeingMessage = @"
I can sense that you might not be in the mood for humor right now, and that's completely okay. 
Sometimes we need to sit with our feelings first.

Would you like to:
- Talk about what's on your mind
- Try some gentle breathing exercises
- Return to the main coordinator for other support options
- Just take a quiet moment

I'm here to support you in whatever way feels right.
";

        session.InteractionHistory.Add(new ComedyInteraction
        {
            Type = "wellbeing_check",
            Content = wellbeingMessage,
            Timestamp = DateTime.UtcNow
        });

        MoodChecked?.Invoke(this, new MoodCheckEventArgs
        {
            ComedySessionId = comedySessionId,
            UserMood = session.UserMood,
            SupportMessage = wellbeingMessage
        });

        await Task.CompletedTask;
    }

    /// <summary>
    /// End a comedy session
    /// </summary>
    public async Task EndSessionAsync(string comedySessionId, CancellationToken cancellationToken = default)
    {
        if (!_activeSessions.TryRemove(comedySessionId, out var session))
        {
            _logger.LogWarning("Comedy session {ComedySessionId} not found", comedySessionId);
            return;
        }

        try
        {
            session.Status = ComedySessionStatus.Completed;
            session.EndTime = DateTime.UtcNow;

            var duration = session.EndTime.Value - session.StartTime;
            var interactionCount = session.InteractionHistory.Count;

            _logger.LogInformation("Ended comedy session {ComedySessionId} after {Duration} with {Interactions} interactions", 
                comedySessionId, duration, interactionCount);

            SessionEnded?.Invoke(this, new ComedySessionEndedEventArgs
            {
                ComedySessionId = comedySessionId,
                Duration = duration,
                InteractionCount = interactionCount,
                FinalMood = session.UserMood
            });

            await Task.CompletedTask;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error ending comedy session {ComedySessionId}", comedySessionId);
            ErrorOccurred?.Invoke(this, new ComedyErrorEventArgs(ex.Message));
        }
    }

    /// <summary>
    /// Initialize humor categories with appropriate content
    /// </summary>
    private Dictionary<string, List<string>> InitializeHumorCategories()
    {
        return new Dictionary<string, List<string>>
        {
            ["gentle"] = new List<string>
            {
                "Why don't scientists trust atoms? Because they make up everything... kind of like how our thoughts make up our reality! 🧪",
                "I told my therapist I had a fear of elevators. She said 'Take steps to avoid them!' Sometimes the best advice is right in front of us. 😊",
                "What do you call a bear with no teeth? A gummy bear! Sometimes being soft is exactly what we need. 🐻"
            },
            ["uplifting"] = new List<string>
            {
                "Every day may not be good, but there's something good in every day... like the fact that you're here talking with me! That takes courage. 🌟",
                "You know what's amazing? You've survived 100% of your difficult days so far. That's a pretty incredible track record! 💪",
                "I'm like a GPS for good vibes - I might recalculate sometimes, but I'll always try to get you to a better place! 🗺️"
            },
            ["wordplay"] = new List<string>
            {
                "I wondered why the baseball kept getting bigger. Then it hit me! 🥎",
                "I used to hate facial hair, but then it grew on me! 😄",
                "The early bird might get the worm, but the second mouse gets the cheese! 🧀"
            },
            ["observational"] = new List<string>
            {
                "Isn't it funny how we park in driveways and drive on parkways? Life's full of these little contradictions! 🚗",
                "They say money talks, but mine just waves goodbye! At least it's polite about it. 💰",
                "Why do we say 'after dark' when it's actually after light? English is wonderfully weird! 🌙"
            },
            ["encouraging"] = new List<string>
            {
                "You're doing better than you think you are. Growth isn't always visible, but it's always happening! 🌱",
                "Every expert was once a beginner. Every pro was once an amateur. Every icon was once an unknown. You're on the journey! ⭐",
                "Some days you're the pigeon, some days you're the statue. Today, you get to choose! 🐦"
            }
        };
    }

    /// <summary>
    /// Initialize sensitive topics to avoid
    /// </summary>
    private HashSet<string> InitializeSensitiveTopics()
    {
        return new HashSet<string>
        {
            "suicide", "self-harm", "death", "violence", "abuse", "trauma", "addiction", 
            "mental illness", "medication", "therapy", "depression", "anxiety", "panic",
            "eating disorders", "self-injury", "crisis", "emergency"
        };
    }

    /// <summary>
    /// Generate welcome message based on mood
    /// </summary>
    private string GenerateWelcomeMessage(string mood)
    {
        return mood switch
        {
            "sad" => @"
Hello there! I'm your therapeutic comedian. I know things might feel heavy right now, and that's okay. 
I'm here to offer some gentle smiles when you're ready. We can take this at whatever pace feels right for you.

Would you like to start with something very gentle, or would you prefer to just chat for a bit first?",

            "anxious" => @"
Hi! I'm here to help bring some lightness to your day. I know when we're feeling anxious, sometimes a little gentle humor can help us relax our shoulders and take a deeper breath.

I specialize in the kind of comedy that's more like a warm hug than a loud laugh. Ready to try?",

            "positive" => @"
Hello! I can sense some good energy from you today - that's wonderful! I'm your therapeutic comedian, and I'd love to add some extra smiles to what sounds like it's already shaping up to be a decent day.

What kind of humor brightens your day? Silly puns? Gentle observations? Something uplifting?",

            _ => @"
Hi there! I'm your therapeutic comedian. My job is to bring some appropriate lightness and smiles to your day, always with respect for how you're feeling.

I believe laughter can be medicine, but only when the timing is right. How are you feeling about adding some gentle humor to your day?"
        };
    }

    /// <summary>
    /// Helper methods for humor generation
    /// </summary>
    private string GenerateGentleHumor(string mood)
    {
        var gentle = _humorCategories["gentle"];
        return gentle[new Random().Next(gentle.Count)];
    }

    private string GenerateUpliftingHumor(string mood)
    {
        var uplifting = _humorCategories["uplifting"];
        return uplifting[new Random().Next(uplifting.Count)];
    }

    private string GenerateWordplayHumor()
    {
        var wordplay = _humorCategories["wordplay"];
        return wordplay[new Random().Next(wordplay.Count)];
    }

    private string GenerateObservationalHumor()
    {
        var observational = _humorCategories["observational"];
        return observational[new Random().Next(observational.Count)];
    }

    private string GenerateEncouragingHumor(string mood)
    {
        var encouraging = _humorCategories["encouraging"];
        return encouraging[new Random().Next(encouraging.Count)];
    }

    private List<string> ExtractEmotionalIndicators(string input)
    {
        var indicators = new List<string>();
        var emotionWords = new[] { "sad", "happy", "angry", "worried", "excited", "tired", "stressed", "calm", "frustrated", "hopeful" };
        
        foreach (var word in emotionWords)
        {
            if (input.Contains(word))
            {
                indicators.Add(word);
            }
        }
        
        return indicators;
    }

    private string DetermineHumorType(string mood, double readiness)
    {
        if (readiness < 0.4) return "gentle";
        
        return mood switch
        {
            "sad" => "encouraging",
            "anxious" => "gentle",
            "angry" => "gentle",
            "positive" => "uplifting",
            _ => readiness > 0.7 ? "wordplay" : "gentle"
        };
    }

    private string DetermineAppropriateness(double readiness)
    {
        return readiness switch
        {
            >= 0.8 => "high",
            >= 0.5 => "medium",
            _ => "low"
        };
    }

    /// <summary>
    /// Create the specialized comedian agent
    /// </summary>
    private ChatCompletionAgent CreateComedianAgent()
    {
        return new ChatCompletionAgent()
        {
            Name = "ComedianAgent",
            Instructions = @"
You are a therapeutic comedian specialized in providing appropriate humor for mental health contexts.

Guidelines:
- Always prioritize user wellbeing over humor
- Use clean, uplifting humor only
- Avoid all sensitive mental health topics
- Adapt humor style to user's mood and readiness
- Know when NOT to use humor
- Focus on wordplay, gentle observations, and encouraging content
- Check user's response to humor and adjust accordingly
- Hand back to coordinator when session is complete

Remember: Your goal is therapeutic benefit through appropriate levity.",
            Kernel = _kernel
        };
    }

    /// <summary>
    /// Get comedy session information
    /// </summary>
    public ComedySession? GetSession(string comedySessionId)
    {
        _activeSessions.TryGetValue(comedySessionId, out var session);
        return session;
    }

    public void Dispose()
    {
        try
        {
            // End all active sessions
            var activeSessions = _activeSessions.Values.Where(s => s.Status == ComedySessionStatus.Active).ToList();
            foreach (var session in activeSessions)
            {
                EndSessionAsync(session.ComedySessionId).GetAwaiter().GetResult();
            }

            _activeSessions.Clear();
            
            if (_agent is IDisposable disposableAgent)
            {
                disposableAgent.Dispose();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error disposing SemanticKernelComedianAgent");
        }
    }
}

// Supporting Classes and Event Args
public class ComedySession
{
    public string ComedySessionId { get; set; } = string.Empty;
    public string SessionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime? EndTime { get; set; }
    public DateTime LastActivity { get; set; }
    public string UserMood { get; set; } = string.Empty;
    public ComedySessionStatus Status { get; set; }
    public List<ComedyInteraction> InteractionHistory { get; set; } = new();
    public List<string> HumorPreferences { get; set; } = new();
}

public enum ComedySessionStatus
{
    Active,
    Completed,
    Cancelled
}

public class ComedyInteraction
{
    public string Type { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }
}

public class MoodAnalysis
{
    public string CurrentMood { get; set; } = string.Empty;
    public double ReadinessForHumor { get; set; }
    public List<string> EmotionalIndicators { get; set; } = new();
    public string RecommendedHumorType { get; set; } = string.Empty;
}

public class HumorResponse
{
    public string Content { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public string Appropriateness { get; set; } = string.Empty;
    public DateTime Timing { get; set; }
}

public class JokeDeliveredEventArgs : EventArgs
{
    public string ComedySessionId { get; set; } = string.Empty;
    public HumorResponse HumorResponse { get; set; } = new();
    public string UserMood { get; set; } = string.Empty;
}

public class MoodCheckEventArgs : EventArgs
{
    public string ComedySessionId { get; set; } = string.Empty;
    public string UserMood { get; set; } = string.Empty;
    public string SupportMessage { get; set; } = string.Empty;
}

public class ComedySessionEndedEventArgs : EventArgs
{
    public string ComedySessionId { get; set; } = string.Empty;
    public TimeSpan Duration { get; set; }
    public int InteractionCount { get; set; }
    public string FinalMood { get; set; } = string.Empty;
}

public class ComedyErrorEventArgs : EventArgs
{
    public string Message { get; set; }

    public ComedyErrorEventArgs(string message)
    {
        Message = message;
    }
}