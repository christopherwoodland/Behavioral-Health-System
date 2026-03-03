namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for SessionData and AnalysisResults models
/// </summary>
[TestClass]
public class SessionDataTests
{
    #region SessionData Tests

    [TestMethod]
    public void Constructor_DefaultValues_AreCorrect()
    {
        var session = new SessionData();

        Assert.AreEqual(string.Empty, session.SessionId);
        Assert.AreEqual(string.Empty, session.UserId);
        Assert.IsNull(session.MetadataUserId);
        Assert.IsNull(session.GroupId);
        Assert.IsNull(session.Prediction);
        Assert.IsNull(session.UserMetadata);
        Assert.AreEqual(string.Empty, session.AudioUrl);
        Assert.AreEqual(string.Empty, session.AudioFileName);
        Assert.IsNull(session.Transcription);
        Assert.IsNotNull(session.CreatedAt);
        Assert.IsNotNull(session.UpdatedAt);
        Assert.AreEqual("created", session.Status);
        Assert.IsNull(session.AnalysisResults);
        Assert.IsNull(session.RiskAssessment);
        Assert.IsNull(session.ExtendedRiskAssessment);
        Assert.IsNull(session.MultiConditionAssessment);
        Assert.IsNotNull(session.DSM5Conditions);
        Assert.AreEqual(0, session.DSM5Conditions.Count);
    }

    [TestMethod]
    public void Properties_SetAndGet_ReturnCorrectValues()
    {
        var metadata = new UserMetadata { Age = 30, Gender = "female" };
        var prediction = new PredictionResult { PredictedScore = "7.0" };

        var session = new SessionData
        {
            SessionId = "sess-123",
            UserId = "user-456",
            MetadataUserId = "meta-user",
            GroupId = "group-1",
            Prediction = prediction,
            UserMetadata = metadata,
            AudioUrl = "https://storage.blob.core.windows.net/audio/test.wav",
            AudioFileName = "test.wav",
            Transcription = "Hello world",
            Status = "completed"
        };

        Assert.AreEqual("sess-123", session.SessionId);
        Assert.AreEqual("user-456", session.UserId);
        Assert.AreEqual("meta-user", session.MetadataUserId);
        Assert.AreEqual("group-1", session.GroupId);
        Assert.AreSame(prediction, session.Prediction);
        Assert.AreSame(metadata, session.UserMetadata);
        Assert.AreEqual("Hello world", session.Transcription);
        Assert.AreEqual("completed", session.Status);
    }

    [TestMethod]
    public void CreatedAt_DefaultValue_IsValidTimestamp()
    {
        var session = new SessionData();

        Assert.IsTrue(DateTimeOffset.TryParse(session.CreatedAt, out _),
            "CreatedAt should be a valid ISO 8601 timestamp");
    }

    [TestMethod]
    public void DSM5Conditions_CanAddItems()
    {
        var session = new SessionData();
        session.DSM5Conditions.Add("Major Depressive Disorder");
        session.DSM5Conditions.Add("Generalized Anxiety Disorder");

        Assert.AreEqual(2, session.DSM5Conditions.Count);
        Assert.AreEqual("Major Depressive Disorder", session.DSM5Conditions[0]);
    }

    [TestMethod]
    public void JsonRoundTrip_PreservesData()
    {
        var session = new SessionData
        {
            SessionId = "roundtrip",
            UserId = "user-1",
            Status = "completed",
            AudioFileName = "test.wav"
        };

        var json = JsonSerializer.Serialize(session);
        var deserialized = JsonSerializer.Deserialize<SessionData>(json);

        Assert.IsNotNull(deserialized);
        Assert.AreEqual("roundtrip", deserialized.SessionId);
        Assert.AreEqual("user-1", deserialized.UserId);
        Assert.AreEqual("completed", deserialized.Status);
    }

    #endregion

    #region AnalysisResults Tests

    [TestMethod]
    public void AnalysisResults_DefaultValues_AreCorrect()
    {
        var results = new AnalysisResults();

        Assert.IsNull(results.DepressionScore);
        Assert.IsNull(results.AnxietyScore);
        Assert.AreEqual(string.Empty, results.RiskLevel);
        Assert.IsNull(results.Confidence);
        Assert.IsNotNull(results.Insights);
        Assert.AreEqual(0, results.Insights.Count);
        Assert.AreEqual(string.Empty, results.CompletedAt);
    }

    [TestMethod]
    public void AnalysisResults_Properties_SetAndGet()
    {
        var results = new AnalysisResults
        {
            DepressionScore = 7.5,
            AnxietyScore = 4.2,
            RiskLevel = "Moderate",
            Confidence = 0.85,
            CompletedAt = "2026-03-02T10:00:00Z"
        };
        results.Insights.Add("Elevated depression markers");

        Assert.AreEqual(7.5, results.DepressionScore);
        Assert.AreEqual(4.2, results.AnxietyScore);
        Assert.AreEqual("Moderate", results.RiskLevel);
        Assert.AreEqual(0.85, results.Confidence);
        Assert.AreEqual(1, results.Insights.Count);
    }

    #endregion
}
