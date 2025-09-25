namespace BehavioralHealthSystem.Validators;

public class UserMetadataValidator : AbstractValidator<UserMetadata>
{
    private const int MinAge = 1;
    private const int MaxAge = 149;
    private const int MinWeight = 10;
    private const int MaxWeight = 1000;

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

    private static bool BeValidGender(string gender)
    {
        var validGenders = new[] { "male", "female", "non-binary", "transgender female", "transgender male", "other", "prefer not to specify" };
        return validGenders.Contains(gender, StringComparer.OrdinalIgnoreCase);
    }

    private static bool BeValidRace(string race)
    {
        var validRaces = new[] { "white", "black or african-american", "asian", "american indian or alaskan native", "native hawaiian or pacific islander", "two or more races", "other", "prefer not to specify" };
        return validRaces.Contains(race, StringComparer.OrdinalIgnoreCase);
    }

    private static bool BeValidEthnicity(string ethnicity)
    {
        var validEthnicities = new[] { 
            "Hispanic, Latino, or Spanish Origin", 
            "Not Hispanic, Latino, or Spanish Origin"
        };
        return validEthnicities.Contains(ethnicity, StringComparer.OrdinalIgnoreCase);
    }
}
