namespace BehavioralHealthSystem.Tests;

[TestClass]
public class UserMetadataTests
{
    [TestMethod]
    public void Constructor_DefaultValues_AreCorrect()
    {
        var metadata = new UserMetadata();

        Assert.AreEqual(0, metadata.Age);
        Assert.AreEqual(string.Empty, metadata.Ethnicity);
        Assert.AreEqual(string.Empty, metadata.Gender);
        Assert.IsFalse(metadata.Language);
        Assert.AreEqual(string.Empty, metadata.Race);
        Assert.AreEqual(0, metadata.Weight);
        Assert.AreEqual(string.Empty, metadata.Zipcode);
    }

    [TestMethod]
    public void Properties_SetAndGet_ReturnCorrectValues()
    {
        var metadata = new UserMetadata
        {
            Age = 35,
            Ethnicity = "Hispanic",
            Gender = "female",
            Language = true,
            Race = "white",
            Weight = 150,
            Zipcode = "90210"
        };

        Assert.AreEqual(35, metadata.Age);
        Assert.AreEqual("Hispanic", metadata.Ethnicity);
        Assert.AreEqual("female", metadata.Gender);
        Assert.IsTrue(metadata.Language);
        Assert.AreEqual("white", metadata.Race);
        Assert.AreEqual(150, metadata.Weight);
        Assert.AreEqual("90210", metadata.Zipcode);
    }

    [TestMethod]
    public void JsonSerialization_UsesSnakeCaseKeys()
    {
        var metadata = new UserMetadata { Age = 25, Gender = "male" };

        var json = JsonSerializer.Serialize(metadata);

        StringAssert.Contains(json, "\"age\"");
        StringAssert.Contains(json, "\"gender\"");
        StringAssert.Contains(json, "\"ethnicity\"");
        StringAssert.Contains(json, "\"zipcode\"");
    }

    [TestMethod]
    public void JsonRoundTrip_PreservesAllFields()
    {
        var original = new UserMetadata
        {
            Age = 40, Ethnicity = "Asian", Gender = "non-binary",
            Language = true, Race = "asian", Weight = 165, Zipcode = "10001"
        };

        var json = JsonSerializer.Serialize(original);
        var deserialized = JsonSerializer.Deserialize<UserMetadata>(json);

        Assert.IsNotNull(deserialized);
        Assert.AreEqual(original.Age, deserialized.Age);
        Assert.AreEqual(original.Ethnicity, deserialized.Ethnicity);
        Assert.AreEqual(original.Gender, deserialized.Gender);
        Assert.AreEqual(original.Language, deserialized.Language);
        Assert.AreEqual(original.Race, deserialized.Race);
        Assert.AreEqual(original.Weight, deserialized.Weight);
        Assert.AreEqual(original.Zipcode, deserialized.Zipcode);
    }
}