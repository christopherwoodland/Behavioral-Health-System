using System.Net.Http;
using System.Text;
using System.Threading;
using BehavioralHealthSystem.Dam.Services;
using Microsoft.Extensions.Options;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class LocalDamModelServiceTests
{
    [TestMethod]
    public async Task SubmitPredictionAsync_IncludesDemographicsInPayload()
    {
        var handler = new CapturingHttpMessageHandler();
        var service = new LocalDamModelService(
            new HttpClient(handler) { BaseAddress = new Uri("https://dam.example/") },
            Mock.Of<ILogger<LocalDamModelService>>(),
            Options.Create(new LocalDamModelOptions { PredictionPath = "predict" }));

        await service.SubmitPredictionAsync(new PredictionRequest
        {
            SessionId = "session-1",
            AudioData = new byte[] { 1, 2, 3 },
            AudioFileName = "audio.wav",
            Age = 42,
            WeightKg = 75.5
        });

        using var payload = JsonDocument.Parse(handler.RequestBody!);
        Assert.AreEqual(42, payload.RootElement.GetProperty("age").GetInt32());
        Assert.AreEqual(75.5, payload.RootElement.GetProperty("weightKg").GetDouble());
    }

    private sealed class CapturingHttpMessageHandler : HttpMessageHandler
    {
        public string? RequestBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestBody = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    "{\"session_id\":\"session-1\",\"status\":\"completed\"}",
                    Encoding.UTF8,
                    "application/json")
            };
        }
    }
}
