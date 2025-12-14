using Azure.Storage.Blobs;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class TestFunctionsTests
    {
        [TestMethod]
        public void TestFunctions_Constructor_Succeeds()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<TestFunctions>>();
            var apiServiceMock = new Mock<IKintsugiApiService>();
            var sessionStorageServiceMock = new Mock<ISessionStorageService>();
            var validatorMock = new Mock<IValidator<InitiateRequest>>();
            var blobServiceClientMock = new Mock<BlobServiceClient>();

            // Act
            var function = new TestFunctions(loggerMock.Object, apiServiceMock.Object, sessionStorageServiceMock.Object, validatorMock.Object, blobServiceClientMock.Object);

            // Assert
            Assert.IsNotNull(function);
        }

        [TestMethod]
        public void TestFunctions_Constructor_ThrowsArgumentNullException_WhenLoggerIsNull()
        {
            // Arrange
            var apiServiceMock = new Mock<IKintsugiApiService>();
            var sessionStorageServiceMock = new Mock<ISessionStorageService>();
            var validatorMock = new Mock<IValidator<InitiateRequest>>();
            var blobServiceClientMock = new Mock<BlobServiceClient>();

            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() =>
                new TestFunctions(null!, apiServiceMock.Object, sessionStorageServiceMock.Object, validatorMock.Object, blobServiceClientMock.Object));
        }

        [TestMethod]
        public void TestFunctions_Constructor_ThrowsArgumentNullException_WhenApiServiceIsNull()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<TestFunctions>>();
            var sessionStorageServiceMock = new Mock<ISessionStorageService>();
            var validatorMock = new Mock<IValidator<InitiateRequest>>();
            var blobServiceClientMock = new Mock<BlobServiceClient>();

            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() =>
                new TestFunctions(loggerMock.Object, null!, sessionStorageServiceMock.Object, validatorMock.Object, blobServiceClientMock.Object));
        }

        [TestMethod]
        public void TestFunctions_Constructor_ThrowsArgumentNullException_WhenSessionStorageServiceIsNull()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<TestFunctions>>();
            var apiServiceMock = new Mock<IKintsugiApiService>();
            var validatorMock = new Mock<IValidator<InitiateRequest>>();
            var blobServiceClientMock = new Mock<BlobServiceClient>();

            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() =>
                new TestFunctions(loggerMock.Object, apiServiceMock.Object, null!, validatorMock.Object, blobServiceClientMock.Object));
        }
    }
}
