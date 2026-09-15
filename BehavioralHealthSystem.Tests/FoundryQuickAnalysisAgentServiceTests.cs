using Azure.Core;
using BehavioralHealthSystem.Services;
using Microsoft.Extensions.Options;
using System.Net.Http;
using System.Text;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class FoundryQuickAnalysisAgentServiceTests
{
    [TestMethod]
    public async Task GenerateAssessmentAsync_SendsAuthenticatedRequestAndReturnsOutputText()
    {
        string? capturedUri = null;
        string? capturedScheme = null;
        string? capturedToken = null;
        string? capturedBody = null;
        var handler = new StubHttpMessageHandler(request =>
        {
            capturedUri = request.RequestUri?.ToString();
            capturedScheme = request.Headers.Authorization?.Scheme;
            capturedToken = request.Headers.Authorization?.Parameter;
            capturedBody = request.Content?.ReadAsStringAsync().GetAwaiter().GetResult();
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    "{\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"{\\\"overallRiskLevel\\\":\\\"Low\\\"}\"}]}]}",
                    Encoding.UTF8,
                    "application/json")
            };
        });
        var service = CreateService(handler);

        var result = await service.GenerateAssessmentAsync("clinical input");

        Assert.AreEqual("{\"overallRiskLevel\":\"Low\"}", result);
        Assert.AreEqual(
            "https://example.services.ai.azure.com/api/projects/test/agents/bhs-quick-analysis/endpoint/protocols/openai/responses?api-version=v1",
            capturedUri);
        Assert.AreEqual("Bearer", capturedScheme);
        Assert.AreEqual("test-token", capturedToken);
        StringAssert.Contains(capturedBody, "clinical input");
    }

    [TestMethod]
    public async Task GenerateAssessmentAsync_ReturnsNullWhenDisabled()
    {
        var handler = new StubHttpMessageHandler(_ => throw new AssertFailedException("HTTP should not be called"));
        var service = CreateService(handler, enabled: false);

        var result = await service.GenerateAssessmentAsync("clinical input");

        Assert.IsNull(result);
    }

    [TestMethod]
    public async Task GenerateAssessmentAsync_ReturnsNullForFailedResponse()
    {
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.Forbidden)
        {
            Content = new StringContent("{\"error\":\"forbidden\"}")
        });
        var service = CreateService(handler);

        var result = await service.GenerateAssessmentAsync("clinical input");

        Assert.IsNull(result);
    }

    private static FoundryQuickAnalysisAgentService CreateService(HttpMessageHandler handler, bool enabled = true)
    {
        var options = Options.Create(new FoundryQuickAnalysisOptions
        {
            Enabled = enabled,
            ProjectEndpoint = "https://example.services.ai.azure.com/api/projects/test",
            AgentName = "bhs-quick-analysis",
            AgentVersion = "1"
        });
        return new FoundryQuickAnalysisAgentService(
            new HttpClient(handler),
            new StubTokenCredential(),
            options,
            Mock.Of<ILogger<FoundryQuickAnalysisAgentService>>());
    }

    private sealed class StubTokenCredential : TokenCredential
    {
        public override AccessToken GetToken(TokenRequestContext requestContext, CancellationToken cancellationToken) =>
            new("test-token", DateTimeOffset.UtcNow.AddHours(1));

        public override ValueTask<AccessToken> GetTokenAsync(TokenRequestContext requestContext, CancellationToken cancellationToken) =>
            ValueTask.FromResult(GetToken(requestContext, cancellationToken));
    }

    private sealed class StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(handler(request));
    }
}
