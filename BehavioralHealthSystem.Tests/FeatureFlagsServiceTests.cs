using BehavioralHealthSystem.Functions.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for FeatureFlagsService
/// </summary>
[TestClass]
public class FeatureFlagsServiceTests
{
    private Mock<IConfiguration> _mockConfiguration = null!;
    private Mock<ILogger<FeatureFlagsService>> _mockLogger = null!;
    private FeatureFlagsService _service = null!;

    [TestInitialize]
    public void Setup()
    {
        _mockConfiguration = new Mock<IConfiguration>();
        _mockLogger = new Mock<ILogger<FeatureFlagsService>>();
        _service = new FeatureFlagsService(_mockConfiguration.Object, _mockLogger.Object);
    }

    #region Constructor Tests

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_NullConfiguration_ThrowsArgumentNullException()
    {
        new FeatureFlagsService(null!, _mockLogger.Object);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_NullLogger_ThrowsArgumentNullException()
    {
        new FeatureFlagsService(_mockConfiguration.Object, null!);
    }

    [TestMethod]
    public void Constructor_ValidArgs_CreatesInstance()
    {
        var service = new FeatureFlagsService(_mockConfiguration.Object, _mockLogger.Object);
        Assert.IsNotNull(service);
    }

    #endregion

    #region IsFeatureEnabled Tests

    [TestMethod]
    public void IsFeatureEnabled_ValueInConfig_ReturnsTrue()
    {
        _mockConfiguration.Setup(c => c["Values:ENABLE_FEATURE"]).Returns("true");

        var result = _service.IsFeatureEnabled("ENABLE_FEATURE");

        Assert.IsTrue(result);
    }

    [TestMethod]
    public void IsFeatureEnabled_ValueFalseInConfig_ReturnsFalse()
    {
        _mockConfiguration.Setup(c => c["Values:ENABLE_FEATURE"]).Returns("false");

        var result = _service.IsFeatureEnabled("ENABLE_FEATURE");

        Assert.IsFalse(result);
    }

    [TestMethod]
    public void IsFeatureEnabled_FallbackToDirectKey_ReturnsValue()
    {
        _mockConfiguration.Setup(c => c["Values:MY_FLAG"]).Returns((string?)null);
        _mockConfiguration.Setup(c => c["MY_FLAG"]).Returns("true");

        var result = _service.IsFeatureEnabled("MY_FLAG");

        Assert.IsTrue(result);
    }

    [TestMethod]
    public void IsFeatureEnabled_NotInConfig_ReturnsDefaultTrue()
    {
        _mockConfiguration.Setup(c => c[It.IsAny<string>()]).Returns((string?)null);

        var result = _service.IsFeatureEnabled("MISSING_FLAG", defaultValue: true);

        Assert.IsTrue(result);
    }

    [TestMethod]
    public void IsFeatureEnabled_NotInConfig_ReturnsDefaultFalse()
    {
        _mockConfiguration.Setup(c => c[It.IsAny<string>()]).Returns((string?)null);

        var result = _service.IsFeatureEnabled("MISSING_FLAG", defaultValue: false);

        Assert.IsFalse(result);
    }

    [TestMethod]
    public void IsFeatureEnabled_InvalidBoolString_ReturnsDefault()
    {
        _mockConfiguration.Setup(c => c["Values:BAD_FLAG"]).Returns("not-a-bool");

        var result = _service.IsFeatureEnabled("BAD_FLAG", defaultValue: false);

        Assert.IsFalse(result);
    }

    [TestMethod]
    public void IsFeatureEnabled_CachesResult_ReturnsFromCache()
    {
        _mockConfiguration.Setup(c => c["Values:CACHED_FLAG"]).Returns("true");

        // First call - reads from config
        var result1 = _service.IsFeatureEnabled("CACHED_FLAG");
        // Second call - should come from cache
        var result2 = _service.IsFeatureEnabled("CACHED_FLAG");

        Assert.IsTrue(result1);
        Assert.IsTrue(result2);

        // Config should only be hit once due to caching
        _mockConfiguration.Verify(c => c["Values:CACHED_FLAG"], Times.Once);
    }

    [TestMethod]
    public void IsFeatureEnabled_ConfigThrows_ReturnsDefault()
    {
        _mockConfiguration.Setup(c => c["Values:ERROR_FLAG"]).Throws(new InvalidOperationException("boom"));

        var result = _service.IsFeatureEnabled("ERROR_FLAG", defaultValue: true);

        Assert.IsTrue(result);
    }

    #endregion

    #region GetAllFeatureFlags Tests

    [TestMethod]
    public void GetAllFeatureFlags_EmptyKnownFlags_ReturnsEmptyDictionary()
    {
        var result = _service.GetAllFeatureFlags();

        Assert.IsNotNull(result);
        Assert.AreEqual(0, result.Count);
    }

    #endregion

    #region ClearCache Tests

    [TestMethod]
    public void ClearCache_AfterCaching_ForcesReRead()
    {
        _mockConfiguration.Setup(c => c["Values:CLEAR_FLAG"]).Returns("true");

        // First call - caches "true"
        _service.IsFeatureEnabled("CLEAR_FLAG");

        // Clear cache
        _service.ClearCache();

        // Change config response
        _mockConfiguration.Setup(c => c["Values:CLEAR_FLAG"]).Returns("false");

        // Should re-read from config
        var result = _service.IsFeatureEnabled("CLEAR_FLAG");

        Assert.IsFalse(result);
    }

    #endregion
}
