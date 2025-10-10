namespace BehavioralHealthSystem.Validators;

/// <summary>
/// FluentValidation validator for <see cref="UserMetadata"/> objects.
/// Validates demographic information including age, gender, ethnicity, race, weight, and zipcode.
/// All fields are optional, but when provided must meet validation criteria.
/// </summary>
public class UserMetadataValidator : AbstractValidator<UserMetadata>
{
    /// <summary>
    /// Minimum valid age in years.
    /// </summary>
    private const int MinAge = 1;

    /// <summary>
    /// Maximum valid age in years (inclusive).
    /// </summary>
    private const int MaxAge = 149;

    /// <summary>
    /// Minimum valid weight in pounds.
    /// </summary>
    private const int MinWeight = 10;

    /// <summary>
    /// Maximum valid weight in pounds (inclusive).
    /// </summary>
    private const int MaxWeight = 1000;

    /// <summary>
    /// Initializes a new instance of the <see cref="UserMetadataValidator"/> class.
    /// Configures validation rules for all demographic fields with appropriate constraints.
    /// </summary>
    public UserMetadataValidator()
    {
        // Age is optional, but when provided (non-zero) must be valid
        RuleFor(x => x.Age)
            .GreaterThan(0)
            .WithMessage($"Age must be greater than {0}")
            .LessThan(MaxAge + 1)
            .WithMessage($"Age must be less than {MaxAge + 1}")
            .When(x => HasMeaningfulValue(x, nameof(UserMetadata.Age)));

        // Gender is optional, but when provided must be valid
        RuleFor(x => x.Gender)
            .Must(BeValidGender)
            .When(x => HasMeaningfulValue(x, nameof(UserMetadata.Gender)))
            .WithMessage("Invalid gender. Must be: male, female, non-binary, transgender female, transgender male, other, or prefer not to specify");

        // Ethnicity is optional, but when provided must be valid
        RuleFor(x => x.Ethnicity)
            .Must(BeValidEthnicity)
            .When(x => HasMeaningfulValue(x, nameof(UserMetadata.Ethnicity)))
            .WithMessage("Invalid ethnicity. Must be: Hispanic, Latino, or Spanish Origin | Not Hispanic, Latino, or Spanish Origin");

        // Race is optional, but when provided must be valid
        RuleFor(x => x.Race)
            .Must(BeValidRace)
            .When(x => HasMeaningfulValue(x, nameof(UserMetadata.Race)))
            .WithMessage("Invalid race. Must be: white, black or african-american, asian, american indian or alaskan native, native hawaiian or pacific islander, two or more races, other, prefer not to specify");

        // Zipcode is optional, but when provided must be alphanumeric up to 10 characters
        RuleFor(x => x.Zipcode)
            .Matches(@"^[a-zA-Z0-9]{1,10}$")
            .When(x => HasMeaningfulValue(x, nameof(UserMetadata.Zipcode)))
            .WithMessage("Zipcode must be alphanumeric and contain no more than 10 characters");

        // Weight is optional, but when provided (non-zero) must be valid
        RuleFor(x => x.Weight)
            .GreaterThan(MinWeight - 1)
            .WithMessage($"Weight must be greater than {MinWeight - 1}")
            .LessThan(MaxWeight + 1)
            .WithMessage($"Weight must be less than {MaxWeight + 1}")
            .When(x => HasMeaningfulValue(x, nameof(UserMetadata.Weight)));
    }

    /// <summary>
    /// Determines if a specific property has a meaningful (non-default) value that should be validated.
    /// Used to skip validation for optional fields that are not provided.
    /// </summary>
    /// <param name="metadata">The user metadata object to check.</param>
    /// <param name="propertyName">The name of the property to evaluate.</param>
    /// <returns>True if the property has a meaningful value; otherwise, false.</returns>
    private static bool HasMeaningfulValue(UserMetadata metadata, string propertyName)
    {
        return propertyName switch
        {
            nameof(UserMetadata.Age) => metadata.Age > 0,
            nameof(UserMetadata.Weight) => metadata.Weight > 0,
            nameof(UserMetadata.Gender) => !string.IsNullOrWhiteSpace(metadata.Gender),
            nameof(UserMetadata.Race) => !string.IsNullOrWhiteSpace(metadata.Race),
            nameof(UserMetadata.Ethnicity) => !string.IsNullOrWhiteSpace(metadata.Ethnicity),
            nameof(UserMetadata.Zipcode) => !string.IsNullOrWhiteSpace(metadata.Zipcode),
            _ => false
        };
    }

    /// <summary>
    /// Validates that the gender value matches one of the accepted gender identities.
    /// Case-insensitive comparison.
    /// </summary>
    /// <param name="gender">The gender string to validate.</param>
    /// <returns>True if the gender is valid; otherwise, false.</returns>
    private static bool BeValidGender(string gender)
    {
        var validGenders = new[] { "male", "female", "non-binary", "transgender female", "transgender male", "other", "prefer not to specify" };
        return validGenders.Contains(gender, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Validates that the race value matches one of the accepted racial categories.
    /// Case-insensitive comparison.
    /// </summary>
    /// <param name="race">The race string to validate.</param>
    /// <returns>True if the race is valid; otherwise, false.</returns>
    private static bool BeValidRace(string race)
    {
        var validRaces = new[] { "white", "black or african-american", "asian", "american indian or alaskan native", "native hawaiian or pacific islander", "two or more races", "other", "prefer not to specify" };
        return validRaces.Contains(race, StringComparer.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Validates that the ethnicity value matches one of the accepted ethnicity categories.
    /// Case-insensitive comparison.
    /// </summary>
    /// <param name="ethnicity">The ethnicity string to validate.</param>
    /// <returns>True if the ethnicity is valid; otherwise, false.</returns>
    private static bool BeValidEthnicity(string ethnicity)
    {
        var validEthnicities = new[] {
            "Hispanic, Latino, or Spanish Origin",
            "Not Hispanic, Latino, or Spanish Origin"
        };
        return validEthnicities.Contains(ethnicity, StringComparer.OrdinalIgnoreCase);
    }
}
