namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for RiskAssessment model
/// </summary>
[TestClass]
public class RiskAssessmentTests
{
    [TestMethod]
    public void Constructor_DefaultValues_AreCorrect()
    {
        var assessment = new RiskAssessment();

        Assert.AreEqual(string.Empty, assessment.OverallRiskLevel);
        Assert.AreEqual(0, assessment.RiskScore);
        Assert.AreEqual(string.Empty, assessment.Summary);
        Assert.IsNotNull(assessment.KeyFactors);
        Assert.AreEqual(0, assessment.KeyFactors.Count);
        Assert.IsNotNull(assessment.Recommendations);
        Assert.AreEqual(0, assessment.Recommendations.Count);
        Assert.IsNotNull(assessment.ImmediateActions);
        Assert.IsNotNull(assessment.FollowUpRecommendations);
        Assert.AreEqual(0.0, assessment.ConfidenceLevel);
        Assert.IsNotNull(assessment.GeneratedAt);
        Assert.AreEqual(string.Empty, assessment.ModelVersion);
    }

    [TestMethod]
    public void Properties_SetAndGet_ReturnCorrectValues()
    {
        var assessment = new RiskAssessment
        {
            OverallRiskLevel = "High",
            RiskScore = 85,
            Summary = "Elevated risk detected",
            ConfidenceLevel = 0.92,
            ModelVersion = "1.0"
        };
        assessment.KeyFactors.Add("Depression indicators");
        assessment.Recommendations.Add("Schedule follow-up");

        Assert.AreEqual("High", assessment.OverallRiskLevel);
        Assert.AreEqual(85, assessment.RiskScore);
        Assert.AreEqual("Elevated risk detected", assessment.Summary);
        Assert.AreEqual(0.92, assessment.ConfidenceLevel);
        Assert.AreEqual(1, assessment.KeyFactors.Count);
        Assert.AreEqual(1, assessment.Recommendations.Count);
    }

    [TestMethod]
    public void JsonSerialization_UsesCorrectPropertyNames()
    {
        var assessment = new RiskAssessment
        {
            OverallRiskLevel = "Low",
            RiskScore = 20,
            ConfidenceLevel = 0.75
        };

        var json = JsonSerializer.Serialize(assessment);

        StringAssert.Contains(json, "\"overallRiskLevel\"");
        StringAssert.Contains(json, "\"riskScore\"");
        StringAssert.Contains(json, "\"confidenceLevel\"");
        StringAssert.Contains(json, "\"keyFactors\"");
        StringAssert.Contains(json, "\"recommendations\"");
    }

    [TestMethod]
    public void GeneratedAt_DefaultValue_IsValidIso8601()
    {
        var assessment = new RiskAssessment();

        Assert.IsTrue(DateTimeOffset.TryParse(assessment.GeneratedAt, out _),
            "GeneratedAt should be a valid ISO 8601 timestamp");
    }
}
