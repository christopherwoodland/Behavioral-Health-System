using Microsoft.VisualStudio.TestTools.UnitTesting;
using BehavioralHealthSystem.Functions;
using Microsoft.Extensions.Logging;
using BehavioralHealthSystem.Services.Interfaces;
using BehavioralHealthSystem.Services;
using Moq;

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
            
            // Act
            var function = new TestFunctions(loggerMock.Object, apiServiceMock.Object, sessionStorageServiceMock.Object);
            
            // Assert
            Assert.IsNotNull(function);
        }

        [TestMethod]
        public void TestFunctions_Constructor_ThrowsArgumentNullException_WhenLoggerIsNull()
        {
            // Arrange
            var apiServiceMock = new Mock<IKintsugiApiService>();
            var sessionStorageServiceMock = new Mock<ISessionStorageService>();
            
            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() => 
                new TestFunctions(null!, apiServiceMock.Object, sessionStorageServiceMock.Object));
        }

        [TestMethod]
        public void TestFunctions_Constructor_ThrowsArgumentNullException_WhenApiServiceIsNull()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<TestFunctions>>();
            var sessionStorageServiceMock = new Mock<ISessionStorageService>();
            
            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() => 
                new TestFunctions(loggerMock.Object, null!, sessionStorageServiceMock.Object));
        }

        [TestMethod]
        public void TestFunctions_Constructor_ThrowsArgumentNullException_WhenSessionStorageServiceIsNull()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<TestFunctions>>();
            var apiServiceMock = new Mock<IKintsugiApiService>();
            
            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() => 
                new TestFunctions(loggerMock.Object, apiServiceMock.Object, null!));
        }
    }
}
