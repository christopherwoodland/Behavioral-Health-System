namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for Session-specific prediction models:
/// SessionPredictionResult, SessionActualScore, SessionPredictError
/// </summary>
[TestClass]
public class SessionPredictionModelsTests
{
    #region SessionPredictionResult Tests

    [TestMethod]
    public void SessionPredictionResult_DefaultValues_AreCorrect()
    {
        var result = new SessionPredictionResult();

        Assert.IsNotNull(result.ActualScore);
        Assert.AreEqual(string.Empty, result.CreatedAt);
        Assert.IsFalse(result.IsCalibrated);
        Assert.AreEqual(string.Empty, result.ModelCategory);
        Assert.AreEqual(string.Empty, result.ModelGranularity);
        Assert.IsNull(result.PredictError);
        Assert.AreEqual(string.Empty, result.PredictedScore);
        Assert.AreEqual(string.Empty, result.PredictedScoreDepression);
        Assert.AreEqual(string.Empty, result.PredictedScoreAnxiety);
        Assert.AreEqual(string.Empty, result.Status);
        Assert.AreEqual(string.Empty, result.UpdatedAt);
    }

    [TestMethod]
    public void SessionPredictionResult_Properties_SetAndGet()
    {
        var result = new SessionPredictionResult
        {
            PredictedScore = "6.5",
            PredictedScoreDepression = "3.8",
            PredictedScoreAnxiety = "2.7",
            Status = "completed",
            IsCalibrated = true,
            ModelCategory = "mental-health",
            ModelGranularity = "fine"
        };

        Assert.AreEqual("6.5", result.PredictedScore);
        Assert.AreEqual("3.8", result.PredictedScoreDepression);
        Assert.AreEqual("completed", result.Status);
        Assert.IsTrue(result.IsCalibrated);
    }

    [TestMethod]
    public void SessionPredictionResult_JsonRoundTrip()
    {
        var result = new SessionPredictionResult
        {
            PredictedScore = "5.0",
            Status = "completed",
            IsCalibrated = true
        };

        var json = JsonSerializer.Serialize(result);
        var deserialized = JsonSerializer.Deserialize<SessionPredictionResult>(json);

        Assert.IsNotNull(deserialized);
        Assert.AreEqual("5.0", deserialized.PredictedScore);
        Assert.AreEqual("completed", deserialized.Status);
        Assert.IsTrue(deserialized.IsCalibrated);
    }

    #endregion

    #region SessionActualScore Tests

    [TestMethod]
    public void SessionActualScore_DefaultValues_AreCorrect()
    {
        var score = new SessionActualScore();

        Assert.AreEqual(string.Empty, score.AnxietyBinary);
        Assert.AreEqual(string.Empty, score.DepressionBinary);
        Assert.IsNotNull(score.Phq2);
        Assert.AreEqual(0, score.Phq2.Length);
        Assert.IsNotNull(score.Phq9);
        Assert.AreEqual(0, score.Phq9.Length);
        Assert.IsNotNull(score.Gad7);
        Assert.AreEqual(0, score.Gad7.Length);
    }

    [TestMethod]
    public void SessionActualScore_Properties_SetAndGet()
    {
        var score = new SessionActualScore
        {
            AnxietyBinary = "1",
            DepressionBinary = "0",
            Phq2 = new[] { 2, 3 },
            Phq9 = new[] { 1, 2, 3, 0, 1, 2, 0, 1, 0 },
            Gad7 = new[] { 2, 1, 3, 0, 2, 1, 3 }
        };

        Assert.AreEqual("1", score.AnxietyBinary);
        Assert.AreEqual("0", score.DepressionBinary);
        Assert.AreEqual(2, score.Phq2.Length);
        Assert.AreEqual(9, score.Phq9.Length);
        Assert.AreEqual(7, score.Gad7.Length);
    }

    [TestMethod]
    public void SessionActualScore_JsonSerialization_UsesSnakeCaseKeys()
    {
        var score = new SessionActualScore
        {
            AnxietyBinary = "1",
            Phq2 = new[] { 1, 2 }
        };

        var json = JsonSerializer.Serialize(score);

        StringAssert.Contains(json, "\"anxiety_binary\"");
        StringAssert.Contains(json, "\"depression_binary\"");
        StringAssert.Contains(json, "\"phq_2\"");
        StringAssert.Contains(json, "\"phq_9\"");
        StringAssert.Contains(json, "\"gad_7\"");
    }

    #endregion

    #region SessionPredictError Tests

    [TestMethod]
    public void SessionPredictError_DefaultValues_AreCorrect()
    {
        var error = new SessionPredictError();

        Assert.AreEqual(string.Empty, error.Error);
        Assert.AreEqual(string.Empty, error.Message);
    }

    [TestMethod]
    public void SessionPredictError_Properties_SetAndGet()
    {
        var error = new SessionPredictError
        {
            Error = "TIMEOUT",
            Message = "Request timed out after 300 seconds"
        };

        Assert.AreEqual("TIMEOUT", error.Error);
        Assert.AreEqual("Request timed out after 300 seconds", error.Message);
    }

    [TestMethod]
    public void SessionPredictError_JsonRoundTrip()
    {
        var error = new SessionPredictError { Error = "INVALID_AUDIO", Message = "Audio too short" };

        var json = JsonSerializer.Serialize(error);
        var deserialized = JsonSerializer.Deserialize<SessionPredictError>(json);

        Assert.IsNotNull(deserialized);
        Assert.AreEqual("INVALID_AUDIO", deserialized.Error);
        Assert.AreEqual("Audio too short", deserialized.Message);
    }

    #endregion
}
