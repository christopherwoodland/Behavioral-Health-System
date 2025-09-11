namespace BehavioralHealthSystem.Validators;

public class UserMetadataValidator : AbstractValidator<UserMetadata>
{
    private const int MinAge = 1;
    private const int MaxAge = 149;
    private const int MaxWeight = 999;

    public UserMetadataValidator()
    {
        RuleFor(x => x.Age)
            .GreaterThan(0)
            .WithMessage($"Age must be greater than {0}")
            .LessThan(MaxAge + 1)
            .WithMessage($"Age must be less than {MaxAge + 1}");

        RuleFor(x => x.Gender)
            .NotEmpty()
            .WithMessage("Gender is required")
            .Must(BeValidGender)
            .WithMessage("Gender must be 'male', 'female', or 'other'");

        RuleFor(x => x.Ethnicity)
            .NotEmpty()
            .WithMessage("Ethnicity is required");

        RuleFor(x => x.Race)
            .NotEmpty()
            .WithMessage("Race is required");

        RuleFor(x => x.Zipcode)
            .NotEmpty()
            .WithMessage("Zipcode is required")
            .Matches(@"^\d{5}(-\d{4})?$")
            .WithMessage("Zipcode must be in format 12345 or 12345-6789");

        RuleFor(x => x.Weight)
            .GreaterThan(0)
            .WithMessage("Weight must be greater than 0")
            .LessThan(MaxWeight + 1)
            .WithMessage($"Weight must be less than {MaxWeight + 1}");
    }

    private static bool BeValidGender(string gender)
    {
        var validGenders = new[] { "male", "female", "other" };
        return validGenders.Contains(gender?.ToLowerInvariant());
    }
}
