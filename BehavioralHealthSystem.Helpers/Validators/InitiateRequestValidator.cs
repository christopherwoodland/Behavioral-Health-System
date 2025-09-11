namespace BehavioralHealthSystem.Validators;

public class InitiateRequestValidator : AbstractValidator<InitiateRequest>
{
    private const int MaxUserIdLength = 100;

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
