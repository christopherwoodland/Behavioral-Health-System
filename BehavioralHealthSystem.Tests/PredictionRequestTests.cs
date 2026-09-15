namespace BehavioralHealthSystem.Tests;

[TestClass]
public class PredictionRequestTests
{
    [TestMethod]
    public void Constructor_DefaultValues_AreCorrect()
    {
        var request = new PredictionRequest();

        Assert.AreEqual(string.Empty, request.SessionId);
        Assert.IsNotNull(request.AudioData);
        Assert.AreEqual(0, request.AudioData.Length);
        Assert.AreEqual(string.Empty, request.AudioFileUrl);
        Assert.AreEqual(string.Empty, request.AudioFileName);
        Assert.IsNull(request.Age);
        Assert.IsNull(request.WeightKg);
    }

    [TestMethod]
    public void Properties_SetAndGet_ReturnCorrectValues()
    {
        var audioBytes = new byte[] { 1, 2, 3, 4 };
        var request = new PredictionRequest
        {
            SessionId = "session-123",
            AudioData = audioBytes,
            AudioFileUrl = "https://storage.blob.core.windows.net/audio/test.wav",
            AudioFileName = "test.wav",
            Age = 42,
            WeightKg = 75.5
        };

        Assert.AreEqual("session-123", request.SessionId);
        CollectionAssert.AreEqual(audioBytes, request.AudioData);
        Assert.AreEqual("https://storage.blob.core.windows.net/audio/test.wav", request.AudioFileUrl);
        Assert.AreEqual("test.wav", request.AudioFileName);
        Assert.AreEqual(42, request.Age);
        Assert.AreEqual(75.5, request.WeightKg);
    }

    [TestMethod]
    public void JsonSerialization_UsesCorrectPropertyNames()
    {
        var request = new PredictionRequest { SessionId = "s1" };

        var json = JsonSerializer.Serialize(request);

        StringAssert.Contains(json, "\"sessionId\"");
        StringAssert.Contains(json, "\"audioData\"");
        StringAssert.Contains(json, "\"audioFileUrl\"");
        StringAssert.Contains(json, "\"audioFileName\"");
        StringAssert.Contains(json, "\"age\"");
        StringAssert.Contains(json, "\"weightKg\"");
    }
}
