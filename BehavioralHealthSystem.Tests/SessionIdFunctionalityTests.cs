// NOTE: These tests validate functionality that is available through the service layer
// and validate interface contracts and model properties.

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class SessionIdFunctionalityTests
    {
        private Mock<ILogger<TestFunctions>> _mockLogger = null!;
        private Mock<IKintsugiApiService> _mockKintsugiApiService = null!;
        private Mock<ISessionStorageService> _mockSessionStorageService = null!;
        private TestFunctions _testFunctions = null!;

        [TestInitialize]
        public void Setup()
        {
            _mockLogger = new Mock<ILogger<TestFunctions>>();
            _mockKintsugiApiService = new Mock<IKintsugiApiService>();
            _mockSessionStorageService = new Mock<ISessionStorageService>();
            var mockValidator = new Mock<IValidator<InitiateRequest>>();
            _testFunctions = new TestFunctions(_mockLogger.Object, _mockKintsugiApiService.Object, _mockSessionStorageService.Object, mockValidator.Object);
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
