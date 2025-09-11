// NOTE: These tests are for activity functions that were used in the orchestrator architecture.
// The simplified architecture uses KintsugiWorkflowFunction directly with IKintsugiApiService.
// These tests validate functionality that is still available through the service layer
// but are no longer used through activity functions.

using Microsoft.VisualStudio.TestTools.UnitTesting;
using Moq;
using Microsoft.Extensions.Logging;
using BehavioralHealthSystem.Services.Interfaces;
using BehavioralHealthSystem.Functions;
using BehavioralHealthSystem.Models;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker;
using System.Text.Json;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class SessionIdFunctionalityTests
    {
        private Mock<ILogger<TestFunctions>> _mockLogger = null!;
        private Mock<IKintsugiApiService> _mockKintsugiApiService = null!;
        private Mock<ILogger<KintsugiActivityFunctions>> _mockActivityLogger = null!;
        private TestFunctions _testFunctions = null!;
        private KintsugiActivityFunctions _activityFunctions = null!;

        [TestInitialize]
        public void Setup()
        {
            _mockLogger = new Mock<ILogger<TestFunctions>>();
            _mockKintsugiApiService = new Mock<IKintsugiApiService>();
            _mockActivityLogger = new Mock<ILogger<KintsugiActivityFunctions>>();
            _testFunctions = new TestFunctions(_mockLogger.Object, _mockKintsugiApiService.Object);
            _activityFunctions = new KintsugiActivityFunctions(_mockActivityLogger.Object, _mockKintsugiApiService.Object);
        }

        [TestMethod]
        [Ignore("Activity functions are deprecated - functionality moved to KintsugiWorkflowFunction")]
        public async Task GetPredictionResultBySessionIdActivity_ValidSessionId_ReturnsResult()
        {
            // Arrange
            var sessionId = "test-session-123";
            var expectedResult = new SessionPredictionResult
            {
                Status = "completed",
                PredictedScore = "0.75",
                CreatedAt = "2023-01-01T00:00:00Z"
            };

            _mockKintsugiApiService
                .Setup(s => s.GetPredictionResultBySessionIdAsync(sessionId, It.IsAny<CancellationToken>()))
                .ReturnsAsync(expectedResult);

            // Act
            var result = await _activityFunctions.GetPredictionResultBySessionIdActivity(sessionId);

            // Assert
            Assert.IsNotNull(result);
            Assert.AreEqual("completed", result.Status);
            Assert.AreEqual("0.75", result.PredictedScore);
        }

        [TestMethod]
        [Ignore("Activity functions are deprecated - functionality moved to KintsugiWorkflowFunction")]
        public async Task GetPredictionResultBySessionIdActivity_InvalidSessionId_ReturnsNull()
        {
            // Arrange
            var sessionId = "invalid-session-123";

            _mockKintsugiApiService
                .Setup(s => s.GetPredictionResultBySessionIdAsync(sessionId, It.IsAny<CancellationToken>()))
                .ReturnsAsync((SessionPredictionResult?)null);

            // Act
            var result = await _activityFunctions.GetPredictionResultBySessionIdActivity(sessionId);

            // Assert
            Assert.IsNull(result);
        }

        [TestMethod]
        [Ignore("Activity functions are deprecated - functionality moved to KintsugiWorkflowFunction")]
        public async Task GetPredictionResultBySessionIdActivity_ServiceThrowsException_PropagatesException()
        {
            // Arrange
            var sessionId = "error-session-123";
            var expectedException = new HttpRequestException("API error", null, System.Net.HttpStatusCode.InternalServerError);

            _mockKintsugiApiService
                .Setup(s => s.GetPredictionResultBySessionIdAsync(sessionId, It.IsAny<CancellationToken>()))
                .ThrowsAsync(expectedException);

            // Act & Assert
            var exception = await Assert.ThrowsExceptionAsync<HttpRequestException>(
                () => _activityFunctions.GetPredictionResultBySessionIdActivity(sessionId)
            );

            Assert.AreEqual("API error", exception.Message);
        }

        [TestMethod]
        public void KintsugiApiService_Interface_IncludesSessionIdMethod()
        {
            // Arrange & Act
            var serviceInterface = typeof(IKintsugiApiService);
            var methods = serviceInterface.GetMethods();
            var sessionIdMethod = methods.FirstOrDefault(m => 
                m.Name == "GetPredictionResultBySessionIdAsync" && 
                m.GetParameters().Length >= 1 &&
                m.GetParameters()[0].ParameterType == typeof(string));

            // Assert
            Assert.IsNotNull(sessionIdMethod, "GetPredictionResultBySessionIdAsync method should exist in IKintsugiApiService");
            Assert.AreEqual(typeof(Task<SessionPredictionResult?>), sessionIdMethod.ReturnType);
        }

        [TestMethod]
        public void ApiErrorResponse_HasEnhancedErrorFields()
        {
            // Arrange & Act
            var errorResponse = new ApiErrorResponse
            {
                Message = "Test error",
                Error = "test_error_code",
                Details = "Additional error details",
                AdditionalData = new Dictionary<string, object> { { "key", "value" } }
            };

            // Assert
            Assert.AreEqual("Test error", errorResponse.Message);
            Assert.AreEqual("test_error_code", errorResponse.Error);
            Assert.AreEqual("Additional error details", errorResponse.Details);
            Assert.IsNotNull(errorResponse.AdditionalData);
            Assert.AreEqual("value", errorResponse.AdditionalData["key"]);
        }

        [TestMethod]
        public void PredictionResult_HasSessionIdProperty()
        {
            // Arrange & Act
            var predictionResult = new PredictionResult
            {
                SessionId = "test-session-id-456"
            };

            // Assert
            Assert.AreEqual("test-session-id-456", predictionResult.SessionId);
        }
    }
}
