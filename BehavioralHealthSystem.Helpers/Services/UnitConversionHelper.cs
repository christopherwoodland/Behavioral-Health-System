namespace BehavioralHealthSystem.Helpers.Services;

/// <summary>
/// Provides utilities for converting between imperial and metric units.
/// All conversions are used by the Matron agent to standardize biometric data storage.
/// </summary>
public static class UnitConversionHelper
{
    /// <summary>
    /// Conversion factor from pounds to kilograms.
    /// </summary>
    private const double PoundsToKgFactor = 0.45359237;

    /// <summary>
    /// Conversion factor from inches to centimeters.
    /// </summary>
    private const double InchesToCmFactor = 2.54;

    /// <summary>
    /// Number of inches in one foot.
    /// </summary>
    private const int InchesPerFoot = 12;

    /// <summary>
    /// Converts weight from pounds to kilograms.
    /// </summary>
    /// <param name="pounds">Weight in pounds.</param>
    /// <returns>Weight in kilograms, rounded to 2 decimal places.</returns>
    /// <exception cref="ArgumentOutOfRangeException">Thrown when pounds is negative.</exception>
    public static double ConvertPoundsToKg(double pounds)
    {
        if (pounds < 0)
            throw new ArgumentOutOfRangeException(nameof(pounds), "Weight cannot be negative");

        return Math.Round(pounds * PoundsToKgFactor, 2);
    }

    /// <summary>
    /// Converts weight from kilograms to pounds.
    /// </summary>
    /// <param name="kilograms">Weight in kilograms.</param>
    /// <returns>Weight in pounds, rounded to 2 decimal places.</returns>
    /// <exception cref="ArgumentOutOfRangeException">Thrown when kilograms is negative.</exception>
    public static double ConvertKgToPounds(double kilograms)
    {
        if (kilograms < 0)
            throw new ArgumentOutOfRangeException(nameof(kilograms), "Weight cannot be negative");

        return Math.Round(kilograms / PoundsToKgFactor, 2);
    }

    /// <summary>
    /// Converts height from inches to centimeters.
    /// </summary>
    /// <param name="inches">Height in inches.</param>
    /// <returns>Height in centimeters, rounded to 2 decimal places.</returns>
    /// <exception cref="ArgumentOutOfRangeException">Thrown when inches is negative.</exception>
    public static double ConvertInchesToCm(double inches)
    {
        if (inches < 0)
            throw new ArgumentOutOfRangeException(nameof(inches), "Height cannot be negative");

        return Math.Round(inches * InchesToCmFactor, 2);
    }

    /// <summary>
    /// Converts height from centimeters to inches.
    /// </summary>
    /// <param name="centimeters">Height in centimeters.</param>
    /// <returns>Height in inches, rounded to 2 decimal places.</returns>
    /// <exception cref="ArgumentOutOfRangeException">Thrown when centimeters is negative.</exception>
    public static double ConvertCmToInches(double centimeters)
    {
        if (centimeters < 0)
            throw new ArgumentOutOfRangeException(nameof(centimeters), "Height cannot be negative");

        return Math.Round(centimeters / InchesToCmFactor, 2);
    }

    /// <summary>
    /// Converts height from feet and inches to centimeters.
    /// </summary>
    /// <param name="feet">Height in feet.</param>
    /// <param name="inches">Additional inches.</param>
    /// <returns>Total height in centimeters, rounded to 2 decimal places.</returns>
    /// <exception cref="ArgumentOutOfRangeException">Thrown when feet or inches is negative.</exception>
    public static double ConvertFeetAndInchesToCm(int feet, double inches)
    {
        if (feet < 0)
            throw new ArgumentOutOfRangeException(nameof(feet), "Feet cannot be negative");
        if (inches < 0)
            throw new ArgumentOutOfRangeException(nameof(inches), "Inches cannot be negative");

        double totalInches = (feet * InchesPerFoot) + inches;
        return ConvertInchesToCm(totalInches);
    }

    /// <summary>
    /// Converts height from centimeters to feet and inches.
    /// </summary>
    /// <param name="centimeters">Height in centimeters.</param>
    /// <returns>A tuple containing (feet, inches), with inches rounded to 1 decimal place.</returns>
    /// <exception cref="ArgumentOutOfRangeException">Thrown when centimeters is negative.</exception>
    public static (int feet, double inches) ConvertCmToFeetAndInches(double centimeters)
    {
        if (centimeters < 0)
            throw new ArgumentOutOfRangeException(nameof(centimeters), "Height cannot be negative");

        double totalInches = ConvertCmToInches(centimeters);
        int feet = (int)(totalInches / InchesPerFoot);
        double inches = Math.Round(totalInches % InchesPerFoot, 1);

        return (feet, inches);
    }

    /// <summary>
    /// Parses a weight input string and converts it to kilograms.
    /// Supports formats: "150 lbs", "150 pounds", "68 kg", "68 kilograms", "150"
    /// </summary>
    /// <param name="input">The weight input string.</param>
    /// <param name="weightKg">The parsed weight in kilograms.</param>
    /// <returns>True if parsing succeeded; otherwise, false.</returns>
    public static bool TryParseWeight(string input, out double weightKg)
    {
        weightKg = 0;

        if (string.IsNullOrWhiteSpace(input))
            return false;

        // Normalize input: trim and lowercase
        string normalized = input.Trim().ToLowerInvariant();

        // Extract numeric value
        string numericPart = new string(normalized.TakeWhile(c => char.IsDigit(c) || c == '.').ToArray());

        if (!double.TryParse(numericPart, out double value))
            return false;

        // Determine unit
        bool isImperial = normalized.Contains("lb") || normalized.Contains("pound");
        bool isMetric = normalized.Contains("kg") || normalized.Contains("kilogram");

        // If no unit specified, assume pounds (imperial is more common in US)
        if (!isImperial && !isMetric)
            isImperial = true;

        try
        {
            weightKg = isImperial ? ConvertPoundsToKg(value) : value;
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Parses a height input string and converts it to centimeters.
    /// Supports formats: "5'10\"", "5 feet 10 inches", "70 inches", "178 cm", "1.78 m", "70"
    /// </summary>
    /// <param name="input">The height input string.</param>
    /// <param name="heightCm">The parsed height in centimeters.</param>
    /// <returns>True if parsing succeeded; otherwise, false.</returns>
    public static bool TryParseHeight(string input, out double heightCm)
    {
        heightCm = 0;

        if (string.IsNullOrWhiteSpace(input))
            return false;

        string normalized = input.Trim().ToLowerInvariant();

        try
        {
            // Handle meters (e.g., "1.78 m")
            if (normalized.Contains("m") && !normalized.Contains("cm"))
            {
                string numericPart = new string(normalized.TakeWhile(c => char.IsDigit(c) || c == '.').ToArray());
                if (double.TryParse(numericPart, out double meters))
                {
                    heightCm = meters * 100;
                    return true;
                }
            }

            // Handle centimeters (e.g., "178 cm")
            if (normalized.Contains("cm"))
            {
                string numericPart = new string(normalized.TakeWhile(c => char.IsDigit(c) || c == '.').ToArray());
                if (double.TryParse(numericPart, out double cm))
                {
                    heightCm = cm;
                    return true;
                }
            }

            // Handle feet and inches (e.g., "5'10\"" or "5 feet 10 inches")
            if (normalized.Contains("'") || normalized.Contains("feet") || normalized.Contains("ft"))
            {
                // Extract feet
                var feetMatch = System.Text.RegularExpressions.Regex.Match(normalized, @"(\d+)\s*(?:'|feet|ft)");
                if (!feetMatch.Success)
                    return false;

                int feet = int.Parse(feetMatch.Groups[1].Value);

                // Extract inches (optional)
                double inches = 0;
                var inchMatch = System.Text.RegularExpressions.Regex.Match(normalized, @"(\d+(?:\.\d+)?)\s*(?:""|inches|in\b)");
                if (inchMatch.Success)
                {
                    inches = double.Parse(inchMatch.Groups[1].Value);
                }

                heightCm = ConvertFeetAndInchesToCm(feet, inches);
                return true;
            }

            // Handle plain inches (e.g., "70 inches" or "70")
            if (normalized.Contains("inch") || normalized.Contains("in") || (!normalized.Contains("cm") && !normalized.Contains("m")))
            {
                string numericPart = new string(normalized.TakeWhile(c => char.IsDigit(c) || c == '.').ToArray());
                if (double.TryParse(numericPart, out double inches))
                {
                    heightCm = ConvertInchesToCm(inches);
                    return true;
                }
            }

            return false;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Formats weight in kilograms to a human-readable string with both metric and imperial.
    /// </summary>
    /// <param name="weightKg">Weight in kilograms.</param>
    /// <returns>Formatted string like "68 kg (150 lbs)".</returns>
    public static string FormatWeight(double weightKg)
    {
        double pounds = ConvertKgToPounds(weightKg);
        return $"{weightKg:F1} kg ({pounds:F1} lbs)";
    }

    /// <summary>
    /// Formats height in centimeters to a human-readable string with both metric and imperial.
    /// </summary>
    /// <param name="heightCm">Height in centimeters.</param>
    /// <returns>Formatted string like "178 cm (5'10\")".</returns>
    public static string FormatHeight(double heightCm)
    {
        var (feet, inches) = ConvertCmToFeetAndInches(heightCm);
        return $"{heightCm:F1} cm ({feet}'{inches:F1}\")";
    }
}
