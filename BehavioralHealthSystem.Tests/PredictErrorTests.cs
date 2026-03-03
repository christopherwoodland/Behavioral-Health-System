namespace BehavioralHealthSystem.Tests;

[TestClass]
public class PredictErrorTests
{
    [TestMethod]
    public void Constructor_DefaultValues_AreCorrect()
    {
        var error = new PredictError();

        Assert.AreEqual(string.Empty, error.Detail);
        Assert.AreEqual(0, error.Status);
        Assert.AreEqual(string.Empty, error.Title);
        Assert.AreEqual(string.Empty, error.Type);
    }

    [TestMethod]
    public void Properties_SetAndGet_ReturnCorrectValues()
    {
        var error = new PredictError
        {
            Detail = "Audio file too short",
            Status = 400,
            Title = "Bad Request",
            Type = "validation_error"
        };

        Assert.AreEqual("Audio file too short", error.Detail);
        Assert.AreEqual(400, error.Status);
        Assert.AreEqual("Bad Request", error.Title);
        Assert.AreEqual("validation_error", error.Type);
    }

    [TestMethod]
    public void JsonSerialization_UsesSnakeCaseKeys()
    {
        var error = new PredictError { Detail = "test", Status = 500 };

        var json = JsonSerializer.Serialize(error);

        StringAssert.Contains(json, "\"detail\"");
        StringAssert.Contains(json, "\"status\"");
        StringAssert.Contains(json, "\"title\"");
        StringAssert.Contains(json, "\"type\"");
    }

    [TestMethod]
    public void JsonDeserialization_Succeeds()
    {
        var json = """{"detail":"Not found","status":404,"title":"Not Found","type":"not_found"}""";

        var error = JsonSerializer.Deserialize<PredictError>(json);

        Assert.IsNotNull(error);
        Assert.AreEqual("Not found", error.Detail);
        Assert.AreEqual(404, error.Status);
    }
}