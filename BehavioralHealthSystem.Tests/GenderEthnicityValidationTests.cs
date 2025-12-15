namespace BehavioralHealthSystem.Tests
{
    [TestClass]
    public class GenderEthnicityValidationTests
    {
        private UserMetadataValidator _validator = null!;

        [TestInitialize]
        public void Setup()
        {
            _validator = new UserMetadataValidator();
        }

        [TestMethod]
        public void Gender_PreferNotToSay_ShouldBeValid()
        {
            // Arrange
            var userMetadata = new UserMetadata
            {
                Age = 25,
                Gender = "prefer not to say",
                Ethnicity = "Hispanic, Latino, or Spanish Origin",
                Race = "white",
                Zipcode = "12345",
                Weight = 150
            };

            // Act & Assert
            var result = _validator.TestValidate(userMetadata);
            result.ShouldNotHaveValidationErrorFor(x => x.Gender);
        }

        [TestMethod]
        public void Gender_OldPreferValue_ShouldBeInvalid()
        {
            // Arrange
            var userMetadata = new UserMetadata
            {
                Age = 25,
                Gender = "prefer",
                Ethnicity = "Hispanic, Latino, or Spanish Origin",
                Race = "white",
                Zipcode = "12345",
                Weight = 150
            };

            // Act & Assert
            var result = _validator.TestValidate(userMetadata);
            result.ShouldHaveValidationErrorFor(x => x.Gender)
                .WithErrorMessage("Invalid gender. Must be: male, female, non-binary, transgender female, transgender male, other, or prefer not to say");
        }

        [TestMethod]
        public void Ethnicity_PreferNotToSay_ShouldBeInvalid()
        {
            // Arrange - ethnicity does NOT support "prefer not to say"
            var userMetadata = new UserMetadata
            {
                Age = 25,
                Gender = "male",
                Ethnicity = "prefer not to say",
                Race = "white",
                Zipcode = "12345",
                Weight = 150
            };

            // Act & Assert
            var result = _validator.TestValidate(userMetadata);
            result.ShouldHaveValidationErrorFor(x => x.Ethnicity)
                .WithErrorMessage("Invalid ethnicity. Must be: Hispanic, Latino, or Spanish Origin | Not Hispanic, Latino, or Spanish Origin");
        }

        [TestMethod]
        public void Ethnicity_InvalidValue_ShouldBeInvalid()
        {
            // Arrange
            var userMetadata = new UserMetadata
            {
                Age = 25,
                Gender = "male",
                Ethnicity = "invalid ethnicity",
                Race = "white",
                Zipcode = "12345",
                Weight = 150
            };

            // Act & Assert
            var result = _validator.TestValidate(userMetadata);
            result.ShouldHaveValidationErrorFor(x => x.Ethnicity)
                .WithErrorMessage("Invalid ethnicity. Must be: Hispanic, Latino, or Spanish Origin | Not Hispanic, Latino, or Spanish Origin");
        }

        [TestMethod]
        public void GenderAndRace_PreferNotToSay_ShouldBeValid()
        {
            // Arrange - Only gender and race support "prefer not to say", not ethnicity
            var userMetadata = new UserMetadata
            {
                Age = 25,
                Gender = "prefer not to say",
                Ethnicity = "Hispanic, Latino, or Spanish Origin",
                Race = "prefer not to say",
                Zipcode = "12345",
                Weight = 150
            };

            // Act & Assert
            var result = _validator.TestValidate(userMetadata);
            result.ShouldNotHaveValidationErrorFor(x => x.Gender);
            result.ShouldNotHaveValidationErrorFor(x => x.Race);
            result.ShouldNotHaveValidationErrorFor(x => x.Ethnicity);
        }

        [TestMethod]
        public void EmptyGenderAndEthnicity_ShouldBeValid()
        {
            // Arrange - test that empty values don't trigger validation (conditional validation)
            var userMetadata = new UserMetadata
            {
                Age = 25,
                Gender = "",
                Ethnicity = "",
                Race = "",
                Zipcode = "12345",
                Weight = 150
            };

            // Act & Assert
            var result = _validator.TestValidate(userMetadata);
            result.ShouldNotHaveValidationErrorFor(x => x.Gender);
            result.ShouldNotHaveValidationErrorFor(x => x.Ethnicity);
            result.ShouldNotHaveValidationErrorFor(x => x.Race);  // Race also supports prefer not to say
        }
    }
}
