using Microsoft.Extensions.Diagnostics.HealthChecks;

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
    }
}
