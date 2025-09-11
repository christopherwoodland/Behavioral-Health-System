using Microsoft.VisualStudio.TestTools.UnitTesting;
using BehavioralHealthSystem.Functions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Moq;

namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class HealthCheckFunctionTests
    {
        [TestMethod]
        public void HealthCheckFunction_Constructor_Succeeds()
        {
            // Arrange
            var loggerMock = new Mock<ILogger<HealthCheckFunction>>();
            var healthCheckServiceMock = new Mock<HealthCheckService>();
            
            // Act
            var function = new HealthCheckFunction(loggerMock.Object, healthCheckServiceMock.Object);
            
            // Assert
            Assert.IsNotNull(function);
        }
    }
}
