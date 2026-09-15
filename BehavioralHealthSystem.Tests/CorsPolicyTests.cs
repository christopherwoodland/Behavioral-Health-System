using BehavioralHealthSystem.Functions.Services;

namespace BehavioralHealthSystem.Tests;

[TestClass]
[DoNotParallelize]
public class CorsPolicyTests
{
    private string? _originalAllowedOrigins;

    [TestInitialize]
    public void SaveEnvironment()
    {
        _originalAllowedOrigins = Environment.GetEnvironmentVariable("ALLOWED_ORIGINS");
    }

    [TestCleanup]
    public void RestoreEnvironment()
    {
        Environment.SetEnvironmentVariable("ALLOWED_ORIGINS", _originalAllowedOrigins);
    }

    [TestMethod]
    public void DefaultOrigins_AllowLocalhostAndLoopbackDevelopmentPorts()
    {
        Environment.SetEnvironmentVariable("ALLOWED_ORIGINS", null);

        Assert.IsTrue(CorsPolicy.IsOriginAllowed("http://localhost:5174"));
        Assert.IsTrue(CorsPolicy.IsOriginAllowed("http://127.0.0.1:5174"));
    }

    [TestMethod]
    public void UnknownOrigin_IsDenied()
    {
        Environment.SetEnvironmentVariable("ALLOWED_ORIGINS", null);

        Assert.IsFalse(CorsPolicy.IsOriginAllowed("https://example.com"));
    }

    [TestMethod]
    public void ConfiguredOrigins_ReplaceDefaultsAndTrimWhitespace()
    {
        Environment.SetEnvironmentVariable(
            "ALLOWED_ORIGINS",
            " https://app.example.com, http://127.0.0.1:5174 ");

        Assert.IsTrue(CorsPolicy.IsOriginAllowed("https://app.example.com"));
        Assert.IsTrue(CorsPolicy.IsOriginAllowed("http://127.0.0.1:5174"));
        Assert.IsFalse(CorsPolicy.IsOriginAllowed("http://localhost:5174"));
    }
}
