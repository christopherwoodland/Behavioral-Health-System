using Azure.Core.Serialization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.IO;
using System.Threading;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class HealthCheckFunctionTests
    {
        private Mock<ILogger<HealthCheckFunction>> _loggerMock = null!;
        private Mock<HealthCheckService> _healthCheckServiceMock = null!;
        private Mock<IConfiguration> _configurationMock = null!;

        [TestInitialize]
        public void Setup()
        {
            _loggerMock = new Mock<ILogger<HealthCheckFunction>>();
            _healthCheckServiceMock = new Mock<HealthCheckService>();
            _configurationMock = new Mock<IConfiguration>();
        }

        #region Constructor Tests

        [TestMethod]
        public void Constructor_ValidArgs_CreatesInstance()
        {
            var function = new HealthCheckFunction(
                _loggerMock.Object,
                _healthCheckServiceMock.Object,
                _configurationMock.Object);

            Assert.IsNotNull(function);
        }

        [TestMethod]
        [ExpectedException(typeof(ArgumentNullException))]
        public void Constructor_NullLogger_ThrowsArgumentNullException()
        {
            new HealthCheckFunction(null!, _healthCheckServiceMock.Object, _configurationMock.Object);
        }

        [TestMethod]
        [ExpectedException(typeof(ArgumentNullException))]
        public void Constructor_NullHealthCheckService_ThrowsArgumentNullException()
        {
            new HealthCheckFunction(_loggerMock.Object, null!, _configurationMock.Object);
        }

        [TestMethod]
        [ExpectedException(typeof(ArgumentNullException))]
        public void Constructor_NullConfiguration_ThrowsArgumentNullException()
        {
            new HealthCheckFunction(_loggerMock.Object, _healthCheckServiceMock.Object, null!);
        }

        #endregion

        [TestMethod]
        public async Task HealthCheck_ConfiguredSpeechAndFoundry_ReturnsDashboardResourceStatuses()
        {
            var healthReport = new HealthReport(
                new Dictionary<string, HealthReportEntry>(),
                TimeSpan.FromMilliseconds(12));
            _healthCheckServiceMock
                .Setup(service => service.CheckHealthAsync(
                    It.IsAny<Func<HealthCheckRegistration, bool>?>(),
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(healthReport);

            var configuration = new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["AZURE_SPEECH_ENDPOINT"] = "https://example.cognitiveservices.azure.com/",
                    ["AZURE_SPEECH_ENHANCED_MODEL"] = "mai-transcribe-1.5",
                    ["AZURE_SPEECH_TRANSCRIBE_STYLE"] = "verbatim",
                    ["FOUNDRY_PROJECT_ENDPOINT"] = "https://example.services.ai.azure.com/api/projects/test",
                    ["FOUNDRY_DEEP_ANALYSIS_ENABLED"] = "true",
                    ["FOUNDRY_DEEP_ANALYSIS_AGENT_VERSION"] = "5"
                })
                .Build();
            var function = new HealthCheckFunction(
                _loggerMock.Object,
                _healthCheckServiceMock.Object,
                configuration);

            var response = await function.HealthCheck(CreateRequest());

            Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
            response.Body.Position = 0;
            using var document = await JsonDocument.ParseAsync(response.Body);
            var resources = document.RootElement.GetProperty("resources");
            Assert.AreEqual("mai-transcribe-1.5 / verbatim", resources.GetProperty("speechToText").GetString());
            Assert.AreEqual("Extended v5", resources.GetProperty("foundryAgents").GetString());
        }

        private static HttpRequestData CreateRequest()
        {
            var services = new ServiceCollection();
            services.AddOptions<WorkerOptions>()
                .Configure(options => options.Serializer = new JsonObjectSerializer());
            var serviceProvider = services.BuildServiceProvider();

            var context = new Mock<FunctionContext>();
            context.SetupGet(value => value.InstanceServices).Returns(serviceProvider);

            var request = new Mock<HttpRequestData>(MockBehavior.Loose, context.Object);
            request.Setup(value => value.CreateResponse())
                .Returns(() => CreateResponse(context.Object));
            return request.Object;
        }

        private static HttpResponseData CreateResponse(FunctionContext context)
        {
            var response = new Mock<HttpResponseData>(MockBehavior.Loose, context);
            response.SetupProperty(value => value.StatusCode, HttpStatusCode.OK);
            response.SetupGet(value => value.Headers).Returns(new HttpHeadersCollection());
            response.SetupGet(value => value.Body).Returns(new MemoryStream());
            return response.Object;
        }
    }
}
