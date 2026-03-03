using BehavioralHealthSystem.Services;
using Microsoft.Extensions.Logging;
using Moq;

namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for GenericErrorHandlingService
/// </summary>
[TestClass]
public class GenericErrorHandlingServiceTests
{
    private Mock<ILogger<GenericErrorHandlingService>> _mockLogger = null!;
    private GenericErrorHandlingService _service = null!;

    [TestInitialize]
    public void Setup()
    {
        _mockLogger = new Mock<ILogger<GenericErrorHandlingService>>();
        _service = new GenericErrorHandlingService(_mockLogger.Object);
    }

    #region Constructor Tests

    [TestMethod]
    [ExpectedException(typeof(ArgumentNullException))]
    public void Constructor_NullLogger_ThrowsArgumentNullException()
    {
        new GenericErrorHandlingService(null!);
    }

    [TestMethod]
    public void Constructor_ValidLogger_CreatesInstance()
    {
        var service = new GenericErrorHandlingService(_mockLogger.Object);
        Assert.IsNotNull(service);
    }

    #endregion

    #region CreateErrorResponse Tests

    [TestMethod]
    public void CreateErrorResponse_ArgumentNullException_ReturnsMissingArgument()
    {
        var ex = new ArgumentNullException("testParam");

        var result = _service.CreateErrorResponse(ex, "TestOperation");

        Assert.IsNotNull(result);
        Assert.AreEqual("MISSING_ARGUMENT", result.Code);
        Assert.AreEqual("Required information is missing", result.Message);
    }

    [TestMethod]
    public void CreateErrorResponse_ArgumentException_ReturnsInvalidArgument()
    {
        var ex = new ArgumentException("bad arg");

        var result = _service.CreateErrorResponse(ex, "TestOp");

        Assert.AreEqual("INVALID_ARGUMENT", result.Code);
        Assert.AreEqual("Invalid request parameters provided", result.Message);
    }

    [TestMethod]
    public void CreateErrorResponse_UnauthorizedAccessException_ReturnsUnauthorized()
    {
        var ex = new UnauthorizedAccessException();

        var result = _service.CreateErrorResponse(ex, "TestOp");

        Assert.AreEqual("UNAUTHORIZED", result.Code);
        Assert.AreEqual("You are not authorized to perform this operation", result.Message);
    }

    [TestMethod]
    public void CreateErrorResponse_FileNotFoundException_ReturnsFileNotFound()
    {
        var ex = new FileNotFoundException("file missing");

        var result = _service.CreateErrorResponse(ex, "TestOp");

        Assert.AreEqual("FILE_NOT_FOUND", result.Code);
    }

    [TestMethod]
    public void CreateErrorResponse_TimeoutException_ReturnsTimeout()
    {
        var ex = new TimeoutException();

        var result = _service.CreateErrorResponse(ex, "TestOp");

        Assert.AreEqual("TIMEOUT", result.Code);
        Assert.AreEqual("The operation timed out. Please try again", result.Message);
    }

    [TestMethod]
    public void CreateErrorResponse_HttpRequestException_ReturnsHttpError()
    {
        var ex = new HttpRequestException("network error");

        var result = _service.CreateErrorResponse(ex, "TestOp");

        Assert.AreEqual("HTTP_ERROR", result.Code);
        Assert.AreEqual("External service error. Please try again later", result.Message);
    }

    [TestMethod]
    public void CreateErrorResponse_GenericException_ReturnsInternalError()
    {
        var ex = new Exception("something went wrong");

        var result = _service.CreateErrorResponse(ex, "TestOp");

        Assert.AreEqual("INTERNAL_ERROR", result.Code);
        Assert.AreEqual("An unexpected error occurred. Please try again later", result.Message);
    }

    [TestMethod]
    public void CreateErrorResponse_WithContext_IncludesContext()
    {
        var ex = new InvalidOperationException("invalid");
        var context = new Dictionary<string, object> { ["SessionId"] = "123" };

        var result = _service.CreateErrorResponse(ex, "TestOp", context);

        Assert.IsNotNull(result);
        Assert.AreEqual("INVALID_OPERATION", result.Code);
    }

    [TestMethod]
    public void CreateErrorResponse_WithCorrelationId_IncludesInContext()
    {
        var ex = new Exception("err");
        var correlationId = "corr-123";

        var result = _service.CreateErrorResponse(ex, "TestOp", correlationId: correlationId);

        Assert.IsNotNull(result);
        Assert.IsNotNull(result.Context);
        Assert.IsTrue(result.Context.ContainsKey("CorrelationId"));
        Assert.AreEqual(correlationId, result.Context["CorrelationId"]);
    }

    #endregion

    #region CreateValidationErrorResponse Tests

    [TestMethod]
    public void CreateValidationErrorResponse_ReturnsValidationError()
    {
        var result = _service.CreateValidationErrorResponse("Field is invalid");

        Assert.AreEqual("VALIDATION_ERROR", result.Code);
        Assert.AreEqual("Field is invalid", result.Message);
    }

    [TestMethod]
    public void CreateValidationErrorResponse_WithErrors_IncludesInContext()
    {
        var errors = new Dictionary<string, object> { ["Name"] = "Required" };

        var result = _service.CreateValidationErrorResponse("Validation failed", errors);

        Assert.AreEqual("VALIDATION_ERROR", result.Code);
        Assert.IsNotNull(result.Context);
    }

    #endregion

    #region CreateNotFoundResponse Tests

    [TestMethod]
    public void CreateNotFoundResponse_ReturnsNotFoundError()
    {
        var result = _service.CreateNotFoundResponse("Session", "sess-123");

        Assert.AreEqual("RESOURCE_NOT_FOUND", result.Code);
        StringAssert.Contains(result.Message, "Session");
        StringAssert.Contains(result.Message, "sess-123");
    }

    [TestMethod]
    public void CreateNotFoundResponse_WithCorrelationId_IncludesInContext()
    {
        var result = _service.CreateNotFoundResponse("User", "u-456", "corr-789");

        Assert.IsNotNull(result.Context);
        Assert.IsTrue(result.Context.ContainsKey("CorrelationId"));
        Assert.IsTrue(result.Context.ContainsKey("ResourceType"));
        Assert.IsTrue(result.Context.ContainsKey("ResourceId"));
    }

    #endregion

    #region CreateSuccessResponse Tests

    [TestMethod]
    public void CreateSuccessResponse_WithData_ReturnsSuccess()
    {
        var data = new { Name = "Test", Value = 42 };

        var result = _service.CreateSuccessResponse(data);

        Assert.IsNotNull(result);
        Assert.IsTrue(result.Success);
        Assert.AreEqual(data, result.Data);
    }

    [TestMethod]
    public void CreateSuccessResponse_WithMessage_IncludesMessage()
    {
        var result = _service.CreateSuccessResponse<int>(42, "Custom message");

        Assert.IsTrue(result.Success);
        Assert.AreEqual("Custom message", result.Message);
        Assert.AreEqual(42, result.Data);
    }

    [TestMethod]
    public void CreateSuccessResponse_WithMetadata_IncludesMetadata()
    {
        var metadata = new Dictionary<string, object> { ["Page"] = 1 };
        var result = _service.CreateSuccessResponse<string>("data", metadata: metadata);

        Assert.IsTrue(result.Success);
    }

    [TestMethod]
    public void CreateSuccessResponse_WithoutData_ReturnsSuccess()
    {
        var result = _service.CreateSuccessResponse(message: "Done");

        Assert.IsNotNull(result);
        Assert.IsTrue(result.Success);
    }

    #endregion

    #region SerializeResponse Tests

    [TestMethod]
    public void SerializeResponse_ReturnsValidJson()
    {
        var response = _service.CreateSuccessResponse(message: "hello");

        var json = _service.SerializeResponse(response);

        Assert.IsNotNull(json);
        StringAssert.Contains(json, "success");
        StringAssert.Contains(json, "true");
    }

    [TestMethod]
    public void SerializeResponse_ErrorResponse_ReturnsValidJson()
    {
        var response = _service.CreateValidationErrorResponse("bad input");

        var json = _service.SerializeResponse(response);

        Assert.IsNotNull(json);
        StringAssert.Contains(json, "bad input");
        StringAssert.Contains(json, "VALIDATION_ERROR");
    }

    #endregion
}
