namespace BehavioralHealthSystem.Tests;

[TestClass]
public class InitiateResponseTests
{
    [TestMethod]
    public void Constructor_DefaultValues_AreCorrect()
    {
        var response = new InitiateResponse();

        Assert.AreEqual(string.Empty, response.SessionId);
    }

    [TestMethod]
    public void SessionId_SetAndGet_ReturnsSetValue()
    {
        var response = new InitiateResponse { SessionId = "sess-abc-123" };

        Assert.AreEqual("sess-abc-123", response.SessionId);
    }

    [TestMethod]
    public void JsonSerialization_UsesSnakeCaseKey()
    {
        var response = new InitiateResponse { SessionId = "test-session" };

        var json = JsonSerializer.Serialize(response);

        StringAssert.Contains(json, "\"session_id\"");
        Assert.IsFalse(json.Contains("\"SessionId\""));
    }

    [TestMethod]
    public void JsonDeserialization_FromSnakeCase_Succeeds()
    {
        var json = """{"session_id":"my-session-456"}""";

        var response = JsonSerializer.Deserialize<InitiateResponse>(json);

        Assert.IsNotNull(response);
        Assert.AreEqual("my-session-456", response.SessionId);
    }
}
