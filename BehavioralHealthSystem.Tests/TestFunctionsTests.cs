using Microsoft.VisualStudio.TestTools.UnitTesting;
using BehavioralHealthSystem.Functions;
using Microsoft.Extensions.Logging;
using BehavioralHealthSystem.Services.Interfaces;
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
            
            // Act
            var function = new TestFunctions(loggerMock.Object, apiServiceMock.Object);
            
            // Assert
            Assert.IsNotNull(function);
        }

        [TestMethod]
        public void TestFunctions_Constructor_ThrowsArgumentNullException_WhenLoggerIsNull()
        {
            // Arrange
            var apiServiceMock = new Mock<IKintsugiApiService>();
            
            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() => 
                new TestFunctions(null!, apiServiceMock.Object));
        }

        [TestMethod]
        public void TestFunctions_Constructor_ThrowsArgumentNullException_WhenApiServiceIsNull()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<TestFunctions>>();
            
            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() => 
                new TestFunctions(loggerMock.Object, null!));
        }
    }
}
