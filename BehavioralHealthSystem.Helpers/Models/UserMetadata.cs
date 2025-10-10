namespace BehavioralHealthSystem.Models;

/// <summary>
/// Represents demographic and health metadata for a user undergoing behavioral health assessment.
/// All fields are optional and validated when provided.
/// </summary>
public class UserMetadata
{
    /// <summary>
    /// Gets or sets the user's age in years.
    /// Optional field. When provided, should be a positive integer.
    /// </summary>
    [JsonPropertyName("age")]
    public int Age { get; set; }

    /// <summary>
    /// Gets or sets the user's ethnicity.
    /// Optional field. Valid values: "Hispanic or Latino", "Not Hispanic or Latino".
    /// </summary>
    [JsonPropertyName("ethnicity")]
    public string Ethnicity { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the user's gender identity.
    /// Optional field. Valid values: "Male", "Female", "Non-binary", "Other", "Prefer not to say".
    /// Case-insensitive validation.
    /// </summary>
    [JsonPropertyName("gender")]
    public string Gender { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets a value indicating whether the user speaks English.
    /// This field may be deprecated in favor of a more comprehensive language field.
    /// </summary>
    [JsonPropertyName("language")]
    public bool Language { get; set; }

    /// <summary>
    /// Gets or sets the user's racial identity.
    /// Optional field. Valid values include: "American Indian or Alaska Native", "Asian", "Black or African American",
    /// "Hispanic or Latino", "Native Hawaiian or Other Pacific Islander", "White", "Two or More Races", "Other", "Prefer not to say".
    /// Case-insensitive validation.
    /// </summary>
    [JsonPropertyName("race")]
    public string Race { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the user's weight in pounds.
    /// Optional field. When provided, should be a positive integer between 1 and 1000.
    /// </summary>
    [JsonPropertyName("weight")]
    public int Weight { get; set; }

    /// <summary>
    /// Gets or sets the user's ZIP code.
    /// Optional field. When provided, should contain only alphanumeric characters (no hyphens or special characters).
    /// </summary>
    [JsonPropertyName("zipcode")]
    public string Zipcode { get; set; } = string.Empty;
}
