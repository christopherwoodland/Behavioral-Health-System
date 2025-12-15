namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for <see cref="UserMetadataValidator"/>.
/// Tests validation rules for user demographic information.
/// </summary>
[TestClass]
public class UserMetadataValidatorTests
{
    private UserMetadataValidator _validator = null!;

    /// <summary>
    /// Initializes the validator before each test.
    /// </summary>
    [TestInitialize]
    public void Setup()
    {
        _validator = new UserMetadataValidator();
    }

    #region Valid Metadata Tests

    /// <summary>
    /// Tests that empty metadata (all default values) passes validation.
    /// All fields are optional.
    /// </summary>
    [TestMethod]
    public void Validate_EmptyMetadata_ShouldPass()
    {
        // Arrange
        var metadata = new UserMetadata();

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, "Empty metadata should pass validation (all fields optional)");
    }

    /// <summary>
    /// Tests that valid complete metadata passes validation.
    /// </summary>
    [TestMethod]
    public void Validate_ValidCompleteMetadata_ShouldPass()
    {
        // Arrange
        var metadata = new UserMetadata
        {
            Age = 30,
            Gender = "male",
            Ethnicity = "Not Hispanic, Latino, or Spanish Origin",
            Race = "white",
            Zipcode = "12345",
            Weight = 150
        };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, "Valid complete metadata should pass validation");
        Assert.AreEqual(0, result.Errors.Count, "No validation errors expected");
    }

    #endregion

    #region Age Validation Tests

    /// <summary>
    /// Tests that valid ages within range pass validation.
    /// </summary>
    [TestMethod]
    [DataRow(1, DisplayName = "Minimum valid age")]
    [DataRow(18, DisplayName = "Adult age")]
    [DataRow(65, DisplayName = "Senior age")]
    [DataRow(149, DisplayName = "Maximum valid age")]
    public void Validate_ValidAge_ShouldPass(int age)
    {
        // Arrange
        var metadata = new UserMetadata { Age = age };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, $"Age {age} should pass validation");
    }

    /// <summary>
    /// Tests that age of 0 passes validation (treated as not provided).
    /// </summary>
    [TestMethod]
    public void Validate_AgeZero_ShouldPass()
    {
        // Arrange
        var metadata = new UserMetadata { Age = 0 };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, "Age 0 should pass validation (treated as not provided)");
    }

    /// <summary>
    /// Tests that negative ages pass validation (treated as not provided).
    /// The validator only validates Age when > 0, so negative values are ignored.
    /// </summary>
    [TestMethod]
    public void Validate_NegativeAge_ShouldPass()
    {
        // Arrange
        var metadata = new UserMetadata { Age = -5 };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, "Negative age should pass validation (treated as not provided)");
    }

    /// <summary>
    /// Tests that ages exceeding maximum fail validation.
    /// </summary>
    [TestMethod]
    public void Validate_AgeTooHigh_ShouldFail()
    {
        // Arrange
        var metadata = new UserMetadata { Age = 150 };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsFalse(result.IsValid, "Age 150 should fail validation (exceeds max)");
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(UserMetadata.Age)));
    }

    #endregion

    #region Gender Validation Tests

    /// <summary>
    /// Tests that all valid gender values pass validation.
    /// Case-insensitive comparison.
    /// </summary>
    [TestMethod]
    [DataRow("male")]
    [DataRow("MALE")]
    [DataRow("Male")]
    [DataRow("female")]
    [DataRow("Female")]
    [DataRow("non-binary")]
    [DataRow("Non-Binary")]
    [DataRow("transgender female")]
    [DataRow("Transgender Female")]
    [DataRow("transgender male")]
    [DataRow("other")]
    [DataRow("prefer not to say")]
    public void Validate_ValidGender_ShouldPass(string gender)
    {
        // Arrange
        var metadata = new UserMetadata { Gender = gender };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, $"Gender '{gender}' should pass validation");
    }

    /// <summary>
    /// Tests that null/empty gender passes validation (optional field).
    /// </summary>
    [TestMethod]
    [DataRow(null)]
    [DataRow("")]
    [DataRow("   ")]
    public void Validate_EmptyGender_ShouldPass(string? gender)
    {
        // Arrange
        var metadata = new UserMetadata { Gender = gender };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, "Empty gender should pass validation (optional field)");
    }

    /// <summary>
    /// Tests that invalid gender values fail validation.
    /// </summary>
    [TestMethod]
    [DataRow("unknown")]
    [DataRow("invalid")]
    [DataRow("123")]
    public void Validate_InvalidGender_ShouldFail(string gender)
    {
        // Arrange
        var metadata = new UserMetadata { Gender = gender };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsFalse(result.IsValid, $"Gender '{gender}' should fail validation");
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(UserMetadata.Gender)));
    }

    #endregion

    #region Ethnicity Validation Tests

    /// <summary>
    /// Tests that valid ethnicity values pass validation.
    /// Case-insensitive comparison.
    /// </summary>
    [TestMethod]
    [DataRow("Hispanic, Latino, or Spanish Origin")]
    [DataRow("hispanic, latino, or spanish origin")]
    [DataRow("Not Hispanic, Latino, or Spanish Origin")]
    [DataRow("NOT HISPANIC, LATINO, OR SPANISH ORIGIN")]
    public void Validate_ValidEthnicity_ShouldPass(string ethnicity)
    {
        // Arrange
        var metadata = new UserMetadata { Ethnicity = ethnicity };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, $"Ethnicity '{ethnicity}' should pass validation");
    }

    /// <summary>
    /// Tests that null/empty ethnicity passes validation (optional field).
    /// </summary>
    [TestMethod]
    public void Validate_EmptyEthnicity_ShouldPass()
    {
        // Arrange
        var metadata = new UserMetadata { Ethnicity = null };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, "Empty ethnicity should pass validation (optional field)");
    }

    /// <summary>
    /// Tests that invalid ethnicity values fail validation.
    /// </summary>
    [TestMethod]
    [DataRow("Hispanic")]
    [DataRow("Latino")]
    [DataRow("Unknown")]
    public void Validate_InvalidEthnicity_ShouldFail(string ethnicity)
    {
        // Arrange
        var metadata = new UserMetadata { Ethnicity = ethnicity };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsFalse(result.IsValid, $"Ethnicity '{ethnicity}' should fail validation");
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(UserMetadata.Ethnicity)));
    }

    #endregion

    #region Race Validation Tests

    /// <summary>
    /// Tests that all valid race values pass validation.
    /// Case-insensitive comparison.
    /// </summary>
    [TestMethod]
    [DataRow("white")]
    [DataRow("White")]
    [DataRow("black or african-american")]
    [DataRow("Black or African-American")]
    [DataRow("asian")]
    [DataRow("american indian or alaskan native")]
    [DataRow("native hawaiian or pacific islander")]
    [DataRow("two or more races")]
    [DataRow("other")]
    [DataRow("prefer not to say")]
    public void Validate_ValidRace_ShouldPass(string race)
    {
        // Arrange
        var metadata = new UserMetadata { Race = race };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, $"Race '{race}' should pass validation");
    }

    /// <summary>
    /// Tests that null/empty race passes validation (optional field).
    /// </summary>
    [TestMethod]
    public void Validate_EmptyRace_ShouldPass()
    {
        // Arrange
        var metadata = new UserMetadata { Race = null };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, "Empty race should pass validation (optional field)");
    }

    /// <summary>
    /// Tests that invalid race values fail validation.
    /// </summary>
    [TestMethod]
    [DataRow("purple")]
    [DataRow("unknown")]
    public void Validate_InvalidRace_ShouldFail(string race)
    {
        // Arrange
        var metadata = new UserMetadata { Race = race };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsFalse(result.IsValid, $"Race '{race}' should fail validation");
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(UserMetadata.Race)));
    }

    #endregion

    #region Zipcode Validation Tests

    /// <summary>
    /// Tests that valid zipcode formats pass validation.
    /// Zipcodes must be alphanumeric only (no hyphens or special characters).
    /// </summary>
    [TestMethod]
    [DataRow("12345")]
    [DataRow("ABCDE")]
    [DataRow("A1B2C3")]
    [DataRow("1234567890")]
    public void Validate_ValidZipcode_ShouldPass(string zipcode)
    {
        // Arrange
        var metadata = new UserMetadata { Zipcode = zipcode };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, $"Zipcode '{zipcode}' should pass validation");
    }

    /// <summary>
    /// Tests that null/empty zipcode passes validation (optional field).
    /// </summary>
    [TestMethod]
    public void Validate_EmptyZipcode_ShouldPass()
    {
        // Arrange
        var metadata = new UserMetadata { Zipcode = null };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, "Empty zipcode should pass validation (optional field)");
    }

    /// <summary>
    /// Tests that invalid zipcode formats fail validation.
    /// </summary>
    [TestMethod]
    [DataRow("12345-6789")] // Contains hyphen
    [DataRow("12345-")] // Contains hyphen
    [DataRow("12 345")] // Contains space
    [DataRow("12345678901")] // Too long (>10 chars)
    [DataRow("ABC-123")] // Contains special character
    public void Validate_InvalidZipcode_ShouldFail(string zipcode)
    {
        // Arrange
        var metadata = new UserMetadata { Zipcode = zipcode };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsFalse(result.IsValid, $"Zipcode '{zipcode}' should fail validation");
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(UserMetadata.Zipcode)));
    }

    #endregion

    #region Weight Validation Tests

    /// <summary>
    /// Tests that valid weights within range pass validation.
    /// </summary>
    [TestMethod]
    [DataRow(10, DisplayName = "Minimum weight")]
    [DataRow(150, DisplayName = "Average weight")]
    [DataRow(1000, DisplayName = "Maximum weight")]
    public void Validate_ValidWeight_ShouldPass(int weight)
    {
        // Arrange
        var metadata = new UserMetadata { Weight = weight };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, $"Weight {weight} should pass validation");
    }

    /// <summary>
    /// Tests that weight of 0 passes validation (treated as not provided).
    /// </summary>
    [TestMethod]
    public void Validate_WeightZero_ShouldPass()
    {
        // Arrange
        var metadata = new UserMetadata { Weight = 0 };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, "Weight 0 should pass validation (treated as not provided)");
    }

    /// <summary>
    /// Tests that weight below minimum fails validation.
    /// </summary>
    [TestMethod]
    public void Validate_WeightTooLow_ShouldFail()
    {
        // Arrange
        var metadata = new UserMetadata { Weight = 9 };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsFalse(result.IsValid, "Weight below minimum should fail validation");
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(UserMetadata.Weight)));
    }

    /// <summary>
    /// Tests that weight exceeding maximum fails validation.
    /// </summary>
    [TestMethod]
    public void Validate_WeightTooHigh_ShouldFail()
    {
        // Arrange
        var metadata = new UserMetadata { Weight = 1001 };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsFalse(result.IsValid, "Weight exceeding maximum should fail validation");
        Assert.IsTrue(result.Errors.Any(e => e.PropertyName == nameof(UserMetadata.Weight)));
    }

    #endregion

    #region Combined Validation Tests

    /// <summary>
    /// Tests that multiple validation errors are reported simultaneously.
    /// </summary>
    [TestMethod]
    public void Validate_MultipleErrors_ShouldReportAll()
    {
        // Arrange
        var metadata = new UserMetadata
        {
            Age = 200,              // Invalid: too high (1 error)
            Gender = "invalid",     // Invalid: not in list (1 error)
            Weight = 5,             // Invalid: too low (1 error) - Note: negative would be ignored
            Zipcode = "###invalid"  // Invalid: special characters (1 error)
        };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsFalse(result.IsValid, "Metadata with multiple errors should fail validation");
        Assert.IsTrue(result.Errors.Count >= 4,
            $"Should have at least 4 validation errors, but found {result.Errors.Count}");
    }    /// <summary>
    /// Tests that partial metadata with valid fields passes validation.
    /// </summary>
    [TestMethod]
    public void Validate_PartialValidMetadata_ShouldPass()
    {
        // Arrange - Only some fields provided
        var metadata = new UserMetadata
        {
            Age = 25,
            Gender = "female"
            // Other fields left as default (should be treated as not provided)
        };

        // Act
        var result = _validator.Validate(metadata);

        // Assert
        Assert.IsTrue(result.IsValid, "Partial valid metadata should pass validation");
    }

    #endregion
}
