namespace BehavioralHealthSystem.Tests;

[TestClass]
public class ApiErrorResponseTests
{
    [TestMethod]
    public void Constructor_DefaultValues_AreCorrect()
    {
        var response = new ApiErrorResponse();

        Assert.AreEqual(string.Empty, response.Message);
        Assert.AreEqual(string.Empty, response.Error);
        Assert.IsNotNull(response.AdditionalData);
        Assert.AreEqual(0, response.AdditionalData.Count);
        Assert.IsNull(response.Details);
    }

    [TestMethod]
    public void Properties_SetAndGet_ReturnCorrectValues()
    {
        var response = new ApiErrorResponse
        {
            Message = "Something went wrong",
            Error = "InternalError",
            Details = "Stack trace here"
        };

        Assert.AreEqual("Something went wrong", response.Message);
        Assert.AreEqual("InternalError", response.Error);
        Assert.AreEqual("Stack trace here", response.Details);
    }

    [TestMethod]
    public void AdditionalData_CanAddEntries()
    {
        var response = new ApiErrorResponse();
        response.AdditionalData["requestId"] = "abc-123";
        response.AdditionalData["retryAfter"] = 30;

        Assert.AreEqual(2, response.AdditionalData.Count);
        Assert.AreEqual("abc-123", response.AdditionalData["requestId"]);
        Assert.AreEqual(30, response.AdditionalData["retryAfter"]);
    }

    [TestMethod]
    public void Details_IsNullable()
    {
        var response = new ApiErrorResponse { Details = "some detail" };
        Assert.AreEqual("some detail", response.Details);

        response.Details = null;
        Assert.IsNull(response.Details);
    }
}
