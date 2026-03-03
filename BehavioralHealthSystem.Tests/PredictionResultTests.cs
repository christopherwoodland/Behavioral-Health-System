namespace BehavioralHealthSystem.Tests;

[TestClass]
public class PredictionResultTests
{
    [TestMethod]
    public void Constructor_DefaultValues_AreCorrect()
    {
        var result = new PredictionResult();

        Assert.IsNotNull(result.ActualScore);
        Assert.AreEqual(string.Empty, result.CreatedAt);
        Assert.IsFalse(result.IsCalibrated);
        Assert.AreEqual(string.Empty, result.ModelCategory);
        Assert.AreEqual(string.Empty, result.ModelGranularity);
        Assert.IsNull(result.PredictError);
        Assert.AreEqual(string.Empty, result.PredictedScore);
        Assert.AreEqual(string.Empty, result.PredictedScoreDepression);
        Assert.AreEqual(string.Empty, result.PredictedScoreAnxiety);
        Assert.AreEqual(string.Empty, result.SessionId);
        Assert.AreEqual(string.Empty, result.Status);
        Assert.AreEqual(string.Empty, result.UpdatedAt);
    }

    [TestMethod]
    public void ActualScore_DefaultIsNotNull()
    {
        var result = new PredictionResult();

        Assert.IsNotNull(result.ActualScore);
        Assert.AreEqual(string.Empty, result.ActualScore.TotalScore);
    }

    [TestMethod]
    public void Properties_SetAndGet_ReturnCorrectValues()
    {
        var result = new PredictionResult
        {
            SessionId = "session-xyz",
            Status = "completed",
            PredictedScore = "6.8",
            PredictedScoreDepression = "3.5",
            PredictedScoreAnxiety = "2.9",
            IsCalibrated = true,
            ModelCategory = "mental-health",
            ModelGranularity = "fine"
        };

        Assert.AreEqual("session-xyz", result.SessionId);
        Assert.AreEqual("completed", result.Status);
        Assert.AreEqual("6.8", result.PredictedScore);
        Assert.IsTrue(result.IsCalibrated);
    }

    [TestMethod]
    public void JsonRoundTrip_PreservesData()
    {
        var result = new PredictionResult
        {
            SessionId = "roundtrip-test",
            Status = "completed",
            PredictedScore = "5.0",
            IsCalibrated = true
        };

        var json = JsonSerializer.Serialize(result);
        var deserialized = JsonSerializer.Deserialize<PredictionResult>(json);

        Assert.IsNotNull(deserialized);
        Assert.AreEqual("roundtrip-test", deserialized.SessionId);
        Assert.AreEqual("completed", deserialized.Status);
        Assert.AreEqual("5.0", deserialized.PredictedScore);
        Assert.IsTrue(deserialized.IsCalibrated);
    }
}