using BehavioralHealthSystem.Functions;
using BehavioralHealthSystem.Functions.Services;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for FeatureFlagsFunction
/// </summary>
[TestClass]
public class FeatureFlagsFunctionTests
{
    private Mock<ILogger<FeatureFlagsFunction>> _loggerMock = null!;
    private Mock<FeatureFlagsService> _featureFlagsServiceMock = null!;

    [TestInitialize]
    public void Setup()
    {
        _loggerMock = new Mock<ILogger<FeatureFlagsFunction>>();

        // FeatureFlagsService requires IConfiguration and ILogger<FeatureFlagsService>
        var mockConfig = new Mock<Microsoft.Extensions.Configuration.IConfiguration>();
        var mockServiceLogger = new Mock<ILogger<FeatureFlagsService>>();
        _featureFlagsServiceMock = new Mock<FeatureFlagsService>(mockConfig.Object, mockServiceLogger.Object);
    }

    #region Constructor Tests

    [TestMethod]
    public void Constructor_ValidArgs_CreatesInstance()
    {
        var function = new FeatureFlagsFunction(_loggerMock.Object, _featureFlagsServiceMock.Object);
        Assert.IsNotNull(function);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_NullLogger_ThrowsArgumentNullException()
    {
        new FeatureFlagsFunction(null!, _featureFlagsServiceMock.Object);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_NullFeatureFlagsService_ThrowsArgumentNullException()
    {
        new FeatureFlagsFunction(_loggerMock.Object, null!);
    }

    #endregion
}
