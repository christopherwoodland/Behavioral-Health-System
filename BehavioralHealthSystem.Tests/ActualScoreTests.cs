namespace BehavioralHealthSystem.Tests;

[TestClass]
public class ActualScoreTests
{
    [TestMethod]
    public void Constructor_DefaultValues_AreEmptyStrings()
    {
        var score = new ActualScore();

        Assert.AreEqual(string.Empty, score.AverageTotalScore);
        Assert.IsFalse(score.IsScoreProcessed);
        Assert.AreEqual(string.Empty, score.MaxScore);
        Assert.AreEqual(string.Empty, score.MinScore);
        Assert.AreEqual(string.Empty, score.RangeScore);
        Assert.AreEqual(string.Empty, score.StdScore);
        Assert.AreEqual(string.Empty, score.TotalScore);
    }

    [TestMethod]
    public void Properties_SetAndGet_ReturnCorrectValues()
    {
        var score = new ActualScore
        {
            AverageTotalScore = "7.5",
            IsScoreProcessed = true,
            MaxScore = "10",
            MinScore = "3",
            RangeScore = "7",
            StdScore = "2.1",
            TotalScore = "45"
        };

        Assert.AreEqual("7.5", score.AverageTotalScore);
        Assert.IsTrue(score.IsScoreProcessed);
        Assert.AreEqual("10", score.MaxScore);
        Assert.AreEqual("3", score.MinScore);
        Assert.AreEqual("7", score.RangeScore);
        Assert.AreEqual("2.1", score.StdScore);
        Assert.AreEqual("45", score.TotalScore);
    }

    [TestMethod]
    public void JsonSerialization_UsesSnakeCaseKeys()
    {
        var score = new ActualScore
        {
            AverageTotalScore = "5.0",
            IsScoreProcessed = true,
            TotalScore = "30"
        };

        var json = JsonSerializer.Serialize(score);

        StringAssert.Contains(json, "\"average_total_score\":");
        StringAssert.Contains(json, "\"is_score_processed\":");
        StringAssert.Contains(json, "\"total_score\":");
    }

    [TestMethod]
    public void JsonDeserialization_FromSnakeCaseKeys_Succeeds()
    {
        var json = """{"average_total_score":"8.0","is_score_processed":true,"total_score":"48"}""";

        var score = JsonSerializer.Deserialize<ActualScore>(json);

        Assert.IsNotNull(score);
        Assert.AreEqual("8.0", score.AverageTotalScore);
        Assert.IsTrue(score.IsScoreProcessed);
        Assert.AreEqual("48", score.TotalScore);
    }
}
