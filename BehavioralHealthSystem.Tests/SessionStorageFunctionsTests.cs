using Microsoft.VisualStudio.TestTools.UnitTesting;
using BehavioralHealthSystem.Functions;
using Microsoft.Extensions.Logging;
using BehavioralHealthSystem.Services.Interfaces;
using BehavioralHealthSystem.Services;
using Moq;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class SessionStorageFunctionsTests
    {
        [TestMethod]
        public void SessionStorageFunctions_Constructor_Succeeds()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<SessionStorageFunctions>>();
            var sessionStorageServiceMock = new Mock<ISessionStorageService>();
            
            // Act
            var function = new SessionStorageFunctions(loggerMock.Object, sessionStorageServiceMock.Object);
            
            // Assert
            Assert.IsNotNull(function);
        }

        [TestMethod]
        public void SessionStorageFunctions_Constructor_ThrowsArgumentNullException_WhenLoggerIsNull()
        {
            // Arrange
            var sessionStorageServiceMock = new Mock<ISessionStorageService>();
            
            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() => 
                new SessionStorageFunctions(null!, sessionStorageServiceMock.Object));
        }

        [TestMethod]
        public void SessionStorageFunctions_Constructor_ThrowsArgumentNullException_WhenSessionStorageServiceIsNull()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<SessionStorageFunctions>>();
            
            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() => 
                new SessionStorageFunctions(loggerMock.Object, null!));
        }
    }
}