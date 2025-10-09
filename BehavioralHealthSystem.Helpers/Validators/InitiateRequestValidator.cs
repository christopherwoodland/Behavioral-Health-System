namespace BehavioralHealthSystem.Validators;

/// <summary>
/// FluentValidation validator for <see cref="InitiateRequest"/> objects.
/// Ensures session initiation requests have valid user IDs and proper metadata.
/// </summary>
public class InitiateRequestValidator : AbstractValidator<InitiateRequest>
{
    /// <summary>
    /// Maximum allowed length for user ID strings.
    /// </summary>
    private const int MaxUserIdLength = 100;

    /// <summary>
    /// Initializes a new instance of the <see cref="InitiateRequestValidator"/> class.
    /// Configures validation rules for UserId, IsInitiated flag, and optional Metadata.
    /// </summary>
    public InitiateRequestValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User ID is required")
            .MaximumLength(MaxUserIdLength)
            .WithMessage($"User ID must not exceed {MaxUserIdLength} characters");

        RuleFor(x => x.IsInitiated)
            .Equal(true)
            .WithMessage("Session must be initiated");

        RuleFor(x => x.Metadata)
            .SetValidator(new UserMetadataValidator()!)
            .When(x => x.Metadata != null);
    }
}
