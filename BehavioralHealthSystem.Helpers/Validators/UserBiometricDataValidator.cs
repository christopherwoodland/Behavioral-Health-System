using FluentValidation;

namespace BehavioralHealthSystem.Helpers.Validators;

/// <summary>
/// Validator for <see cref="UserBiometricData"/> ensuring data integrity and business rules.
/// </summary>
public class UserBiometricDataValidator : AbstractValidator<UserBiometricData>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="UserBiometricDataValidator"/> class.
    /// </summary>
    public UserBiometricDataValidator()
    {
        // User ID is required
        RuleFor(x => x.UserId)
            .NotEmpty()
            .WithMessage("User ID is required")
            .MaximumLength(100)
            .WithMessage("User ID cannot exceed 100 characters");

        // Nickname is required and is the only mandatory field
        RuleFor(x => x.Nickname)
            .NotEmpty()
            .WithMessage("Nickname is required")
            .MinimumLength(1)
            .WithMessage("Nickname must be at least 1 character")
            .MaximumLength(50)
            .WithMessage("Nickname cannot exceed 50 characters");

        // Weight validation (optional, but must be reasonable if provided)
        RuleFor(x => x.WeightKg)
            .GreaterThan(0)
            .WithMessage("Weight must be greater than 0 kg")
            .LessThanOrEqualTo(500)
            .WithMessage("Weight must be less than or equal to 500 kg")
            .When(x => x.WeightKg.HasValue);

        // Height validation (optional, but must be reasonable if provided)
        RuleFor(x => x.HeightCm)
            .GreaterThan(0)
            .WithMessage("Height must be greater than 0 cm")
            .LessThanOrEqualTo(300)
            .WithMessage("Height must be less than or equal to 300 cm")
            .When(x => x.HeightCm.HasValue);

        // Age validation (optional, but must be reasonable if provided)
        RuleFor(x => x.Age)
            .GreaterThan(0)
            .WithMessage("Age must be greater than 0")
            .LessThanOrEqualTo(150)
            .WithMessage("Age must be less than or equal to 150")
            .When(x => x.Age.HasValue);

        // Gender validation (optional, max length if provided)
        RuleFor(x => x.Gender)
            .MaximumLength(50)
            .WithMessage("Gender cannot exceed 50 characters")
            .When(x => !string.IsNullOrWhiteSpace(x.Gender));

        // Pronoun validation (optional, max length if provided)
        RuleFor(x => x.Pronoun)
            .MaximumLength(50)
            .WithMessage("Pronoun cannot exceed 50 characters")
            .When(x => !string.IsNullOrWhiteSpace(x.Pronoun));

        // Last residence validation (optional, max length if provided)
        RuleFor(x => x.LastResidence)
            .MaximumLength(200)
            .WithMessage("Last residence cannot exceed 200 characters")
            .When(x => !string.IsNullOrWhiteSpace(x.LastResidence));

        // Hobbies validation (optional, validate individual items)
        RuleForEach(x => x.Hobbies)
            .NotEmpty()
            .WithMessage("Hobby entry cannot be empty")
            .MaximumLength(100)
            .WithMessage("Each hobby cannot exceed 100 characters")
            .When(x => x.Hobbies != null && x.Hobbies.Any());

        // Likes validation (optional, validate individual items)
        RuleForEach(x => x.Likes)
            .NotEmpty()
            .WithMessage("Like entry cannot be empty")
            .MaximumLength(100)
            .WithMessage("Each like cannot exceed 100 characters")
            .When(x => x.Likes != null && x.Likes.Any());

        // Dislikes validation (optional, validate individual items)
        RuleForEach(x => x.Dislikes)
            .NotEmpty()
            .WithMessage("Dislike entry cannot be empty")
            .MaximumLength(100)
            .WithMessage("Each dislike cannot exceed 100 characters")
            .When(x => x.Dislikes != null && x.Dislikes.Any());

        // Additional info validation (optional, max length if provided)
        RuleFor(x => x.AdditionalInfo)
            .MaximumLength(1000)
            .WithMessage("Additional info cannot exceed 1000 characters")
            .When(x => !string.IsNullOrWhiteSpace(x.AdditionalInfo));

        // Timestamp must be valid
        RuleFor(x => x.Timestamp)
            .NotEmpty()
            .WithMessage("Timestamp is required")
            .LessThanOrEqualTo(DateTime.UtcNow.AddMinutes(5))
            .WithMessage("Timestamp cannot be in the future");

        // Source is required
        RuleFor(x => x.Source)
            .NotEmpty()
            .WithMessage("Source is required")
            .MaximumLength(50)
            .WithMessage("Source cannot exceed 50 characters");

        // LastUpdated must be after or equal to Timestamp if provided
        RuleFor(x => x.LastUpdated)
            .GreaterThanOrEqualTo(x => x.Timestamp)
            .WithMessage("Last updated timestamp must be after or equal to creation timestamp")
            .When(x => x.LastUpdated.HasValue);
    }
}
