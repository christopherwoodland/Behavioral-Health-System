using System.Text;
using System.Text.Json;
using BehavioralHealthSystem.Functions.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests;

[TestClass]
[DoNotParallelize]
public class EasyAuthValidationServiceTests
{
    private readonly Dictionary<string, string?> _originalEnvironment = new();

    [TestInitialize]
    public void Initialize()
    {
        SetEnvironment("AZURE_FUNCTIONS_ENVIRONMENT", "Production");
        SetEnvironment("ASPNETCORE_ENVIRONMENT", "Production");
        SetEnvironment("AIR_GAP_MODE", null);
        SetEnvironment("ENABLE_AIR_GAP", null);
        SetEnvironment("AIR_GAP_AUTH_BYPASS_APPROVED", null);
        SetEnvironment("FUNCTIONS_API_KEY", null);
        SetEnvironment("WEBSITE_AAD_ENABLE_MISE", "true");
    }

    [TestCleanup]
    public void Cleanup()
    {
        foreach (var (name, value) in _originalEnvironment)
        {
            Environment.SetEnvironmentVariable(name, value);
        }
    }

    [TestMethod]
    public async Task ValidateRequestAsync_AcceptsEasyAuthUserWithRequiredScope()
    {
        var request = CreateRequest(("X-MS-CLIENT-PRINCIPAL", CreatePrincipal(
            ("oid", "user-object-id"),
            ("preferred_username", "user@example.com"),
            ("scp", "access_as_user"))));
        var service = CreateService();

        var result = await service.ValidateRequestAsync(request);

        Assert.IsTrue(result.IsValid);
        Assert.AreEqual("user-object-id", result.UserId);
        Assert.AreEqual("user@example.com", result.UserEmail);
    }

    [TestMethod]
    public async Task ValidateRequestAsync_RejectsEasyAuthUserWithoutRequiredScope()
    {
        var request = CreateRequest(("X-MS-CLIENT-PRINCIPAL", CreatePrincipal(
            ("oid", "user-object-id"),
            ("scp", "other_scope"))));
        var service = CreateService();

        var result = await service.ValidateRequestAsync(request);

        Assert.IsFalse(result.IsValid);
        Assert.AreEqual(HttpStatusCode.Forbidden, result.FailureStatusCode);
        StringAssert.Contains(result.ErrorMessage, "access_as_user");
    }

    [TestMethod]
    public async Task ValidateRequestAsync_AcceptsObjectIdentifierUriClaim()
    {
        var request = CreateRequest(("X-MS-CLIENT-PRINCIPAL", CreatePrincipal(
            ("http://schemas.microsoft.com/identity/claims/objectidentifier", "uri-object-id"),
            ("scp", "access_as_user"))));
        var service = CreateService();

        var result = await service.ValidateRequestAsync(request);

        Assert.IsTrue(result.IsValid);
        Assert.AreEqual("uri-object-id", result.UserId);
    }

    [TestMethod]
    public async Task ValidateRequestAsync_AcceptsTrustedAadProviderHeaderWithRuntimeAuthType()
    {
        var request = CreateRequest(
            ("X-MS-CLIENT-PRINCIPAL", CreatePrincipal("Federation",
                ("oid", "user-object-id"),
                ("scp", "access_as_user"))),
            ("X-MS-CLIENT-PRINCIPAL-IDP", "aad"));
        var service = CreateService();

        var result = await service.ValidateRequestAsync(request);

        Assert.IsTrue(result.IsValid);
        Assert.AreEqual("user-object-id", result.UserId);
    }

    [TestMethod]
    public async Task ValidateRequestAsync_RejectsNonAadProvider()
    {
        var request = CreateRequest(
            ("X-MS-CLIENT-PRINCIPAL", CreatePrincipal("Federation",
                ("oid", "user-object-id"),
                ("scp", "access_as_user"))),
            ("X-MS-CLIENT-PRINCIPAL-IDP", "github"));
        var service = CreateService();

        var result = await service.ValidateRequestAsync(request);

        Assert.IsFalse(result.IsValid);
        StringAssert.Contains(result.ErrorMessage, "not an Entra ID identity");
    }

    [TestMethod]
    public async Task ValidateRequestAsync_RejectsPrincipalWithoutStableIdentifier()
    {
        var request = CreateRequest(("X-MS-CLIENT-PRINCIPAL", CreatePrincipal(
            ("name", "No Stable Identifier"),
            ("scp", "access_as_user"))));
        var service = CreateService();

        var result = await service.ValidateRequestAsync(request);

        Assert.IsFalse(result.IsValid);
        Assert.AreEqual(HttpStatusCode.Unauthorized, result.FailureStatusCode);
        StringAssert.Contains(result.ErrorMessage, "stable user identifier");
    }

    [TestMethod]
    public async Task ValidateRequestAsync_RejectsMalformedPrincipalHeader()
    {
        var request = CreateRequest(("X-MS-CLIENT-PRINCIPAL", "not-base64"));
        var service = CreateService();

        var result = await service.ValidateRequestAsync(request);

        Assert.IsFalse(result.IsValid);
        Assert.AreEqual(HttpStatusCode.Unauthorized, result.FailureStatusCode);
        StringAssert.Contains(result.ErrorMessage, "malformed");
    }

    [TestMethod]
    public async Task ValidateRequestAsync_RejectsBearerTokenWithoutEasyAuthPrincipal()
    {
        var request = CreateRequest(("Authorization", "Bearer untrusted-token"));
        var service = CreateService();

        var result = await service.ValidateRequestAsync(request);

        Assert.IsFalse(result.IsValid);
        StringAssert.Contains(result.ErrorMessage, "EasyAuth");
    }

    [TestMethod]
    public async Task ValidateRequestAsync_AllowsApiKeyWhenEasyAuthIsDisabled()
    {
        Environment.SetEnvironmentVariable("WEBSITE_AAD_ENABLE_MISE", "false");
        Environment.SetEnvironmentVariable("FUNCTIONS_API_KEY", "test-api-key");
        var request = CreateRequest(("X-API-Key", "test-api-key"));
        var service = CreateService();

        var result = await service.ValidateRequestAsync(request);

        Assert.IsTrue(result.IsValid);
        Assert.AreEqual("api-key-user", result.UserId);
    }

    private ApiKeyValidationService CreateService()
    {
        return new ApiKeyValidationService(Mock.Of<ILogger<ApiKeyValidationService>>());
    }

    private static HttpRequestData CreateRequest(params (string Name, string Value)[] headers)
    {
        var requestHeaders = new HttpHeadersCollection();
        foreach (var (name, value) in headers)
        {
            requestHeaders.Add(name, value);
        }

        var request = new Mock<HttpRequestData>(MockBehavior.Loose, Mock.Of<FunctionContext>());
        request.SetupGet(value => value.Headers).Returns(requestHeaders);
        request.SetupGet(value => value.Url).Returns(new Uri("https://localhost/api/test"));
        return request.Object;
    }

    private static string CreatePrincipal(params (string Type, string Value)[] claims)
    {
        return CreatePrincipal("aad", claims);
    }

    private static string CreatePrincipal(string authenticationType, params (string Type, string Value)[] claims)
    {
        var principal = new
        {
            auth_typ = authenticationType,
            claims = claims.Select(claim => new { typ = claim.Type, val = claim.Value })
        };
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(principal)));
    }

    private void SetEnvironment(string name, string? value)
    {
        _originalEnvironment.TryAdd(name, Environment.GetEnvironmentVariable(name));
        Environment.SetEnvironmentVariable(name, value);
    }
}
