using BehavioralHealthSystem.Helpers.Models;
using BehavioralHealthSystem.Helpers.Validators;

namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for UserBiometricDataValidator
/// </summary>
[TestClass]
public class UserBiometricDataValidatorTests
{
    private UserBiometricDataValidator _validator = null!;

    [TestInitialize]
    public void Setup()
    {
        _validator = new UserBiometricDataValidator();
    }

    #region Valid Data Tests

    [TestMethod]
    public void Validate_ValidCompleteData_PassesValidation()
    {
        var data = CreateValidBiometricData();

        var result = _validator.TestValidate(data);

        result.ShouldNotHaveAnyValidationErrors();
    }

    [TestMethod]
    public void Validate_ValidMinimalData_PassesValidation()
    {
        var data = new UserBiometricData
        {
            UserId = "user-123",
            Nickname = "Test",
            Timestamp = DateTime.UtcNow,
            Source = "Matron"
        };

        var result = _validator.TestValidate(data);

        result.ShouldNotHaveAnyValidationErrors();
    }

    #endregion

    #region UserId Validation

    [TestMethod]
    public void Validate_EmptyUserId_HasError()
    {
        var data = CreateValidBiometricData();
        data.UserId = string.Empty;

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.UserId)
            .WithErrorMessage("User ID is required");
    }

    [TestMethod]
    public void Validate_UserIdTooLong_HasError()
    {
        var data = CreateValidBiometricData();
        data.UserId = new string('x', 101);

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.UserId)
            .WithErrorMessage("User ID cannot exceed 100 characters");
    }

    [TestMethod]
    public void Validate_UserIdAtMaxLength_PassesValidation()
    {
        var data = CreateValidBiometricData();
        data.UserId = new string('x', 100);

        var result = _validator.TestValidate(data);

        result.ShouldNotHaveValidationErrorFor(x => x.UserId);
    }

    #endregion

    #region Nickname Validation

    [TestMethod]
    public void Validate_EmptyNickname_HasError()
    {
        var data = CreateValidBiometricData();
        data.Nickname = string.Empty;

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.Nickname)
            .WithErrorMessage("Nickname is required");
    }

    [TestMethod]
    public void Validate_NicknameTooLong_HasError()
    {
        var data = CreateValidBiometricData();
        data.Nickname = new string('x', 51);

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.Nickname)
            .WithErrorMessage("Nickname cannot exceed 50 characters");
    }

    [TestMethod]
    public void Validate_SingleCharNickname_PassesValidation()
    {
        var data = CreateValidBiometricData();
        data.Nickname = "A";

        var result = _validator.TestValidate(data);

        result.ShouldNotHaveValidationErrorFor(x => x.Nickname);
    }

    #endregion

    #region Weight Validation

    [TestMethod]
    public void Validate_NullWeight_PassesValidation()
    {
        var data = CreateValidBiometricData();
        data.WeightKg = null;

        var result = _validator.TestValidate(data);

        result.ShouldNotHaveValidationErrorFor(x => x.WeightKg);
    }

    [TestMethod]
    public void Validate_ZeroWeight_HasError()
    {
        var data = CreateValidBiometricData();
        data.WeightKg = 0;

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.WeightKg);
    }

    [TestMethod]
    public void Validate_NegativeWeight_HasError()
    {
        var data = CreateValidBiometricData();
        data.WeightKg = -10;

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.WeightKg);
    }

    [TestMethod]
    public void Validate_WeightOverMax_HasError()
    {
        var data = CreateValidBiometricData();
        data.WeightKg = 501;

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.WeightKg)
            .WithErrorMessage("Weight must be less than or equal to 500 kg");
    }

    [TestMethod]
    public void Validate_ValidWeight_PassesValidation()
    {
        var data = CreateValidBiometricData();
        data.WeightKg = 75.5;

        var result = _validator.TestValidate(data);

        result.ShouldNotHaveValidationErrorFor(x => x.WeightKg);
    }

    #endregion

    #region Height Validation

    [TestMethod]
    public void Validate_NullHeight_PassesValidation()
    {
        var data = CreateValidBiometricData();
        data.HeightCm = null;

        var result = _validator.TestValidate(data);

        result.ShouldNotHaveValidationErrorFor(x => x.HeightCm);
    }

    [TestMethod]
    public void Validate_ZeroHeight_HasError()
    {
        var data = CreateValidBiometricData();
        data.HeightCm = 0;

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.HeightCm);
    }

    [TestMethod]
    public void Validate_HeightOverMax_HasError()
    {
        var data = CreateValidBiometricData();
        data.HeightCm = 301;

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.HeightCm)
            .WithErrorMessage("Height must be less than or equal to 300 cm");
    }

    #endregion

    #region Age Validation

    [TestMethod]
    public void Validate_NullAge_PassesValidation()
    {
        var data = CreateValidBiometricData();
        data.Age = null;

        var result = _validator.TestValidate(data);

        result.ShouldNotHaveValidationErrorFor(x => x.Age);
    }

    [TestMethod]
    public void Validate_ZeroAge_HasError()
    {
        var data = CreateValidBiometricData();
        data.Age = 0;

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.Age);
    }

    [TestMethod]
    public void Validate_AgeOverMax_HasError()
    {
        var data = CreateValidBiometricData();
        data.Age = 151;

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.Age)
            .WithErrorMessage("Age must be less than or equal to 150");
    }

    #endregion

    #region String Length Validation

    [TestMethod]
    public void Validate_GenderTooLong_HasError()
    {
        var data = CreateValidBiometricData();
        data.Gender = new string('x', 51);

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.Gender)
            .WithErrorMessage("Gender cannot exceed 50 characters");
    }

    [TestMethod]
    public void Validate_PronounTooLong_HasError()
    {
        var data = CreateValidBiometricData();
        data.Pronoun = new string('x', 51);

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.Pronoun)
            .WithErrorMessage("Pronoun cannot exceed 50 characters");
    }

    [TestMethod]
    public void Validate_LastResidenceTooLong_HasError()
    {
        var data = CreateValidBiometricData();
        data.LastResidence = new string('x', 201);

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.LastResidence)
            .WithErrorMessage("Last residence cannot exceed 200 characters");
    }

    [TestMethod]
    public void Validate_AdditionalInfoTooLong_HasError()
    {
        var data = CreateValidBiometricData();
        data.AdditionalInfo = new string('x', 1001);

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.AdditionalInfo)
            .WithErrorMessage("Additional info cannot exceed 1000 characters");
    }

    #endregion

    #region Collection Validation

    [TestMethod]
    public void Validate_EmptyHobbyEntry_HasError()
    {
        var data = CreateValidBiometricData();
        data.Hobbies = new List<string> { "Reading", "" };

        var result = _validator.TestValidate(data);

        result.ShouldHaveAnyValidationError();
    }

    [TestMethod]
    public void Validate_HobbyTooLong_HasError()
    {
        var data = CreateValidBiometricData();
        data.Hobbies = new List<string> { new string('x', 101) };

        var result = _validator.TestValidate(data);

        result.ShouldHaveAnyValidationError();
    }

    [TestMethod]
    public void Validate_ValidHobbies_PassesValidation()
    {
        var data = CreateValidBiometricData();
        data.Hobbies = new List<string> { "Reading", "Swimming", "Coding" };

        var result = _validator.TestValidate(data);

        result.ShouldNotHaveAnyValidationErrors();
    }

    #endregion

    #region Source Validation

    [TestMethod]
    public void Validate_EmptySource_HasError()
    {
        var data = CreateValidBiometricData();
        data.Source = string.Empty;

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.Source)
            .WithErrorMessage("Source is required");
    }

    [TestMethod]
    public void Validate_SourceTooLong_HasError()
    {
        var data = CreateValidBiometricData();
        data.Source = new string('x', 51);

        var result = _validator.TestValidate(data);

        result.ShouldHaveValidationErrorFor(x => x.Source)
            .WithErrorMessage("Source cannot exceed 50 characters");
    }

    #endregion

    #region Multiple Errors Tests

    [TestMethod]
    public void Validate_MultipleInvalidFields_HasMultipleErrors()
    {
        var data = new UserBiometricData
        {
            UserId = "",
            Nickname = "",
            WeightKg = -5,
            HeightCm = 0,
            Source = "",
            Timestamp = DateTime.UtcNow
        };

        var result = _validator.TestValidate(data);

        Assert.IsTrue(result.Errors.Count >= 4,
            $"Expected at least 4 errors but got {result.Errors.Count}");
    }

    #endregion

    #region Helper Methods

    private static UserBiometricData CreateValidBiometricData()
    {
        return new UserBiometricData
        {
            UserId = "user-test-123",
            Nickname = "TestUser",
            WeightKg = 70.0,
            HeightCm = 175.0,
            Age = 30,
            Gender = "male",
            Pronoun = "he/him",
            Source = "Matron",
            Timestamp = DateTime.UtcNow
        };
    }

    #endregion
}
