using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using BehavioralHealthSystem.Agents.Plugins;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Moq;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class DamPredictionPluginRetryTests
{
    [TestMethod]
    public async Task InitiateDamSession_TransientStatuses_RetriesUntilSuccess()
    {
        var handler = new SequenceHttpMessageHandler(
            () => new HttpResponseMessage(HttpStatusCode.ServiceUnavailable),
            () => new HttpResponseMessage(HttpStatusCode.TooManyRequests),
            () => CreateJsonResponse(HttpStatusCode.OK, "{\"session_id\":\"dam-session-1\"}"));
        var plugin = CreatePlugin(handler, maxRetryAttempts: 3);

        var sessionId = await plugin.InitiateDamSessionAsync("user-1");

        Assert.AreEqual("dam-session-1", sessionId);
        Assert.AreEqual(3, handler.RequestCount);
    }

    [TestMethod]
    public async Task InitiateDamSession_Unauthorized_DoesNotRetry()
    {
        var handler = new SequenceHttpMessageHandler(
            () => CreateJsonResponse(HttpStatusCode.Unauthorized, "{\"detail\":\"invalid key\"}"));
        var plugin = CreatePlugin(handler, maxRetryAttempts: 3);

        await Assert.ThrowsExceptionAsync<HttpRequestException>(
            () => plugin.InitiateDamSessionAsync("user-1"));

        Assert.AreEqual(1, handler.RequestCount);
    }

    private static DamPredictionPlugin CreatePlugin(
        HttpMessageHandler handler,
        int maxRetryAttempts)
    {
        var httpClient = new HttpClient(handler)
        {
            BaseAddress = new Uri("https://dam.example/")
        };
        var options = Options.Create(new DamPredictionPluginOptions
        {
            InitiatePath = "initiate",
            PredictionPath = "predict",
            MaxRetryAttempts = maxRetryAttempts,
            RetryBaseDelayMs = 1
        });

        return new DamPredictionPlugin(
            httpClient,
            Mock.Of<ILogger<DamPredictionPlugin>>(),
            options);
    }

    private static HttpResponseMessage CreateJsonResponse(HttpStatusCode statusCode, string json)
    {
        return new HttpResponseMessage(statusCode)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
    }

    private sealed class SequenceHttpMessageHandler : HttpMessageHandler
    {
        private readonly Queue<Func<HttpResponseMessage>> _responses;

        public SequenceHttpMessageHandler(params Func<HttpResponseMessage>[] responses)
        {
            _responses = new Queue<Func<HttpResponseMessage>>(responses);
        }

        public int RequestCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestCount++;
            if (_responses.Count == 0)
            {
                throw new InvalidOperationException("No HTTP response configured for this request.");
            }

            return Task.FromResult(_responses.Dequeue()());
        }
    }
}
