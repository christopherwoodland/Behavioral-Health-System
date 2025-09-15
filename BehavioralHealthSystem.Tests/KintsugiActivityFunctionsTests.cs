// NOTE: KintsugiActivityFunctions are legacy from the orchestrator architecture
// and are no longer used in the simplified HTTP function architecture.
// These tests are preserved for reference but the functions themselves
// should be considered deprecated unless converted to standalone HTTP functions.

using BehavioralHealthSystem.Functions;
using Microsoft.Extensions.Logging;
using BehavioralHealthSystem.Services.Interfaces;
using Moq;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class KintsugiActivityFunctionsTests
    {
        [TestMethod]
        public void KintsugiActivityFunctions_Constructor_Succeeds()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<KintsugiActivityFunctions>>();
            var apiServiceMock = new Mock<IKintsugiApiService>();
            
            // Act
            var function = new KintsugiActivityFunctions(loggerMock.Object, apiServiceMock.Object);
            
            // Assert
            Assert.IsNotNull(function);
        }

        [TestMethod]
        public void KintsugiActivityFunctions_Constructor_ThrowsArgumentNullException_WhenLoggerIsNull()
        {
            // Arrange
            var apiServiceMock = new Mock<IKintsugiApiService>();
            
            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() => 
                new KintsugiActivityFunctions(null!, apiServiceMock.Object));
        }

        [TestMethod]
        public void KintsugiActivityFunctions_Constructor_ThrowsArgumentNullException_WhenApiServiceIsNull()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<KintsugiActivityFunctions>>();
            
            // Act & Assert
            Assert.ThrowsException<ArgumentNullException>(() => 
                new KintsugiActivityFunctions(loggerMock.Object, null!));
        }
    }
}
