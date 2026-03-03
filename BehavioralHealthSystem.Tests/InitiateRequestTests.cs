namespace BehavioralHealthSystem.Tests;

[TestClass]
public class InitiateRequestTests
{
    [TestMethod]
    public void Constructor_DefaultValues_AreCorrect()
    {
        var request = new InitiateRequest();

        Assert.IsTrue(request.IsInitiated);
        Assert.IsNull(request.Metadata);
        Assert.AreEqual(string.Empty, request.UserId);
    }

    [TestMethod]
    public void Properties_SetAndGet_ReturnCorrectValues()
    {
        var metadata = new UserMetadata { Age = 30, Gender = "female" };
        var request = new InitiateRequest
        {
            UserId = "user-123",
            IsInitiated = false,
            Metadata = metadata
        };

        Assert.AreEqual("user-123", request.UserId);
        Assert.IsFalse(request.IsInitiated);
        Assert.AreSame(metadata, request.Metadata);
    }

    [TestMethod]
    public void JsonSerialization_UsesCorrectPropertyNames()
    {
        var request = new InitiateRequest
        {
            UserId = "test-user",
            IsInitiated = true
        };

        var json = JsonSerializer.Serialize(request);

        StringAssert.Contains(json, "\"isInitiated\"");
        StringAssert.Contains(json, "\"userId\"");
        StringAssert.Contains(json, "\"metadata\"");
    }

    [TestMethod]
    public void JsonDeserialization_Succeeds()
    {
        var json = """{"isInitiated":true,"userId":"test-user","metadata":{"age":25,"gender":"male"}}""";

        var request = JsonSerializer.Deserialize<InitiateRequest>(json);

        Assert.IsNotNull(request);
        Assert.AreEqual("test-user", request.UserId);
        Assert.IsTrue(request.IsInitiated);
        Assert.IsNotNull(request.Metadata);
        Assert.AreEqual(25, request.Metadata.Age);
    }
}
