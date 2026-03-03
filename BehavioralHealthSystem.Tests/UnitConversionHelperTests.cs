using BehavioralHealthSystem.Helpers.Services;

namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for UnitConversionHelper static utility class
/// </summary>
[TestClass]
public class UnitConversionHelperTests
{
    #region ConvertPoundsToKg Tests

    [TestMethod]
    public void ConvertPoundsToKg_ZeroPounds_ReturnsZero()
    {
        Assert.AreEqual(0, UnitConversionHelper.ConvertPoundsToKg(0));
    }

    [TestMethod]
    public void ConvertPoundsToKg_KnownValue_ReturnsCorrectResult()
    {
        // 150 lbs = 68.04 kg (rounded to 2 decimal places)
        var result = UnitConversionHelper.ConvertPoundsToKg(150);
        Assert.AreEqual(68.04, result, 0.01);
    }

    [TestMethod]
    public void ConvertPoundsToKg_OnePound_ReturnsCorrectFactor()
    {
        var result = UnitConversionHelper.ConvertPoundsToKg(1);
        Assert.AreEqual(0.45, result, 0.01);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentOutOfRangeException))]
    public void ConvertPoundsToKg_NegativeValue_ThrowsException()
    {
        UnitConversionHelper.ConvertPoundsToKg(-1);
    }

    #endregion

    #region ConvertKgToPounds Tests

    [TestMethod]
    public void ConvertKgToPounds_ZeroKg_ReturnsZero()
    {
        Assert.AreEqual(0, UnitConversionHelper.ConvertKgToPounds(0));
    }

    [TestMethod]
    public void ConvertKgToPounds_KnownValue_ReturnsCorrectResult()
    {
        // 68 kg ≈ 149.91 lbs
        var result = UnitConversionHelper.ConvertKgToPounds(68);
        Assert.AreEqual(149.91, result, 0.1);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentOutOfRangeException))]
    public void ConvertKgToPounds_NegativeValue_ThrowsException()
    {
        UnitConversionHelper.ConvertKgToPounds(-5);
    }

    [TestMethod]
    public void PoundsToKg_AndBack_IsReversible()
    {
        double originalPounds = 180;
        var kg = UnitConversionHelper.ConvertPoundsToKg(originalPounds);
        var backToPounds = UnitConversionHelper.ConvertKgToPounds(kg);

        Assert.AreEqual(originalPounds, backToPounds, 0.1);
    }

    #endregion

    #region ConvertInchesToCm Tests

    [TestMethod]
    public void ConvertInchesToCm_ZeroInches_ReturnsZero()
    {
        Assert.AreEqual(0, UnitConversionHelper.ConvertInchesToCm(0));
    }

    [TestMethod]
    public void ConvertInchesToCm_KnownValue_ReturnsCorrectResult()
    {
        // 70 inches = 177.8 cm
        var result = UnitConversionHelper.ConvertInchesToCm(70);
        Assert.AreEqual(177.8, result, 0.01);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentOutOfRangeException))]
    public void ConvertInchesToCm_NegativeValue_ThrowsException()
    {
        UnitConversionHelper.ConvertInchesToCm(-1);
    }

    #endregion

    #region ConvertCmToInches Tests

    [TestMethod]
    public void ConvertCmToInches_ZeroCm_ReturnsZero()
    {
        Assert.AreEqual(0, UnitConversionHelper.ConvertCmToInches(0));
    }

    [TestMethod]
    public void ConvertCmToInches_KnownValue_ReturnsCorrectResult()
    {
        // 180 cm ≈ 70.87 inches
        var result = UnitConversionHelper.ConvertCmToInches(180);
        Assert.AreEqual(70.87, result, 0.01);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentOutOfRangeException))]
    public void ConvertCmToInches_NegativeValue_ThrowsException()
    {
        UnitConversionHelper.ConvertCmToInches(-1);
    }

    [TestMethod]
    public void InchesToCm_AndBack_IsReversible()
    {
        double originalInches = 65;
        var cm = UnitConversionHelper.ConvertInchesToCm(originalInches);
        var backToInches = UnitConversionHelper.ConvertCmToInches(cm);

        Assert.AreEqual(originalInches, backToInches, 0.1);
    }

    #endregion

    #region ConvertFeetAndInchesToCm Tests

    [TestMethod]
    public void ConvertFeetAndInchesToCm_FiveFeetTenInches_ReturnsCorrectResult()
    {
        // 5'10" = 70 inches = 177.8 cm
        var result = UnitConversionHelper.ConvertFeetAndInchesToCm(5, 10);
        Assert.AreEqual(177.8, result, 0.01);
    }

    [TestMethod]
    public void ConvertFeetAndInchesToCm_ZeroFeetZeroInches_ReturnsZero()
    {
        Assert.AreEqual(0, UnitConversionHelper.ConvertFeetAndInchesToCm(0, 0));
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentOutOfRangeException))]
    public void ConvertFeetAndInchesToCm_NegativeFeet_ThrowsException()
    {
        UnitConversionHelper.ConvertFeetAndInchesToCm(-1, 0);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentOutOfRangeException))]
    public void ConvertFeetAndInchesToCm_NegativeInches_ThrowsException()
    {
        UnitConversionHelper.ConvertFeetAndInchesToCm(5, -1);
    }

    #endregion

    #region ConvertCmToFeetAndInches Tests

    [TestMethod]
    public void ConvertCmToFeetAndInches_KnownValue_ReturnsCorrectResult()
    {
        // 177.8 cm = 5 feet 10 inches
        var (feet, inches) = UnitConversionHelper.ConvertCmToFeetAndInches(177.8);

        Assert.AreEqual(5, feet);
        Assert.AreEqual(10.0, inches, 0.1);
    }

    [TestMethod]
    public void ConvertCmToFeetAndInches_ZeroCm_ReturnsZero()
    {
        var (feet, inches) = UnitConversionHelper.ConvertCmToFeetAndInches(0);

        Assert.AreEqual(0, feet);
        Assert.AreEqual(0, inches, 0.01);
    }

    [TestMethod]
    [ExpectedException(typeof(ArgumentOutOfRangeException))]
    public void ConvertCmToFeetAndInches_NegativeValue_ThrowsException()
    {
        UnitConversionHelper.ConvertCmToFeetAndInches(-10);
    }

    #endregion

    #region TryParseWeight Tests

    [TestMethod]
    public void TryParseWeight_PoundsFormat_ReturnsKg()
    {
        Assert.IsTrue(UnitConversionHelper.TryParseWeight("150 lbs", out var kg));
        Assert.AreEqual(68.04, kg, 0.1);
    }

    [TestMethod]
    public void TryParseWeight_PoundsSpelledOut_ReturnsKg()
    {
        Assert.IsTrue(UnitConversionHelper.TryParseWeight("150 pounds", out var kg));
        Assert.AreEqual(68.04, kg, 0.1);
    }

    [TestMethod]
    public void TryParseWeight_KgFormat_ReturnsKg()
    {
        Assert.IsTrue(UnitConversionHelper.TryParseWeight("68 kg", out var kg));
        Assert.AreEqual(68, kg, 0.01);
    }

    [TestMethod]
    public void TryParseWeight_KilogramsSpelledOut_ReturnsKg()
    {
        Assert.IsTrue(UnitConversionHelper.TryParseWeight("68 kilograms", out var kg));
        Assert.AreEqual(68, kg, 0.01);
    }

    [TestMethod]
    public void TryParseWeight_PlainNumber_DefaultsToImperial()
    {
        Assert.IsTrue(UnitConversionHelper.TryParseWeight("150", out var kg));
        Assert.AreEqual(68.04, kg, 0.1);
    }

    [TestMethod]
    public void TryParseWeight_NullOrEmpty_ReturnsFalse()
    {
        Assert.IsFalse(UnitConversionHelper.TryParseWeight(null!, out _));
        Assert.IsFalse(UnitConversionHelper.TryParseWeight("", out _));
        Assert.IsFalse(UnitConversionHelper.TryParseWeight("   ", out _));
    }

    [TestMethod]
    public void TryParseWeight_InvalidInput_ReturnsFalse()
    {
        Assert.IsFalse(UnitConversionHelper.TryParseWeight("abc", out _));
    }

    #endregion

    #region TryParseHeight Tests

    [TestMethod]
    public void TryParseHeight_FeetAndInchesWithQuotes_ReturnsCm()
    {
        Assert.IsTrue(UnitConversionHelper.TryParseHeight("5'10\"", out var cm));
        Assert.AreEqual(177.8, cm, 0.1);
    }

    [TestMethod]
    public void TryParseHeight_FeetAndInchesSpelledOut_ReturnsCm()
    {
        Assert.IsTrue(UnitConversionHelper.TryParseHeight("5 feet 10 inches", out var cm));
        Assert.AreEqual(177.8, cm, 0.1);
    }

    [TestMethod]
    public void TryParseHeight_CmFormat_ReturnsCm()
    {
        Assert.IsTrue(UnitConversionHelper.TryParseHeight("178 cm", out var cm));
        Assert.AreEqual(178, cm, 0.01);
    }

    [TestMethod]
    public void TryParseHeight_MetersFormat_ReturnsCm()
    {
        Assert.IsTrue(UnitConversionHelper.TryParseHeight("1.78 m", out var cm));
        Assert.AreEqual(178, cm, 0.01);
    }

    [TestMethod]
    public void TryParseHeight_PlainNumber_DefaultsToInches()
    {
        Assert.IsTrue(UnitConversionHelper.TryParseHeight("70", out var cm));
        Assert.AreEqual(177.8, cm, 0.1);
    }

    [TestMethod]
    public void TryParseHeight_NullOrEmpty_ReturnsFalse()
    {
        Assert.IsFalse(UnitConversionHelper.TryParseHeight(null!, out _));
        Assert.IsFalse(UnitConversionHelper.TryParseHeight("", out _));
        Assert.IsFalse(UnitConversionHelper.TryParseHeight("   ", out _));
    }

    #endregion

    #region FormatWeight Tests

    [TestMethod]
    public void FormatWeight_ReturnsFormattedString()
    {
        var result = UnitConversionHelper.FormatWeight(68.04);

        StringAssert.Contains(result, "68.0 kg");
        StringAssert.Contains(result, "lbs");
    }

    #endregion

    #region FormatHeight Tests

    [TestMethod]
    public void FormatHeight_ReturnsFormattedString()
    {
        var result = UnitConversionHelper.FormatHeight(177.8);

        StringAssert.Contains(result, "177.8 cm");
        StringAssert.Contains(result, "5'");
    }

    #endregion
}
