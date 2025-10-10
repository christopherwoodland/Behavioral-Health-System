namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for <see cref="InitiateRequestValidator"/>.
/// Tests validation rules for session initiation requests.
/// </summary>
[TestClass]
public class InitiateRequestValidatorTests
{
    private InitiateRequestValidator _validator = null!;

    /// <summary>
    /// Initializes the validator before each test.
    /// </summary>
    [TestInitialize]
    public void Setup()
    {
        _validator = new InitiateRequestValidator();
    }

    #region Valid Request Tests

    /// <summary>
    /// Tests that a valid initiate request passes validation.
    /// </summary>
    [TestMethod]
    public void Validate_ValidRequest_ShouldPass()
    {
        // Arrange
        var request = new InitiateRequest
        {
            UserId = "user-123",
            IsInitiated = true
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        Assert.IsTrue(result.IsValid, "Valid request should pass validation");
        Assert.AreEqual(0, result.Errors.Count, "No validation errors expected");
    }

    /// <summary>
    /// Tests that a valid request with metadata passes validation.
    /// </summary>
    [TestMethod]
    public void Validate_ValidRequestWithMetadata_ShouldPass()
    {
        // Arrange
        var request = new InitiateRequest
        {
            UserId = "user-456",
            IsInitiated = true,
            Metadata = new UserMetadata
            {
                Age = 30,
                Gender = "male"
            }
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        Assert.IsTrue(result.IsValid, "Valid request with metadata should pass validation");
        Assert.AreEqual(0, result.Errors.Count, "No validation errors expected");
    }

    #endregion

    #region UserId Validation Tests

    /// <summary>
    /// Tests that an empty UserId fails validation.
    /// </summary>
    [TestMethod]
    public void Validate_EmptyUserId_ShouldFail()
    {
        // Arrange
        var request = new InitiateRequest
        {
            UserId = string.Empty,
            IsInitiated = true
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        Assert.IsFalse(result.IsValid, "Empty UserId should fail validation");
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(InitiateRequest.UserId)),
            "Should have UserId validation error");
        Assert.IsTrue(result.Errors.Any(e => e.ErrorMessage.Contains("User ID is required")),
            "Error message should indicate UserId is required");
    }

    /// <summary>
    /// Tests that a null UserId fails validation.
    /// </summary>
    [TestMethod]
    public void Validate_NullUserId_ShouldFail()
    {
        // Arrange
        var request = new InitiateRequest
        {
            UserId = null!,
            IsInitiated = true
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        Assert.IsFalse(result.IsValid, "Null UserId should fail validation");
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(InitiateRequest.UserId)),
            "Should have UserId validation error");
    }

    /// <summary>
    /// Tests that a UserId exceeding maximum length fails validation.
    /// </summary>
    [TestMethod]
    public void Validate_UserIdTooLong_ShouldFail()
    {
        // Arrange
        var request = new InitiateRequest
        {
            UserId = new string('a', 101), // 101 characters, exceeds 100 max
            IsInitiated = true
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        Assert.IsFalse(result.IsValid, "UserId exceeding max length should fail validation");
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(InitiateRequest.UserId)),
            "Should have UserId validation error");
        Assert.IsTrue(result.Errors.Any(e => e.ErrorMessage.Contains("must not exceed")),
            "Error message should indicate max length exceeded");
    }

    /// <summary>
    /// Tests that a UserId at maximum length passes validation.
    /// </summary>
    [TestMethod]
    public void Validate_UserIdAtMaxLength_ShouldPass()
    {
        // Arrange
        var request = new InitiateRequest
        {
            UserId = new string('a', 100), // Exactly 100 characters
            IsInitiated = true
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        Assert.IsTrue(result.IsValid, "UserId at max length should pass validation");
    }

    #endregion

    #region IsInitiated Validation Tests

    /// <summary>
    /// Tests that IsInitiated = false fails validation.
    /// </summary>
    [TestMethod]
    public void Validate_IsInitiatedFalse_ShouldFail()
    {
        // Arrange
        var request = new InitiateRequest
        {
            UserId = "user-789",
            IsInitiated = false
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        Assert.IsFalse(result.IsValid, "IsInitiated = false should fail validation");
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(InitiateRequest.IsInitiated)),
            "Should have IsInitiated validation error");
        Assert.IsTrue(result.Errors.Any(e => e.ErrorMessage.Contains("must be initiated")),
            "Error message should indicate session must be initiated");
    }

    #endregion

    #region Metadata Validation Tests

    /// <summary>
    /// Tests that null metadata passes validation (metadata is optional).
    /// </summary>
    [TestMethod]
    public void Validate_NullMetadata_ShouldPass()
    {
        // Arrange
        var request = new InitiateRequest
        {
            UserId = "user-101",
            IsInitiated = true,
            Metadata = null
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        Assert.IsTrue(result.IsValid, "Null metadata should pass validation (optional field)");
    }

    /// <summary>
    /// Tests that invalid metadata fails validation.
    /// </summary>
    [TestMethod]
    public void Validate_InvalidMetadata_ShouldFail()
    {
        // Arrange
        var request = new InitiateRequest
        {
            UserId = "user-202",
            IsInitiated = true,
            Metadata = new UserMetadata
            {
                Age = -5, // Invalid age
                Gender = "invalid-gender" // Invalid gender
            }
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        Assert.IsFalse(result.IsValid, "Invalid metadata should fail validation");
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName.Contains(nameof(UserMetadata.Age)) ||
                                              e.PropertyName.Contains(nameof(UserMetadata.Gender))),
            "Should have metadata validation errors");
    }

    #endregion

    #region Multiple Error Tests

    /// <summary>
    /// Tests that multiple validation errors are reported simultaneously.
    /// </summary>
    [TestMethod]
    public void Validate_MultipleErrors_ShouldReportAll()
    {
        // Arrange
        var request = new InitiateRequest
        {
            UserId = string.Empty, // Error 1: Empty UserId
            IsInitiated = false,   // Error 2: Not initiated
            Metadata = new UserMetadata
            {
                Age = 200 // Error 3: Invalid age
            }
        };

        // Act
        var result = _validator.Validate(request);

        // Assert
        Assert.IsFalse(result.IsValid, "Request with multiple errors should fail validation");
        Assert.IsTrue(result.Errors.Count >= 3,
            $"Should have at least 3 validation errors, but found {result.Errors.Count}");
    }

    #endregion
}
