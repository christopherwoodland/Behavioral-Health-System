namespace BehavioralHealthSystem.Tests;

[TestClass]
public class PredictionResponseTests
{
    [TestMethod]
    public void Constructor_DefaultValues_AreCorrect()
    {
        var response = new PredictionResponse();

        Assert.AreEqual(string.Empty, response.SessionId);
        Assert.AreEqual(string.Empty, response.Status);
        Assert.AreEqual(string.Empty, response.PredictedScore);
        Assert.AreEqual(string.Empty, response.PredictedScoreDepression);
        Assert.AreEqual(string.Empty, response.PredictedScoreAnxiety);
        Assert.AreEqual(string.Empty, response.CreatedAt);
        Assert.AreEqual(string.Empty, response.UpdatedAt);
        Assert.AreEqual(string.Empty, response.ModelCategory);
        Assert.AreEqual(string.Empty, response.ModelGranularity);
        Assert.IsFalse(response.IsCalibrated);
        Assert.AreEqual(string.Empty, response.Provider);
        Assert.AreEqual(string.Empty, response.Model);
        Assert.IsNull(response.ActualScore);
        Assert.IsNull(response.PredictError);
    }

    [TestMethod]
    public void Properties_SetAndGet_ReturnCorrectValues()
    {
        var actualScore = new ActualScore { TotalScore = "30" };
        var predictError = new PredictError { Detail = "timeout" };

        var response = new PredictionResponse
        {
            SessionId = "sess-1",
            Status = "completed",
            PredictedScore = "7.5",
            PredictedScoreDepression = "4.2",
            PredictedScoreAnxiety = "3.1",
            IsCalibrated = true,
            Provider = "local-dam",
            Model = "KintsugiHealth/dam",
            ActualScore = actualScore,
            PredictError = predictError
        };

        Assert.AreEqual("sess-1", response.SessionId);
        Assert.AreEqual("completed", response.Status);
        Assert.AreEqual("7.5", response.PredictedScore);
        Assert.IsTrue(response.IsCalibrated);
        Assert.AreEqual("local-dam", response.Provider);
        Assert.AreSame(actualScore, response.ActualScore);
        Assert.AreSame(predictError, response.PredictError);
    }

    [TestMethod]
    public void JsonSerialization_UsesSnakeCaseKeys()
    {
        var response = new PredictionResponse { SessionId = "s1", Provider = "local-dam" };

        var json = JsonSerializer.Serialize(response);

        StringAssert.Contains(json, "\"session_id\"");
        StringAssert.Contains(json, "\"predicted_score\"");
        StringAssert.Contains(json, "\"is_calibrated\"");
        StringAssert.Contains(json, "\"provider\"");
        StringAssert.Contains(json, "\"actual_score\"");
        StringAssert.Contains(json, "\"predict_error\"");
    }
}
