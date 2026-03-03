namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for ExtendedAssessmentOpenAIOptions configuration class
/// </summary>
[TestClass]
public class ExtendedAssessmentOpenAIOptionsTests
{
    #region Default Value Tests

    [TestMethod]
    public void SectionName_IsExtendedAssessmentOpenAI()
    {
        Assert.AreEqual("ExtendedAssessmentOpenAI", ExtendedAssessmentOpenAIOptions.SectionName);
    }

    [TestMethod]
    public void DefaultValues_AreCorrect()
    {
        var options = new ExtendedAssessmentOpenAIOptions();

        Assert.AreEqual(string.Empty, options.Endpoint);
        Assert.AreEqual(string.Empty, options.ApiKey);
        Assert.AreEqual(string.Empty, options.DeploymentName);
        Assert.AreEqual("2024-08-01-preview", options.ApiVersion);
        Assert.AreEqual(4000, options.MaxTokens);
        Assert.AreEqual(0.2, options.Temperature);
        Assert.IsFalse(options.Enabled);
        Assert.AreEqual(120, options.TimeoutSeconds);
        Assert.IsTrue(options.UseFallbackToStandardConfig);
    }

    #endregion

    #region Property Setter Tests

    [TestMethod]
    public void Endpoint_SetAndGet_ReturnsSetValue()
    {
        var options = new ExtendedAssessmentOpenAIOptions
        {
            Endpoint = "https://my-endpoint.openai.azure.com/"
        };

        Assert.AreEqual("https://my-endpoint.openai.azure.com/", options.Endpoint);
    }

    [TestMethod]
    public void ApiKey_SetAndGet_ReturnsSetValue()
    {
        var options = new ExtendedAssessmentOpenAIOptions { ApiKey = "test-key-123" };

        Assert.AreEqual("test-key-123", options.ApiKey);
    }

    [TestMethod]
    public void DeploymentName_SetAndGet_ReturnsSetValue()
    {
        var options = new ExtendedAssessmentOpenAIOptions { DeploymentName = "gpt-4" };

        Assert.AreEqual("gpt-4", options.DeploymentName);
    }

    [TestMethod]
    public void MaxTokens_SetAndGet_ReturnsSetValue()
    {
        var options = new ExtendedAssessmentOpenAIOptions { MaxTokens = 8000 };

        Assert.AreEqual(8000, options.MaxTokens);
    }

    [TestMethod]
    public void Temperature_SetAndGet_ReturnsSetValue()
    {
        var options = new ExtendedAssessmentOpenAIOptions { Temperature = 0.7 };

        Assert.AreEqual(0.7, options.Temperature);
    }

    [TestMethod]
    public void Enabled_SetToTrue_ReturnsTrue()
    {
        var options = new ExtendedAssessmentOpenAIOptions { Enabled = true };

        Assert.IsTrue(options.Enabled);
    }

    [TestMethod]
    public void TimeoutSeconds_SetAndGet_ReturnsSetValue()
    {
        var options = new ExtendedAssessmentOpenAIOptions { TimeoutSeconds = 300 };

        Assert.AreEqual(300, options.TimeoutSeconds);
    }

    [TestMethod]
    public void UseFallbackToStandardConfig_SetToFalse_ReturnsFalse()
    {
        var options = new ExtendedAssessmentOpenAIOptions { UseFallbackToStandardConfig = false };

        Assert.IsFalse(options.UseFallbackToStandardConfig);
    }

    #endregion

    #region Property Independence Tests

    [TestMethod]
    public void Properties_AreIndependent()
    {
        var options = new ExtendedAssessmentOpenAIOptions
        {
            Endpoint = "https://test.openai.azure.com/",
            ApiKey = "key-123",
            DeploymentName = "gpt-5",
            ApiVersion = "2025-01-01",
            MaxTokens = 2000,
            Temperature = 0.5,
            Enabled = true,
            TimeoutSeconds = 60,
            UseFallbackToStandardConfig = false
        };

        Assert.AreEqual("https://test.openai.azure.com/", options.Endpoint);
        Assert.AreEqual("key-123", options.ApiKey);
        Assert.AreEqual("gpt-5", options.DeploymentName);
        Assert.AreEqual("2025-01-01", options.ApiVersion);
        Assert.AreEqual(2000, options.MaxTokens);
        Assert.AreEqual(0.5, options.Temperature);
        Assert.IsTrue(options.Enabled);
        Assert.AreEqual(60, options.TimeoutSeconds);
        Assert.IsFalse(options.UseFallbackToStandardConfig);
    }

    #endregion
}
