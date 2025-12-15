using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace BehavioralHealthSystem.Agents.DependencyInjection;

/// <summary>
/// Extension methods for registering agent services with dependency injection.
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Adds the Grammar Correction Agent services to the dependency injection container.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configureAgentOptions">Action to configure agent options.</param>
    /// <param name="configureGrammarOptions">Action to configure grammar agent options.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddGrammarCorrectionAgent(
        this IServiceCollection services,
        Action<AgentOptions>? configureAgentOptions = null,
        Action<GrammarAgentOptions>? configureGrammarOptions = null)
    {
        if (configureAgentOptions != null)
        {
            services.Configure(configureAgentOptions);
        }
        else
        {
            services.Configure<AgentOptions>(_ => { });
        }

        if (configureGrammarOptions != null)
        {
            services.Configure(configureGrammarOptions);
        }
        else
        {
            services.Configure<GrammarAgentOptions>(_ => { });
        }

        services.AddSingleton<IGrammarCorrectionAgent, GrammarCorrectionAgent>();

        return services;
    }

    /// <summary>
    /// Adds the Grammar Correction Agent services using configuration from IConfiguration.
    /// Uses UPPER_CASE environment variable naming convention.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The configuration root.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddGrammarCorrectionAgent(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.Configure<AgentOptions>(options =>
        {
            // Read from UPPER_CASE environment variables
            options.Endpoint = configuration["AGENT_ENDPOINT"] ?? string.Empty;
            options.ApiKey = configuration["AGENT_API_KEY"];
            options.ModelDeployment = configuration["AGENT_MODEL_DEPLOYMENT"] ?? "gpt-5";
            options.Enabled = configuration.GetValue<bool>("AGENT_ENABLED", true);
            options.SupportsTemperature = configuration.GetValue<bool>("AGENT_SUPPORTS_TEMPERATURE", false);
            options.SupportsMaxTokens = configuration.GetValue<bool>("AGENT_SUPPORTS_MAX_TOKENS", false);
            options.TimeoutSeconds = configuration.GetValue<int>("AGENT_TIMEOUT_SECONDS", 60);

            // Optional: Temperature and MaxTokens (nullable)
            var tempStr = configuration["AGENT_TEMPERATURE"];
            if (!string.IsNullOrEmpty(tempStr) && float.TryParse(tempStr, out var temp))
                options.Temperature = temp;

            var maxTokensStr = configuration["AGENT_MAX_TOKENS"];
            if (!string.IsNullOrEmpty(maxTokensStr) && int.TryParse(maxTokensStr, out var maxTokens))
                options.MaxTokens = maxTokens;
        });

        services.Configure<GrammarAgentOptions>(options =>
        {
            // Read from UPPER_CASE environment variables
            options.AgentName = configuration["GRAMMAR_AGENT_NAME"] ?? "GrammarCorrectionAgent";
            options.IncludeExplanations = configuration.GetValue<bool>("GRAMMAR_AGENT_INCLUDE_EXPLANATIONS", false);
            options.PreserveFormatting = configuration.GetValue<bool>("GRAMMAR_AGENT_PRESERVE_FORMATTING", true);
            options.SuggestAlternatives = configuration.GetValue<bool>("GRAMMAR_AGENT_SUGGEST_ALTERNATIVES", false);
            options.LanguageContext = configuration["GRAMMAR_AGENT_LANGUAGE_CONTEXT"];
            options.CustomInstructions = configuration["GRAMMAR_AGENT_CUSTOM_INSTRUCTIONS"];
        });

        services.AddSingleton<IGrammarCorrectionAgent, GrammarCorrectionAgent>();

        return services;
    }
}
