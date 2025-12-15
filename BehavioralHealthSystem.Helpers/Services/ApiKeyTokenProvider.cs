using System.ClientModel;
using System.ClientModel.Primitives;

namespace BehavioralHealthSystem.Services;

/// <summary>
/// Custom AuthenticationTokenProvider that uses an API key as a bearer token
/// for Azure AI Foundry/Cognitive Services authentication
/// </summary>
public class ApiKeyTokenProvider : AuthenticationTokenProvider
{
    private readonly string _apiKey;

    /// <summary>
    /// Creates a new instance of ApiKeyTokenProvider
    /// </summary>
    /// <param name="apiKey">The API key to use for authentication</param>
    public ApiKeyTokenProvider(string apiKey)
    {
        _apiKey = apiKey ?? throw new ArgumentNullException(nameof(apiKey));
    }

    /// <summary>
    /// Creates token options from the provided context
    /// </summary>
    public override GetTokenOptions? CreateTokenOptions(IReadOnlyDictionary<string, object> properties)
    {
        // For API key auth, we always return valid options since we don't need scopes
        return new GetTokenOptions(properties);
    }

    /// <summary>
    /// Gets an authentication token synchronously
    /// </summary>
    public override AuthenticationToken GetToken(GetTokenOptions options, CancellationToken cancellationToken)
    {
        // Return the API key as a Bearer token - Azure AI services accept this format
        return new AuthenticationToken(_apiKey, "Bearer", DateTimeOffset.MaxValue, null);
    }

    /// <summary>
    /// Gets an authentication token asynchronously
    /// </summary>
    public override ValueTask<AuthenticationToken> GetTokenAsync(GetTokenOptions options, CancellationToken cancellationToken)
    {
        // Return the API key as a Bearer token - Azure AI services accept this format
        return new ValueTask<AuthenticationToken>(new AuthenticationToken(_apiKey, "Bearer", DateTimeOffset.MaxValue, null));
    }
}
