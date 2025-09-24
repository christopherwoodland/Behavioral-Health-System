namespace BehavioralHealthSystem.Validators;

public class UserMetadataValidator : AbstractValidator<UserMetadata>
{
    private const int MinAge = 1;
    private const int MaxAge = 149;
    private const int MinWeight = 10;
    private const int MaxWeight = 1000;

    public UserMetadataValidator()
    {
        RuleFor(x => x.Age)
            .GreaterThan(0)
            .WithMessage($"Age must be greater than {0}")
            .LessThan(MaxAge + 1)
            .WithMessage($"Age must be less than {MaxAge + 1}");

        // Gender is optional, but when provided must be valid
        RuleFor(x => x.Gender)
            .Must(BeValidGender)
            .When(x => !string.IsNullOrEmpty(x.Gender))
            .WithMessage("Gender must be: female, male, non-binary, transgender female, transgender male, other, or prefer");

        // Ethnicity is optional, but when provided must be valid
        RuleFor(x => x.Ethnicity)
            .Must(BeValidEthnicity)
            .When(x => !string.IsNullOrEmpty(x.Ethnicity))
            .WithMessage("Ethnicity must be: Hispanic, Latino, or Spanish Origin or Not Hispanic, Latino, or Spanish Origin");

        // Race is optional, but when provided must be valid
        RuleFor(x => x.Race)
            .Must(BeValidRace)
            .When(x => !string.IsNullOrEmpty(x.Race))
            .WithMessage("Race must be: white, black or african-american, asian, american indian or alaskan native, native hawaiian or pacific islander, two or more races, other, or prefer not to say");

        // Zipcode is optional, but when provided must be 5 digits
        RuleFor(x => x.Zipcode)
            .Matches(@"^[0-9]{5}$")
            .When(x => !string.IsNullOrEmpty(x.Zipcode))
            .WithMessage("Zipcode must be exactly 5 digits");

        RuleFor(x => x.Weight)
            .GreaterThan(MinWeight - 1)
            .WithMessage($"Weight must be greater than {MinWeight - 1}")
            .LessThan(MaxWeight + 1)
            .WithMessage($"Weight must be less than {MaxWeight + 1}");
    }

    private static bool BeValidGender(string gender)
    {
        var validGenders = new[] { "female", "male", "non-binary", "transgender female", "transgender male", "other", "prefer" };
        return validGenders.Contains(gender);
    }

    private static bool BeValidRace(string race)
    {
        var validRaces = new[] { "white", "black or african-american", "asian", "american indian or alaskan native", "native Hawaiian or pacific islander", "two or more races", "other", "prefer not to say" };
        return validRaces.Contains(race);
    }

    private static bool BeValidEthnicity(string ethnicity)
    {
        var validEthnicities = new[] { "Hispanic, Latino, or Spanish Origin", "Not Hispanic, Latino, or Spanish Origin" };
        return validEthnicities.Contains(ethnicity);
    }
}
