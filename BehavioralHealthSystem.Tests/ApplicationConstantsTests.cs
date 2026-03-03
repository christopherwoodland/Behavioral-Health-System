namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for ApplicationConstants static configuration values
/// </summary>
[TestClass]
public class ApplicationConstantsTests
{
    #region Timeout Tests

    [TestMethod]
    public void Timeouts_HttpClientTimeout_IsFiveMinutes()
    {
        Assert.AreEqual(TimeSpan.FromMinutes(5), ApplicationConstants.Timeouts.HttpClientTimeout);
    }

    [TestMethod]
    public void Timeouts_FileDownloadTimeout_IsTenMinutes()
    {
        Assert.AreEqual(TimeSpan.FromMinutes(10), ApplicationConstants.Timeouts.FileDownloadTimeout);
    }

    [TestMethod]
    public void Timeouts_ApiRequestTimeout_IsFiveMinutes()
    {
        Assert.AreEqual(TimeSpan.FromMinutes(5), ApplicationConstants.Timeouts.ApiRequestTimeout);
    }

    [TestMethod]
    public void Timeouts_UiPollingDelay_Is2000Milliseconds()
    {
        Assert.AreEqual(TimeSpan.FromMilliseconds(2000), ApplicationConstants.Timeouts.UiPollingDelay);
    }

    #endregion

    #region ContentType Tests

    [TestMethod]
    public void ContentTypes_ApplicationJson_IsCorrect()
    {
        Assert.AreEqual("application/json", ApplicationConstants.ContentTypes.ApplicationJson);
    }

    [TestMethod]
    public void ContentTypes_ApplicationJsonUtf8_IsCorrect()
    {
        Assert.AreEqual("application/json; charset=utf-8", ApplicationConstants.ContentTypes.ApplicationJsonUtf8);
    }

    #endregion

    #region UserLimits Tests

    [TestMethod]
    public void UserLimits_MinAge_Is18()
    {
        Assert.AreEqual(18, ApplicationConstants.UserLimits.MinAge);
    }

    [TestMethod]
    public void UserLimits_MaxAge_Is130()
    {
        Assert.AreEqual(130, ApplicationConstants.UserLimits.MaxAge);
    }

    [TestMethod]
    public void UserLimits_MinWeight_Is10()
    {
        Assert.AreEqual(10, ApplicationConstants.UserLimits.MinWeight);
    }

    [TestMethod]
    public void UserLimits_MaxWeight_Is1000()
    {
        Assert.AreEqual(1000, ApplicationConstants.UserLimits.MaxWeight);
    }

    [TestMethod]
    public void UserLimits_BatchProcessingMinAge_Is1()
    {
        Assert.AreEqual(1, ApplicationConstants.UserLimits.BatchProcessingMinAge);
    }

    [TestMethod]
    public void UserLimits_BatchProcessingMaxAge_Is150()
    {
        Assert.AreEqual(150, ApplicationConstants.UserLimits.BatchProcessingMaxAge);
    }

    #endregion

    #region Defaults Tests

    [TestMethod]
    public void Defaults_MaxRetryAttempts_Is3()
    {
        Assert.AreEqual(3, ApplicationConstants.Defaults.MaxRetryAttempts);
    }

    [TestMethod]
    public void Defaults_RetryDelayMilliseconds_Is1000()
    {
        Assert.AreEqual(1000, ApplicationConstants.Defaults.RetryDelayMilliseconds);
    }

    [TestMethod]
    public void Defaults_PollIntervalMilliseconds_Is3000()
    {
        Assert.AreEqual(3000, ApplicationConstants.Defaults.PollIntervalMilliseconds);
    }

    [TestMethod]
    public void Defaults_MaxTokens_Is2000()
    {
        Assert.AreEqual(2000, ApplicationConstants.Defaults.MaxTokens);
    }

    [TestMethod]
    public void Defaults_IncludeErrorDetails_IsFalse()
    {
        Assert.IsFalse(ApplicationConstants.Defaults.IncludeErrorDetails);
    }

    [TestMethod]
    public void Defaults_DefaultCulture_IsEnUS()
    {
        Assert.AreEqual("en-US", ApplicationConstants.Defaults.DefaultCulture);
    }

    [TestMethod]
    public void Defaults_DefaultPageSize_Is50()
    {
        Assert.AreEqual(50, ApplicationConstants.Defaults.DefaultPageSize);
    }

    [TestMethod]
    public void Defaults_MaxPageSize_Is1000()
    {
        Assert.AreEqual(1000, ApplicationConstants.Defaults.MaxPageSize);
    }

    #endregion

    #region Performance Tests

    [TestMethod]
    public void Performance_SlowOperationThresholdMs_Is5000()
    {
        Assert.AreEqual(5000L, ApplicationConstants.Performance.SlowOperationThresholdMs);
    }

    [TestMethod]
    public void Performance_VerySlowOperationThresholdMs_Is30000()
    {
        Assert.AreEqual(30000L, ApplicationConstants.Performance.VerySlowOperationThresholdMs);
    }

    [TestMethod]
    public void Performance_MemoryWarningThresholdMB_Is500()
    {
        Assert.AreEqual(500L, ApplicationConstants.Performance.MemoryWarningThresholdMB);
    }

    [TestMethod]
    public void Performance_SlowQueryThresholdMs_Is2000()
    {
        Assert.AreEqual(2000L, ApplicationConstants.Performance.SlowQueryThresholdMs);
    }

    #endregion

    #region TestData Tests

    [TestMethod]
    public void TestData_DefaultZipCode_Is12345()
    {
        Assert.AreEqual("12345", ApplicationConstants.TestData.DefaultZipCode);
    }

    [TestMethod]
    public void TestData_ExampleZipCode_Is90210()
    {
        Assert.AreEqual("90210", ApplicationConstants.TestData.ExampleZipCode);
    }

    #endregion
}
