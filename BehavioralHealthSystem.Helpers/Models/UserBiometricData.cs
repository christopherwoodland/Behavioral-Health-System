using System.ComponentModel.DataAnnotations;

namespace BehavioralHealthSystem.Helpers.Models;

/// <summary>
/// Represents user biometric and preference data collected by the Matron agent.
/// All measurements are stored in metric units (kg for weight, cm for height).
/// </summary>
public class UserBiometricData
{
    /// <summary>
    /// Gets or sets the unique identifier for the user.
    /// </summary>
    /// <value>The user's unique identifier.</value>
    [Required]
    public string UserId { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the nickname or preferred name the user wants to be called.
    /// This is the only required field during data collection.
    /// </summary>
    /// <value>The user's preferred nickname.</value>
    [Required(ErrorMessage = "Nickname is required")]
    public string Nickname { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the user's weight in kilograms.
    /// This value is stored in metric units regardless of input format.
    /// </summary>
    /// <value>Weight in kilograms, or null if not provided.</value>
    public double? WeightKg { get; set; }

    /// <summary>
    /// Gets or sets the user's height in centimeters.
    /// This value is stored in metric units regardless of input format.
    /// </summary>
    /// <value>Height in centimeters, or null if not provided.</value>
    public double? HeightCm { get; set; }

    /// <summary>
    /// Gets or sets the user's gender identity.
    /// </summary>
    /// <value>The user's self-identified gender, or null if not provided.</value>
    public string? Gender { get; set; }

    /// <summary>
    /// Gets or sets the user's preferred pronouns.
    /// Examples: "He/Him", "She/Her", "They/Them"
    /// </summary>
    /// <value>The user's preferred pronouns, or null if not provided.</value>
    public string? Pronoun { get; set; }

    /// <summary>
    /// Gets or sets the user's last place of residence.
    /// Format: "City, State, Country" (e.g., "Severn, Maryland, United States")
    /// </summary>
    /// <value>The user's last known residence, or null if not provided.</value>
    public string? LastResidence { get; set; }

    /// <summary>
    /// Gets or sets the list of user's hobbies and interests.
    /// Used for conversation personalization by Tars and other agents.
    /// </summary>
    /// <value>A list of hobbies, or empty list if not provided.</value>
    public List<string> Hobbies { get; set; } = new List<string>();

    /// <summary>
    /// Gets or sets the list of things the user likes.
    /// Used for conversation personalization and rapport building.
    /// </summary>
    /// <value>A list of things the user likes, or empty list if not provided.</value>
    public List<string> Likes { get; set; } = new List<string>();

    /// <summary>
    /// Gets or sets the list of things the user dislikes.
    /// Used to avoid topics or approaches that may be uncomfortable for the user.
    /// </summary>
    /// <value>A list of things the user dislikes, or empty list if not provided.</value>
    public List<string> Dislikes { get; set; } = new List<string>();

    /// <summary>
    /// Gets or sets additional information provided by the user.
    /// This can include any other relevant details for personalization.
    /// </summary>
    /// <value>Additional user information, or null if not provided.</value>
    public string? AdditionalInfo { get; set; }

    /// <summary>
    /// Gets or sets the timestamp when this data was collected.
    /// </summary>
    /// <value>The UTC timestamp of data collection.</value>
    [Required]
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Gets or sets the source of this data collection.
    /// Typically "Matron" for initial collection.
    /// </summary>
    /// <value>The source agent or system that collected this data.</value>
    [Required]
    public string Source { get; set; } = "Matron";

    /// <summary>
    /// Gets or sets the last update timestamp.
    /// Useful for tracking when biometric data was last modified.
    /// </summary>
    /// <value>The UTC timestamp of last update, or null if never updated.</value>
    public DateTime? LastUpdated { get; set; }

    /// <summary>
    /// Initializes a new instance of the <see cref="UserBiometricData"/> class.
    /// </summary>
    public UserBiometricData()
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="UserBiometricData"/> class with required fields.
    /// </summary>
    /// <param name="userId">The unique user identifier.</param>
    /// <param name="nickname">The user's preferred nickname.</param>
    /// <exception cref="ArgumentNullException">Thrown when userId or nickname is null or empty.</exception>
    public UserBiometricData(string userId, string nickname)
    {
        if (string.IsNullOrWhiteSpace(userId))
            throw new ArgumentNullException(nameof(userId), "User ID cannot be null or empty");
        if (string.IsNullOrWhiteSpace(nickname))
            throw new ArgumentNullException(nameof(nickname), "Nickname cannot be null or empty");

        UserId = userId;
        Nickname = nickname;
        Timestamp = DateTime.UtcNow;
        Source = "Matron";
    }

    /// <summary>
    /// Gets the blob storage path for this user's biometric data file.
    /// </summary>
    /// <returns>The blob path in format "users/{userId}/biometric.json".</returns>
    public string GetBlobPath()
    {
        return $"users/{UserId}/biometric.json";
    }

    /// <summary>
    /// Marks this data as updated and sets the LastUpdated timestamp.
    /// </summary>
    public void MarkAsUpdated()
    {
        LastUpdated = DateTime.UtcNow;
    }
}
