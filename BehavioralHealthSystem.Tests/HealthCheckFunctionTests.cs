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
            var configurationMock = new Mock<IConfiguration>();

            // Act
            var function = new HealthCheckFunction(loggerMock.Object, healthCheckServiceMock.Object, configurationMock.Object);

            // Assert
            Assert.IsNotNull(function);
        }
    }
}
