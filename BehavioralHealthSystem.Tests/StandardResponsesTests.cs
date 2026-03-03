namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for StandardErrorResponse and StandardSuccessResponse models
/// </summary>
[TestClass]
public class StandardResponsesTests
{
    #region StandardErrorResponse Tests

    [TestMethod]
    public void ErrorResponse_DefaultValues_AreCorrect()
    {
        var response = new StandardErrorResponse();

        Assert.IsFalse(response.Success);
        Assert.AreEqual(string.Empty, response.Message);
        Assert.IsNull(response.Details);
        Assert.IsNull(response.Code);
        Assert.IsNotNull(response.Timestamp);
        Assert.IsNull(response.CorrelationId);
        Assert.IsNull(response.Context);
    }

    [TestMethod]
    public void ErrorResponse_Create_WithMessage_SetsCorrectValues()
    {
        var response = StandardErrorResponse.Create("Something failed");

        Assert.IsFalse(response.Success);
        Assert.AreEqual("Something failed", response.Message);
        Assert.IsNull(response.Code);
        Assert.IsNull(response.Details);
    }

    [TestMethod]
    public void ErrorResponse_Create_WithMessageAndCode_SetsCorrectValues()
    {
        var response = StandardErrorResponse.Create("Not found", "NOT_FOUND");

        Assert.AreEqual("Not found", response.Message);
        Assert.AreEqual("NOT_FOUND", response.Code);
    }

    [TestMethod]
    public void ErrorResponse_Create_WithAllParams_SetsCorrectValues()
    {
        var response = StandardErrorResponse.Create("Validation failed", "VALIDATION_ERROR", details: "Field X is required");

        Assert.AreEqual("Validation failed", response.Message);
        Assert.AreEqual("VALIDATION_ERROR", response.Code);
        Assert.AreEqual("Field X is required", response.Details);
    }

    [TestMethod]
    public void ErrorResponse_Create_WithContext_SetsCorrectValues()
    {
        var context = new Dictionary<string, object> { { "field", "userId" }, { "value", "" } };
        var response = StandardErrorResponse.Create("Validation error", "VALIDATION", context);

        Assert.AreEqual("Validation error", response.Message);
        Assert.IsNotNull(response.Context);
        Assert.AreEqual(2, response.Context.Count);
    }

    #endregion

    #region StandardSuccessResponse<T> Tests

    [TestMethod]
    public void SuccessResponseT_DefaultValues_AreCorrect()
    {
        var response = new StandardSuccessResponse<string>();

        Assert.IsTrue(response.Success);
        Assert.AreEqual("Operation completed successfully", response.Message);
        Assert.IsNull(response.Data);
        Assert.IsNull(response.CorrelationId);
        Assert.IsNull(response.Metadata);
    }

    [TestMethod]
    public void SuccessResponseT_Create_WithData_SetsCorrectValues()
    {
        var response = StandardSuccessResponse<int>.Create(42);

        Assert.IsTrue(response.Success);
        Assert.AreEqual(42, response.Data);
        Assert.AreEqual("Operation completed successfully", response.Message);
    }

    [TestMethod]
    public void SuccessResponseT_Create_WithDataAndMessage_SetsCorrectValues()
    {
        var response = StandardSuccessResponse<string>.Create("result-data", "Custom message");

        Assert.AreEqual("result-data", response.Data);
        Assert.AreEqual("Custom message", response.Message);
    }

    [TestMethod]
    public void SuccessResponseT_Create_WithMetadata_SetsCorrectValues()
    {
        var metadata = new Dictionary<string, object> { { "count", 10 } };
        var response = StandardSuccessResponse<List<string>>.Create(
            new List<string> { "a", "b" }, "Found items", metadata);

        Assert.AreEqual(2, response.Data!.Count);
        Assert.AreEqual("Found items", response.Message);
        Assert.IsNotNull(response.Metadata);
        Assert.AreEqual(10, response.Metadata["count"]);
    }

    #endregion

    #region StandardSuccessResponse (non-generic) Tests

    [TestMethod]
    public void SuccessResponse_Create_WithDefaultMessage()
    {
        var response = StandardSuccessResponse.Create();

        Assert.IsTrue(response.Success);
        Assert.AreEqual("Operation completed successfully", response.Message);
    }

    [TestMethod]
    public void SuccessResponse_Create_WithCustomMessage()
    {
        var response = StandardSuccessResponse.Create("Done!");

        Assert.AreEqual("Done!", response.Message);
        Assert.IsTrue(response.Success);
    }

    #endregion
}
