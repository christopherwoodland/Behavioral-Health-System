using BehavioralHealthSystem.Configuration;

namespace BehavioralHealthSystem.Tests;

[TestClass]
public class KintsugiApiOptionsTests
{
    [TestMethod]
    public void Constructor_InitializesWithDefaultValues()
    {
        // Act
        var options = new KintsugiApiOptions();

        // Assert
        Assert.AreEqual(string.Empty, options.KintsugiApiKey);
        Assert.AreEqual("https://api.kintsugihealth.com/v2", options.KintsugiBaseUrl);
        Assert.AreEqual(300, options.TimeoutSeconds);
        Assert.AreEqual(3, options.MaxRetryAttempts);
        Assert.AreEqual(1000, options.RetryDelayMilliseconds);
        Assert.IsTrue(options.AutoProvideConsent);
    }

    [TestMethod]
    public void SectionName_HasCorrectValue()
    {
        // Assert
        Assert.AreEqual("KintsugiApi", KintsugiApiOptions.SectionName);
    }

    [TestMethod]
    public void Properties_CanBeSetAndRetrieved()
    {
        // Arrange
        var expectedApiKey = "test-kintsugi-api-key-456";
        var expectedBaseUrl = "https://api.staging.kintsugihealth.com/v2";
        var expectedTimeoutSeconds = 600;
        var expectedMaxRetryAttempts = 5;
        var expectedRetryDelayMs = 2000;
        var expectedAutoProvideConsent = false;

        // Act
        var options = new KintsugiApiOptions
        {
            KintsugiApiKey = expectedApiKey,
            KintsugiBaseUrl = expectedBaseUrl,
            TimeoutSeconds = expectedTimeoutSeconds,
            MaxRetryAttempts = expectedMaxRetryAttempts,
            RetryDelayMilliseconds = expectedRetryDelayMs,
            AutoProvideConsent = expectedAutoProvideConsent
        };

        // Assert
        Assert.AreEqual(expectedApiKey, options.KintsugiApiKey);
        Assert.AreEqual(expectedBaseUrl, options.KintsugiBaseUrl);
        Assert.AreEqual(expectedTimeoutSeconds, options.TimeoutSeconds);
        Assert.AreEqual(expectedMaxRetryAttempts, options.MaxRetryAttempts);
        Assert.AreEqual(expectedRetryDelayMs, options.RetryDelayMilliseconds);
        Assert.AreEqual(expectedAutoProvideConsent, options.AutoProvideConsent);
    }

    [TestMethod]
    public void KintsugiApiKey_AcceptsValidKeys()
    {
        // Arrange
        var options = new KintsugiApiOptions();
        var validKeys = new[]
        {
            "kintsugi_api_key_12345",
            "KINTSUGI-TEST-KEY",
            "",
            "very-long-api-key-with-special-characters-!@#$%",
            "simple-key"
        };

        // Act & Assert
        foreach (var key in validKeys)
        {
            options.KintsugiApiKey = key;
            Assert.AreEqual(key, options.KintsugiApiKey);
        }
    }

    [TestMethod]
    public void KintsugiBaseUrl_AcceptsValidUrls()
    {
        // Arrange
        var options = new KintsugiApiOptions();
        var validUrls = new[]
        {
            "https://api.kintsugihealth.com/v2",
            "https://api.staging.kintsugihealth.com/v2",
            "https://localhost:8080/api/v2",
            "http://internal-api.company.com/kintsugi",
            ""
        };

        // Act & Assert
        foreach (var url in validUrls)
        {
            options.KintsugiBaseUrl = url;
            Assert.AreEqual(url, options.KintsugiBaseUrl);
        }
    }

    [TestMethod]
    public void TimeoutSeconds_AcceptsValidValues()
    {
        // Arrange
        var options = new KintsugiApiOptions();
        var validTimeouts = new[] { 30, 60, 120, 300, 600, 900 };

        // Act & Assert
        foreach (var timeout in validTimeouts)
        {
            options.TimeoutSeconds = timeout;
            Assert.AreEqual(timeout, options.TimeoutSeconds);
        }
    }

    [TestMethod]
    public void TimeoutSeconds_AcceptsZeroAndNegativeValues()
    {
        // Arrange
        var options = new KintsugiApiOptions();

        // Act & Assert
        options.TimeoutSeconds = 0;
        Assert.AreEqual(0, options.TimeoutSeconds);

        options.TimeoutSeconds = -1;
        Assert.AreEqual(-1, options.TimeoutSeconds);
    }

    [TestMethod]
    public void MaxRetryAttempts_AcceptsValidValues()
    {
        // Arrange
        var options = new KintsugiApiOptions();
        var validAttempts = new[] { 0, 1, 3, 5, 10 };

        // Act & Assert
        foreach (var attempts in validAttempts)
        {
            options.MaxRetryAttempts = attempts;
            Assert.AreEqual(attempts, options.MaxRetryAttempts);
        }
    }

    [TestMethod]
    public void MaxRetryAttempts_AcceptsNegativeValues()
    {
        // Arrange
        var options = new KintsugiApiOptions();

        // Act & Assert
        options.MaxRetryAttempts = -1;
        Assert.AreEqual(-1, options.MaxRetryAttempts);
    }

    [TestMethod]
    public void RetryDelayMilliseconds_AcceptsValidValues()
    {
        // Arrange
        var options = new KintsugiApiOptions();
        var validDelays = new[] { 100, 500, 1000, 2000, 5000, 10000 };

        // Act & Assert
        foreach (var delay in validDelays)
        {
            options.RetryDelayMilliseconds = delay;
            Assert.AreEqual(delay, options.RetryDelayMilliseconds);
        }
    }

    [TestMethod]
    public void RetryDelayMilliseconds_AcceptsZeroAndNegativeValues()
    {
        // Arrange
        var options = new KintsugiApiOptions();

        // Act & Assert
        options.RetryDelayMilliseconds = 0;
        Assert.AreEqual(0, options.RetryDelayMilliseconds);

        options.RetryDelayMilliseconds = -500;
        Assert.AreEqual(-500, options.RetryDelayMilliseconds);
    }

    [TestMethod]
    public void AutoProvideConsent_AcceptsBooleanValues()
    {
        // Arrange
        var options = new KintsugiApiOptions();

        // Act & Assert
        options.AutoProvideConsent = true;
        Assert.IsTrue(options.AutoProvideConsent);

        options.AutoProvideConsent = false;
        Assert.IsFalse(options.AutoProvideConsent);
    }

    [TestMethod]
    public void ObjectInitializer_SetsAllProperties()
    {
        // Act
        var options = new KintsugiApiOptions
        {
            KintsugiApiKey = "test-api-key",
            KintsugiBaseUrl = "https://test.api.com/v2",
            TimeoutSeconds = 120,
            MaxRetryAttempts = 2,
            RetryDelayMilliseconds = 500,
            AutoProvideConsent = false
        };

        // Assert
        Assert.AreEqual("test-api-key", options.KintsugiApiKey);
        Assert.AreEqual("https://test.api.com/v2", options.KintsugiBaseUrl);
        Assert.AreEqual(120, options.TimeoutSeconds);
        Assert.AreEqual(2, options.MaxRetryAttempts);
        Assert.AreEqual(500, options.RetryDelayMilliseconds);
        Assert.IsFalse(options.AutoProvideConsent);
    }

    [TestMethod]
    public void PropertyAssignment_IsIndependent()
    {
        // Arrange
        var options1 = new KintsugiApiOptions();
        var options2 = new KintsugiApiOptions();

        // Act
        options1.KintsugiApiKey = "key1";
        options1.TimeoutSeconds = 100;
        options1.AutoProvideConsent = true;

        options2.KintsugiApiKey = "key2";
        options2.TimeoutSeconds = 200;
        options2.AutoProvideConsent = false;

        // Assert
        Assert.AreEqual("key1", options1.KintsugiApiKey);
        Assert.AreEqual(100, options1.TimeoutSeconds);
        Assert.IsTrue(options1.AutoProvideConsent);

        Assert.AreEqual("key2", options2.KintsugiApiKey);
        Assert.AreEqual(200, options2.TimeoutSeconds);
        Assert.IsFalse(options2.AutoProvideConsent);
    }

    [TestMethod]
    public void DefaultTimeout_IsReasonableForApiCalls()
    {
        // Arrange & Act
        var options = new KintsugiApiOptions();

        // Assert
        Assert.AreEqual(300, options.TimeoutSeconds); // 5 minutes
        Assert.IsTrue(options.TimeoutSeconds >= 30, "Timeout should be at least 30 seconds for API calls");
        Assert.IsTrue(options.TimeoutSeconds <= 900, "Timeout should not exceed 15 minutes for reasonable UX");
    }

    [TestMethod]
    public void DefaultRetrySettings_AreReasonable()
    {
        // Arrange & Act
        var options = new KintsugiApiOptions();

        // Assert
        Assert.AreEqual(3, options.MaxRetryAttempts);
        Assert.AreEqual(1000, options.RetryDelayMilliseconds); // 1 second
        Assert.IsTrue(options.MaxRetryAttempts >= 0, "Retry attempts should not be negative by default");
        Assert.IsTrue(options.RetryDelayMilliseconds >= 0, "Retry delay should not be negative by default");
    }

    [TestMethod]
    public void DefaultBaseUrl_PointsToProductionApi()
    {
        // Arrange & Act
        var options = new KintsugiApiOptions();

        // Assert
        Assert.AreEqual("https://api.kintsugihealth.com/v2", options.KintsugiBaseUrl);
        Assert.IsTrue(options.KintsugiBaseUrl.StartsWith("https://"), "Default URL should use HTTPS");
        Assert.IsTrue(options.KintsugiBaseUrl.Contains("kintsugihealth.com"), "Default URL should point to Kintsugi domain");
    }

    [TestMethod]
    public void DefaultAutoProvideConsent_IsEnabled()
    {
        // Arrange & Act
        var options = new KintsugiApiOptions();

        // Assert
        Assert.IsTrue(options.AutoProvideConsent, "Auto consent should be enabled by default for smoother API integration");
    }
}