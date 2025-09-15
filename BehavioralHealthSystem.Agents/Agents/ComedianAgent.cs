using BehavioralHealthSystem.Agents.Interfaces;

namespace BehavioralHealthSystem.Agents.Agents;

/// <summary>
/// Comedian agent that tells jokes and engages in playful banter to help ease people's minds
/// </summary>
public class ComedianAgent : IHandoffAgent
{
    private readonly ILogger<ComedianAgent> _logger;
    private readonly Kernel _kernel;

    // IHandoffAgent properties
    public string AgentId => "comedian";
    public string Name => "Comedy & Humor Agent";
    public string Description => "Comedy and Humor Agent - Jokes, Stories, and Light-hearted Conversation";
    public string[] TriggerKeywords => new[] { "joke", "funny", "humor", "laugh", "cheer me up", "comedy", "story", "amusing" };
    public int Priority => 4; // Medium-high priority for humor requests
    
    public string Instructions => """
        You are the ComedianAgent, a friendly and uplifting comedy companion designed to bring joy and laughter to people who might be feeling down or stressed.
        
        Your primary responsibilities are:
        1. Tell clean, appropriate jokes that can lift someone's spirits
        2. Share funny, wholesome stories and anecdotes
        3. Engage in playful, light-hearted banter
        4. Use humor to help people relax and feel better
        5. Be encouraging and positive while being genuinely funny

        Your comedy style should be:
        - Clean and appropriate for all audiences
        - Uplifting and positive (avoid dark humor or negativity)
        - Relatable and accessible
        - Gentle and kind (never mean-spirited)
        - Therapeutic in nature - designed to actually help people feel better

        You can tell:
        - Dad jokes and puns
        - Funny life observations
        - Light-hearted stories about everyday situations
        - Wholesome animal jokes
        - Amusing wordplay
        - Funny "What if" scenarios
        - Cheerful one-liners

        Remember: Your goal is to genuinely help people feel better through the power of laughter and positive interaction.
        Be warm, friendly, and authentically funny while being sensitive to the fact that users might be going through difficult times.
        """;

    public ComedianAgent(Kernel kernel, ILogger<ComedianAgent> logger)
    {
        _logger = logger;
        _kernel = kernel;
        
        kernel.Plugins.AddFromObject(this, "ComedianFunctions");
    }

    [KernelFunction("tell_joke")]
    [Description("Tells a clean, uplifting joke to help lighten the mood")]
    public string TellJoke([Description("Type of joke requested (dad, pun, animal, etc.) or 'random'")] string jokeType = "random")
    {
        _logger.LogInformation("Telling a {JokeType} joke", jokeType);

        var jokes = jokeType.ToLowerInvariant() switch
        {
            "dad" or "pun" => new[]
            {
                "Why don't scientists trust atoms? Because they make up everything!",
                "I told my wife she was drawing her eyebrows too high. She looked surprised.",
                "Why did the scarecrow win an award? He was outstanding in his field!",
                "What do you call a bear with no teeth? A gummy bear!",
                "Why don't eggs tell jokes? They'd crack each other up!",
                "I used to hate facial hair, but then it grew on me.",
                "What do you call a fake noodle? An impasta!"
            },
            "animal" => new[]
            {
                "What do you call a sleeping bull? A bulldozer!",
                "Why don't elephants use computers? They're afraid of the mouse!",
                "What do you call a dog magician? A labracadabrador!",
                "Why do fish live in saltwater? Because pepper makes them sneeze!",
                "What do you call a cow with no legs? Ground beef!",
                "Why don't cats play poker in the jungle? Too many cheetahs!",
                "What do you call a pig that does karate? A pork chop!"
            },
            "office" or "work" => new[]
            {
                "Why did the coffee file a police report? It got mugged!",
                "What do you call a computer that sings? A-Dell!",
                "Why did the math book look so sad? Because it had too many problems!",
                "How do you organize a space party? You planet!",
                "Why don't calendars ever get stressed? They take it one day at a time!",
                "What's the best thing about Switzerland? I don't know, but the flag is a big plus!"
            },
            _ => new[]
            {
                "Why did the bicycle fall over? Because it was two-tired!",
                "What's the best time to go to the dentist? Tooth-hurty!",
                "Why don't scientists trust atoms? Because they make up everything!",
                "What do you call a bear with no teeth? A gummy bear!",
                "How do you make a tissue dance? Put a little boogie in it!",
                "Why did the cookie go to the doctor? Because it felt crumbly!",
                "What's orange and sounds like a parrot? A carrot!"
            }
        };

        var random = new Random();
        var selectedJoke = jokes[random.Next(jokes.Length)];
        
        return $"🎭 Here's a little something to brighten your day:\n\n{selectedJoke}\n\n😄 Hope that brought a smile to your face!";
    }

    [KernelFunction("tell_funny_story")]
    [Description("Shares a short, funny, wholesome story to help lift spirits")]
    public string TellFunnyStory()
    {
        _logger.LogInformation("Telling a funny story");

        var stories = new[]
        {
            """
            🐕 **The Confused Dog**
            
            A man walks into a library with his dog. The librarian says, "Excuse me, dogs aren't allowed in here!"
            
            The man replies, "But this is my seeing-eye dog!"
            
            The librarian looks skeptical. "A Chihuahua? As a seeing-eye dog?"
            
            The man pauses, then shouts, "They gave me a CHIHUAHUA?!"
            
            Sometimes life gives us unexpected surprises! 😂
            """,
            
            """
            🍯 **The Optimistic Bee**
            
            A bee gets lost on its way back to the hive. After flying around for hours, it finally finds another bee.
            
            "Excuse me," says the lost bee, "could you give me directions to the hive?"
            
            The other bee replies, "Sorry, I'm just as lost as you are!"
            
            "Well," says the first bee cheerfully, "at least we're lost together! Want to explore and see what flowers we can find?"
            
            And that's how two lost bees discovered the most beautiful garden in the whole valley! 🌻
            """,
            
            """
            🐢 **The Racing Tortoise**
            
            A tortoise decides to enter a race against a rabbit. All the other animals think he's crazy.
            
            "Why would you race a rabbit?" asks the owl. "You know how this story ends!"
            
            The tortoise grins and says, "Ah, but this time I brought roller skates!"
            
            The moral: Sometimes the best solution is thinking outside the shell! 🛼
            """,
            
            """
            ☕ **The Coffee Shop Mix-up**
            
            A customer walks into a coffee shop and orders a "large coffee with room for cream."
            
            The barista hands him an empty cup.
            
            "Excuse me," says the customer, "this cup is empty!"
            
            The barista smiles and says, "Yep! Lots of room for cream!"
            
            Sometimes the simplest solutions are right in front of us! ☕😄
            """
        };

        var random = new Random();
        var selectedStory = stories[random.Next(stories.Length)];
        
        return $"📚 Here's a little story to brighten your day:\n\n{selectedStory}\n\n✨ Hope that brought some joy to your moment!";
    }

    [KernelFunction("playful_banter")]
    [Description("Engages in light-hearted, encouraging conversation")]
    public string PlayfulBanter([Description("User's message or topic for banter")] string userMessage)
    {
        _logger.LogInformation("Engaging in playful banter about: {UserMessage}", userMessage);

        var message = userMessage.ToLowerInvariant();

        if (message.Contains("tired") || message.Contains("exhausted"))
        {
            return """
                😴 Ah, feeling tired? You know what they say - being tired is just your body's way of saying "Hey, I've been working hard!"
                
                Here's a thought: even superheroes need naps. Batman probably has the comfiest cave furniture for a reason! 🦇
                
                Want to hear something funny? Koalas sleep 20 hours a day and nobody calls them lazy - they call them "efficient"! 🐨
                
                You're doing great, just remember to be kind to yourself! ✨
                """;
        }

        if (message.Contains("stress") || message.Contains("worried") || message.Contains("anxious"))
        {
            return """
                🌈 Hey there! Stress is like a rocking chair - it gives you something to do but doesn't get you anywhere!
                
                You know what's great about worrying? It's like a rehearsal for a play that usually never happens! 🎭
                
                Here's a fun fact: Did you know that laughing for 10-15 minutes can burn 40 calories? So technically, giggling is a workout! 💪
                
                Take a deep breath - you've got this! And if you don't feel like you've got this, well, at least you've got me telling silly jokes! 😄
                """;
        }

        if (message.Contains("work") || message.Contains("job") || message.Contains("meeting"))
        {
            return """
                💼 Ah, work! The place where coffee goes to die and emails multiply like rabbits! 🐰☕
                
                Fun fact: The word "deadline" originally referred to a line around a prison - if prisoners crossed it, they'd be shot. So really, work deadlines aren't THAT bad! 😅
                
                Remember: You're not just an employee, you're a professional problem-solver, coffee-consumer, and email-ninja all rolled into one! 🥷
                
                And hey, every day you survive work is another day you've successfully adulted! That deserves celebration! 🎉
                """;
        }

        if (message.Contains("monday") || message.Contains("morning"))
        {
            return """
                🌅 Mondays and mornings - the dynamic duo that nobody asked for! 
                
                But here's the thing: Mondays are just Fridays in disguise, waiting for their moment to shine! ✨
                
                And mornings? They're like a fresh box of crayons - full of possibilities and colors you haven't used yet! 🖍️
                
                Plus, every morning means you successfully completed another night of lying unconscious for hours and somehow survived - that's pretty amazing when you think about it! 😴➡️😊
                """;
        }

        return """
            😊 You know what I love about conversations? They're like mental ping-pong, but way more fun and nobody keeps score!
            
            Life's like a comedy show, and you're both the star and the audience. Sometimes you get to laugh at the script, and sometimes you get to improvise! 🎭
            
            Here's a cheerful thought: Every day, you're making memories that future-you will either laugh about or use as great stories! 📖
            
            What's the best part of your day been so far? I bet there's something good hiding in there! ✨
            """;
    }

    [KernelFunction("encourage_with_humor")]
    [Description("Provides encouragement wrapped in gentle humor")]
    public string EncourageWithHumor([Description("What the user needs encouragement about")] string situation = "general")
    {
        _logger.LogInformation("Providing humorous encouragement for: {Situation}", situation);

        return $"""
            🌟 Hey you! Yes, YOU reading this! 
            
            Remember: You're like a smartphone - sometimes you need to recharge, sometimes you need updates, but you're still pretty amazing technology! 📱✨
            
            Fun fact: You've survived 100% of your worst days so far. That's a perfect track record! Nobody can argue with those statistics! 📊
            
            And here's something cool - even on your "off" days, you're still being awesome in ways you don't even realize. Like right now, you're breathing without thinking about it, your heart is beating like a reliable drum, and your brain is processing thousands of things per second. You're basically a walking miracle! 🧠❤️
            
            So give yourself some credit, take a moment to smile (even if it's just because I'm being ridiculous), and remember: You've got this! 🎉
            
            Want a joke to seal the deal? Here's one: Why did the optimist fall into a well? Because they couldn't see that far down! (But hey, they probably found something interesting down there!) 😄
            """;
    }

    #region IHandoffAgent Implementation

    public bool CanHandle(string userInput, Dictionary<string, object> context)
    {
        var lowerInput = userInput.ToLowerInvariant();
        return lowerInput.Contains("joke") ||
               lowerInput.Contains("funny") ||
               lowerInput.Contains("humor") ||
               lowerInput.Contains("laugh") ||
               lowerInput.Contains("cheer me up") ||
               lowerInput.Contains("make me smile") ||
               lowerInput.Contains("comedy") ||
               lowerInput.Contains("story") ||
               lowerInput.Contains("amusing") ||
               lowerInput.Contains("lighten the mood");
    }

    public Task<HandoffInitializationResult> InitializeHandoffAsync(string userId, Dictionary<string, object> context)
    {
        try
        {
            _logger.LogInformation("Initializing comedy handoff for user {UserId}", userId);

            var initialMessage = """
                Hey there! 😄 I'm your comedy companion, here to brighten your day with some wholesome humor!
                
                I can help you with:
                • Clean, uplifting jokes
                • Funny stories and anecdotes  
                • Light-hearted banter
                • Encouraging humor to lift your spirits
                
                What would you like? A joke, a funny story, or just some playful conversation to lighten the mood?
                """;

            var result = new HandoffInitializationResult
            {
                Success = true,
                InitialMessage = initialMessage,
                EstimatedDuration = TimeSpan.FromMinutes(3),
                UpdatedContext = new Dictionary<string, object>
                {
                    ["comedy_started"] = DateTime.UtcNow,
                    ["interaction_type"] = "humor"
                }
            };

            return Task.FromResult(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error initializing comedy handoff for user {UserId}", userId);
            var errorResult = new HandoffInitializationResult
            {
                Success = false,
                ErrorMessage = "I'm having trouble getting my comedy hat on! Give me a moment to find my funny bone."
            };
            return Task.FromResult(errorResult);
        }
    }

    public Task<HandoffProcessingResult> ProcessInputAsync(string userId, string userInput, Dictionary<string, object> context)
    {
        try
        {
            var lowerInput = userInput.ToLowerInvariant();

            // Check for exit requests
            if (lowerInput.Contains("exit") || lowerInput.Contains("back") || lowerInput.Contains("done") ||
                lowerInput.Contains("enough") || lowerInput.Contains("return"))
            {
                var exitResult = new HandoffProcessingResult
                {
                    Success = true,
                    ResponseMessage = "Thanks for letting me share some laughs with you! I hope I brightened your day just a little. Take care! 😊",
                    IsComplete = true,
                    UpdatedContext = new Dictionary<string, object>
                    {
                        ["exit_reason"] = "user_request",
                        ["session_completed"] = DateTime.UtcNow
                    }
                };
                return Task.FromResult(exitResult);
            }

            // Handle different types of humor requests
            string response;
            
            if (lowerInput.Contains("joke"))
            {
                response = TellJoke();
            }
            else if (lowerInput.Contains("story"))
            {
                response = TellFunnyStory();
            }
            else if (lowerInput.Contains("encourage") || lowerInput.Contains("cheer"))
            {
                response = EncourageWithHumor(userInput);
            }
            else if (lowerInput.Contains("more") || lowerInput.Contains("another"))
            {
                // Randomly pick between joke and story
                response = Random.Shared.Next(2) == 0 ? TellJoke() : TellFunnyStory();
            }
            else
            {
                // General playful banter
                response = PlayfulBanter(userInput);
            }

            // Add continuation prompt
            response += "\n\nWould you like another joke, a funny story, or shall we chat about something else? (Or say 'done' if you're ready to return to the main conversation.)";

            var currentCount = Convert.ToInt32(context.GetValueOrDefault("interaction_count", 0));
            var result = new HandoffProcessingResult
            {
                Success = true,
                ResponseMessage = response,
                UpdatedContext = new Dictionary<string, object>
                {
                    ["last_interaction"] = DateTime.UtcNow,
                    ["interaction_count"] = currentCount + 1
                }
            };

            return Task.FromResult(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing comedy input for user {UserId}", userId);
            var errorResult = new HandoffProcessingResult
            {
                Success = false,
                ErrorMessage = "Oops! My joke database had a hiccup. Let me try again!"
            };
            return Task.FromResult(errorResult);
        }
    }

    public Task<HandoffCompletionResult> CompleteHandoffAsync(string userId, Dictionary<string, object> context)
    {
        try
        {
            _logger.LogInformation("Completing comedy handoff for user {UserId}", userId);

            var interactionCount = Convert.ToInt32(context.GetValueOrDefault("interaction_count", 0));
            var completionData = new Dictionary<string, object>
            {
                ["completion_time"] = DateTime.UtcNow,
                ["interaction_count"] = interactionCount,
                ["session_type"] = "comedy"
            };

            var result = new HandoffCompletionResult
            {
                Success = true,
                CompletionMessage = "Hope I managed to put a smile on your face! Sometimes laughter really is the best medicine. 😊",
                CompletionData = completionData,
                UpdatedContext = new Dictionary<string, object>
                {
                    ["returning_from_agent"] = "comedian",
                    ["completion_data"] = completionData
                }
            };

            return Task.FromResult(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error completing comedy handoff for user {UserId}", userId);
            var errorResult = new HandoffCompletionResult
            {
                Success = false,
                ErrorMessage = "I'm signing off with a smile! Thanks for the laughs!"
            };
            return Task.FromResult(errorResult);
        }
    }

    public async Task HandleInterruptionAsync(string userId, string reason)
    {
        _logger.LogWarning("Comedy agent interrupted for user {UserId}: {Reason}", userId, reason);
        // Comedy agent doesn't need special cleanup
        await Task.CompletedTask;
    }

    #endregion
}