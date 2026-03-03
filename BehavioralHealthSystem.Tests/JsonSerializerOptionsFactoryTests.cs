namespace BehavioralHealthSystem.Tests;

/// <summary>
/// Unit tests for JsonSerializerOptionsFactory
/// </summary>
[TestClass]
public class JsonSerializerOptionsFactoryTests
{
    #region Default Options Tests

    [TestMethod]
    public void Default_UseCamelCaseNamingPolicy()
    {
        var options = JsonSerializerOptionsFactory.Default;

        Assert.AreEqual(JsonNamingPolicy.CamelCase, options.PropertyNamingPolicy);
    }

    [TestMethod]
    public void Default_IsCaseInsensitive()
    {
        var options = JsonSerializerOptionsFactory.Default;

        Assert.IsTrue(options.PropertyNameCaseInsensitive);
    }

    [TestMethod]
    public void Default_IsSingletonInstance()
    {
        var options1 = JsonSerializerOptionsFactory.Default;
        var options2 = JsonSerializerOptionsFactory.Default;

        Assert.AreSame(options1, options2);
    }

    [TestMethod]
    public void Default_DoesNotWriteIndented()
    {
        var options = JsonSerializerOptionsFactory.Default;

        Assert.IsFalse(options.WriteIndented);
    }

    #endregion

    #region PrettyPrint Options Tests

    [TestMethod]
    public void PrettyPrint_UseCamelCaseNamingPolicy()
    {
        var options = JsonSerializerOptionsFactory.PrettyPrint;

        Assert.AreEqual(JsonNamingPolicy.CamelCase, options.PropertyNamingPolicy);
    }

    [TestMethod]
    public void PrettyPrint_IsCaseInsensitive()
    {
        var options = JsonSerializerOptionsFactory.PrettyPrint;

        Assert.IsTrue(options.PropertyNameCaseInsensitive);
    }

    [TestMethod]
    public void PrettyPrint_WritesIndented()
    {
        var options = JsonSerializerOptionsFactory.PrettyPrint;

        Assert.IsTrue(options.WriteIndented);
    }

    [TestMethod]
    public void PrettyPrint_IsSingletonInstance()
    {
        var options1 = JsonSerializerOptionsFactory.PrettyPrint;
        var options2 = JsonSerializerOptionsFactory.PrettyPrint;

        Assert.AreSame(options1, options2);
    }

    #endregion

    #region CreateDefault Tests

    [TestMethod]
    public void CreateDefault_ReturnsNewInstance()
    {
        var options1 = JsonSerializerOptionsFactory.CreateDefault();
        var options2 = JsonSerializerOptionsFactory.CreateDefault();

        Assert.AreNotSame(options1, options2);
    }

    [TestMethod]
    public void CreateDefault_UsesCamelCaseNamingPolicy()
    {
        var options = JsonSerializerOptionsFactory.CreateDefault();

        Assert.AreEqual(JsonNamingPolicy.CamelCase, options.PropertyNamingPolicy);
    }

    [TestMethod]
    public void CreateDefault_IsCaseInsensitive()
    {
        var options = JsonSerializerOptionsFactory.CreateDefault();

        Assert.IsTrue(options.PropertyNameCaseInsensitive);
    }

    [TestMethod]
    public void CreateDefault_IsNotSameAsDefaultSingleton()
    {
        var created = JsonSerializerOptionsFactory.CreateDefault();
        var singleton = JsonSerializerOptionsFactory.Default;

        Assert.AreNotSame(created, singleton);
    }

    #endregion

    #region Serialization Tests

    [TestMethod]
    public void Default_SerializesCamelCase()
    {
        var data = new { FirstName = "John", LastName = "Doe" };

        var json = JsonSerializer.Serialize(data, JsonSerializerOptionsFactory.Default);

        StringAssert.Contains(json, "\"firstName\":");
        StringAssert.Contains(json, "\"lastName\":");
    }

    [TestMethod]
    public void Default_DeserializesCaseInsensitive()
    {
        var json = "{\"AGE\": 30, \"GENDER\": \"male\"}";

        var result = JsonSerializer.Deserialize<UserMetadata>(json, JsonSerializerOptionsFactory.Default);

        Assert.IsNotNull(result);
        Assert.AreEqual(30, result.Age);
        Assert.AreEqual("male", result.Gender);
    }

    [TestMethod]
    public void PrettyPrint_ProducesIndentedOutput()
    {
        var data = new { Name = "Test" };

        var json = JsonSerializer.Serialize(data, JsonSerializerOptionsFactory.PrettyPrint);

        Assert.IsTrue(json.Contains(Environment.NewLine) || json.Contains("\n"));
    }

    #endregion
}
